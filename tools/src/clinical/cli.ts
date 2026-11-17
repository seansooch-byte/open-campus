import {execFile} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import matter from 'gray-matter';
import {contentType,schemas,walk,type Issue,type Item} from '../content.js';
import {applyDecisions,changedSince,decisionsTemplate,duplicateKeys,findPending,formatApplySummary,formatPacket,itemSnapshot,parseDecisions,type PendingItem} from './index.js';
const run=promisify(execFile);
const contentRoot=()=>resolve(fileURLToPath(new URL('../../../content/',import.meta.url)));
/** pnpm --filter runs in tools/, so relative user paths resolve against where the user typed the command. */
const userPath=(p:string)=>resolve(process.env.INIT_CWD??process.cwd(),p);
const today=()=>new Date().toISOString().slice(0,10);
async function printErrors(issues:{file:string;rule:string;message:string;severity:string}[]):Promise<boolean> {
 const errors=issues.filter(i=>i.severity==='error');
 for(const e of errors) console.error(`${e.file}: ${e.rule}: ${e.message}`);
 return errors.length>0;
}
/** Snapshot of an item at a git ref, shaped like PendingItem.snapshot, or undefined when absent there. */
async function snapshotAt(ref:string,root:string,p:PendingItem):Promise<unknown> {
 try {
  const {stdout:top}=await run('git',['rev-parse','--show-toplevel'],{cwd:root});
  const text=(await run('git',['show',`${ref}:${root.slice(top.trim().length+1)}/${p.file}`],{cwd:root,maxBuffer:64*1024*1024})).stdout;
  if(p.file.endsWith('.mdx')) {const m=matter(text);return itemSnapshot(p.file,p.id,m.data,m.content);}
  return itemSnapshot(p.file,p.id,JSON.parse(text));
 } catch {return undefined;}
}
/** Like loadContent, but a clinical item with no sean_review is read as pending (the shared schema requires the field), so it reaches the packet instead of aborting the run. Source files are never changed. */
async function loadClinicalContent(root:string):Promise<{items:Item[];issues:Issue[]}> {
 const items:Item[]=[], issues:Issue[]=[];
 const fill=(o:any)=>{if(o&&typeof o==='object'&&o.clinical===true&&o.sean_review===undefined) o.sean_review='pending';};
 for(const absolute of await walk(root)) {
  const file=relative(root,absolute).split('\\').join('/'), type=contentType(file);
  if(!type) continue;
  try {
   const raw=await readFile(absolute,'utf8');
   const parsed=file.endsWith('.mdx')?matter(raw):{data:JSON.parse(raw),content:''};
   fill(parsed.data);
   for(const c of parsed.data?.cards??[]) fill(c);
   for(const q of parsed.data?.questions??[]) fill(q);
   const result=schemas[type]!.safeParse(parsed.data);
   if(!result.success) {for(const e of result.error.issues) issues.push({file,rule:'schema',message:`${e.path.join('.')}: ${e.message}`,severity:'error'});continue;}
   if(file.endsWith('.mdx')&&!parsed.content.trim()) {issues.push({file,rule:'body',message:'MDX body must be non-empty',severity:'error'});continue;}
   items.push({file,type,data:result.data,body:parsed.content,raw});
  } catch(e) {issues.push({file,rule:'parse',message:String(e),severity:'error'});}
 }
 for(const k of duplicateKeys(items)) issues.push({file:k.slice(0,k.lastIndexOf('#')),rule:'duplicate-id',message:`id ${k.slice(k.lastIndexOf('#')+1)} appears more than once`,severity:'error'});
 return {items,issues};
}
export async function runPacket(args:string[]):Promise<number> {
 const usage='Usage: cli.ts clinical-packet [--out review-packets/YYYY-MM-DD.md] [--since <git-ref>] [content-directory]';
 let out:string|undefined, since:string|undefined, dir:string|undefined;
 for(let i=0;i<args.length;i++) {
  const a=args[i]!;
  if(a==='--out'||a==='--since') {
   const v=args[++i];
   if(!v) {console.error(`${a} needs a value\n${usage}`);return 2;}
   if(a==='--out') out=v; else since=v;
  } else if(a.startsWith('--')) {console.error(`Unknown flag ${a}\n${usage}`);return 2;}
  else if(dir===undefined) dir=a;
  else {console.error(usage);return 2;}
 }
 const root=dir?userPath(dir):contentRoot(), date=today();
 const outFile=userPath(out??`review-packets/${date}.md`), jsonFile=outFile.replace(/\.md$/,'')+'.json';
 const {items,issues}=await loadClinicalContent(root);
 if(await printErrors(issues)) return 1;
 let pending=findPending(items);
 if(since) {
  try {await run('git',['rev-parse','--verify','--quiet',`${since}^{commit}`],{cwd:root});}
  catch {console.error(`Unknown git ref: ${since}`);return 2;}
  const old=new Map<string,unknown>();
  for(const p of pending) old.set(p.key,await snapshotAt(since,root,p));
  // Compare raw-to-raw: validated data carries schema defaults the historical file lacks.
  const rawNow=new Map(items.map(i=>[i.file,i.raw]));
  const now=(p:PendingItem)=>{const text=rawNow.get(p.file)!;if(p.file.endsWith('.mdx')) {const m=matter(text);return itemSnapshot(p.file,p.id,m.data,m.content);}return itemSnapshot(p.file,p.id,JSON.parse(text));};
  pending=changedSince(pending.map(p=>({...p,snapshot:now(p)})),p=>old.get(p.key));
 }
 await mkdir(dirname(outFile),{recursive:true});
 await writeFile(outFile,formatPacket(pending,{date,since}));
 await writeFile(jsonFile,JSON.stringify(decisionsTemplate(pending),null,2)+'\n');
 console.log(`clinical-packet: ${pending.length} pending item${pending.length===1?'':'s'}${pending.length?'':' (packet is empty)'}\n ${outFile}\n ${jsonFile}`);
 return 0;
}
export async function runApply(args:string[]):Promise<number> {
 const usage='Usage: cli.ts clinical-apply <decisions.json> [content-directory]';
 if(args.length<1||args.length>2||args.some(a=>a.startsWith('--'))) {console.error(usage);return 2;}
 try {
  const decisions=parseDecisions(await readFile(userPath(args[0]!),'utf8'));
  const root=args[1]?userPath(args[1]):contentRoot();
  const {items,issues}=await loadClinicalContent(root);
  if(await printErrors(issues)) return 1;
  console.log(formatApplySummary(await applyDecisions(root,items,decisions)));
  return 0;
 } catch(e) {
  console.error(e instanceof Error?e.message:String(e));
  return 1;
 }
}
