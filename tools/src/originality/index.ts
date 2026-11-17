import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadContent,type Issue,type Item} from '../content.js';
import {bannedSources} from './config.js';
export function words(text:string):string[] {return text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];}
export function hasVerbatimRun(a:string,b:string,length=12):boolean {
 const x=words(a),y=words(b),runs=new Set<string>();
 for(let i=0;i<=y.length-length;i++) runs.add(y.slice(i,i+length).join(' '));
 for(let i=0;i<=x.length-length;i++) if(runs.has(x.slice(i,i+length).join(' '))) return true;
 return false;
}
export function shingles(text:string):Set<string> {
 const w=words(text),s=new Set<string>();
 for(let i=0;i<=w.length-5;i++) s.add(w.slice(i,i+5).join(' '));
 return s;
}
export function jaccard(a:Set<string>,b:Set<string>):number {
 if(!a.size||!b.size) return 0;
 const intersection=[...a].filter(x=>b.has(x)).length;
 return intersection/(a.size+b.size-intersection);
}
const escapeRegExp=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function bannedMatches(text:string):string[] {
 const lower=text.toLowerCase();
 return [
  ...bannedSources.names.filter(n=>new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(n)}(?![\\p{L}\\p{N}])`,'iu').test(text)),
  ...bannedSources.domains.filter(d=>lower.includes(d.toLowerCase())),
 ];
}
export function similarity(a:string,b:string):number {
 const x=shingles(a),y=shingles(b);
 if(x.size&&y.size) return jaccard(x,y);
 const u=words(a),v=words(b);
 return u.length>0&&u.length===v.length&&u.every((w,i)=>w===v[i])?1:0;
}
export function originalityItems(items:Item[]):{file:string;id:string;text:string}[] {
 return items.flatMap(i=>{
  if(i.type==='topic') return [{file:i.file,id:i.data.id,text:i.body}];
  if(i.type==='questions') return [
   ...(i.data.passage?[{file:i.file,id:`${i.data.id}#passage`,text:i.data.passage.body}]:[]),
   ...i.data.questions.map((q:any)=>({file:i.file,id:q.id,text:`${q.stem} ${q.choices.map((c:any)=>c.text).join(' ')}`})),
  ];
  if(i.type==='cards') return i.data.cards.map((c:any)=>({file:i.file,id:c.id,text:`${c.front} ${c.back}`}));
  return [];
 });
}
export async function lintOriginality(root:string,referenceDir=fileURLToPath(new URL('../../originality/reference/',import.meta.url))):Promise<Issue[]> {
 const {items,files,issues}=await loadContent(root);
 for(const file of files) {
  if(!/\.(json|mdx|svg|mmd|smi|txt)$/.test(file)) continue;
  let text=await readFile(file,'utf8');
  if(['taxonomy/aamc-outline.json'].includes(relative(root,file).split('\\').join('/'))) {
   try {const value=JSON.parse(text);delete value.note;delete value.source;text=JSON.stringify(value);} catch { /* parse failure already reported */ }
  }
  for(const match of bannedMatches(text)) issues.push({file:relative(root,file),rule:'banned-source',message:`Contains banned source ${match}`,severity:'error'});
 }
 const referenceFiles=(await readdir(referenceDir)).filter(f=>f.endsWith('.txt'));
 if(!referenceFiles.length) issues.push({file:'content',rule:'verbatim',message:'No local reference .txt files; verbatim check passed without a reference corpus',severity:'info'});
 for(const referenceFile of referenceFiles) {
  const reference=await readFile(join(referenceDir,referenceFile),'utf8');
  for(const file of files) if(/\.(json|mdx|svg|mmd|smi|txt)$/.test(file)&&hasVerbatimRun(await readFile(file,'utf8'),reference)) issues.push({file:relative(root,file),rule:'verbatim',message:`At least 12 consecutive normalized words match ${referenceFile}`,severity:'error'});
 }
 issues.push(...structureNumberingIssues(items));
 const comparable=originalityItems(items);
 // TODO: replace quadratic pair comparison with MinHash when the library grows.
 for(let a=0;a<comparable.length;a++) for(let b=a+1;b<comparable.length;b++) {
  const x=comparable[a]!,y=comparable[b]!,score=similarity(x.text,y.text);
  if(score>=0.6) issues.push({file:x.file,rule:'near-duplicate',message:`${x.id} resembles ${y.file}/${y.id}: Jaccard ${score.toFixed(3)}`,severity:score>=0.8?'error':'warning'});
 }
 return issues;
}
// x.y-style numbering at the start of a title or heading echoes a prep-book's chapter/section structure.
export const structureNumbering=/^\s*(?:#+\s*)?\d+\.\d+(?:\.\d+)*[\s.:)-]/;
const numberingMessage=(what:string,text:string)=>`${what} "${text.trim()}": x.y section numbering echoes prep-book structure; use plain titles`;
export function structureNumberingIssues(items:Item[]):Issue[] {
 const issues:Issue[]=[];
 const flag=(file:string,what:string,text:string)=>issues.push({file,rule:'structure-numbering',message:numberingMessage(what,text),severity:'error'});
 for(const i of items) {
  if(i.type==='topic'||i.type==='questions') if(typeof i.data.title==='string'&&structureNumbering.test(i.data.title)) flag(i.file,i.type==='topic'?'Topic title':'Question set title',i.data.title);
  if(i.type==='topic') {
   // CommonMark-style fences: close only on the same character with at least the opening length.
   let fence:{ch:string;len:number}|null=null;
   const lines=i.body.split(/\r?\n/);
   for(let k=0;k<lines.length;k++) {
    const line=lines[k];
    const f=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if(fence) {
     if(f&&f[1][0]===fence.ch&&f[1].length>=fence.len&&!f[2].trim()) fence=null;
     continue;
    }
    if(f&&!(f[1][0]==='`'&&f[2].includes('`'))) {fence={ch:f[1][0],len:f[1].length};continue;}
    if(/^\s*#+\s/.test(line)&&structureNumbering.test(line)) {flag(i.file,'Heading',line.replace(/^\s*#+\s*/,''));continue;}
    // Setext heading: a non-blank text line underlined by === or ---.
    const next=lines[k+1];
    if(next!==undefined&&line.trim()&&/^ {0,3}(=+|-+)\s*$/.test(next)&&structureNumbering.test(line)) flag(i.file,'Heading',line);
   }
  }
 }
 return issues;
}
