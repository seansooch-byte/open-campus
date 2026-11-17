import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import matter from 'gray-matter';
import {courseOf,type Item} from '../content.js';
export type Kind='topic'|'card'|'question';
const group=(file:string)=>`course: ${courseOf(file)??'none'}`;
export type Verification={drafted_by?:string;verified_by?:string;result?:string;notes?:string;model?:string;date?:string};
export type PendingItem={key:string;file:string;id:string;kind:Kind;group:string;title:string;claim:string;verification?:Verification;snapshot:unknown};
export type Decision={decision:'pending'|'approved'|'rejected';notes:string};
export type Decisions=Record<string,Decision>;
export const cardClaim=(c:any)=>`**Front:** ${c.front}\n\n**Back:** ${c.back}`;
export const questionClaim=(q:any)=>{const right=q.choices?.find((c:any)=>c.key===q.answer);return `**Stem:** ${q.stem}\n\n**Correct answer (${q.answer}):** ${right?.text??''}\n\n**Explanation:** ${right?.explanation??''}`;};
/** What "changed since a ref" compares: the complete item data (every field; a clinical item's missing sean_review reads as pending), the MDX body, the deck-level fields that feed the packet, and kind/group. */
export const snapshotOf=(item:unknown,meta:Record<string,unknown>={})=>({item,...meta});
const normalize=(o:any)=>o&&typeof o==='object'&&o.clinical===true&&o.sean_review===undefined?{...o,sean_review:'pending'}:o;
/** Snapshot of one item from raw file data (current or historical), or undefined when the file holds no item with that id. */
export function itemSnapshot(file:string,id:string,data:any,body=''):unknown {
 if(file.endsWith('.mdx')) {
  if(data?.id!==id) return undefined;
  return snapshotOf(normalize(data),{body:body.trim(),kind:'topic',group:group(file)});
 }
 const c=data?.cards?.find((y:any)=>y.id===id), q=data?.questions?.find((y:any)=>y.id===id);
 if(c) return snapshotOf(normalize(c),{deckVerification:data.verification??null,kind:'card',group:group(file),topic:data.topic_id});
 if(q) return snapshotOf(normalize(q),{deckVerification:data.verification??null,kind:'question',group:group(file),title:data.title});
}
/** Card or question ids that appear more than once within a file, as `<file>#<id>` keys. */
export function duplicateKeys(items:Item[]):string[] {
 const out:string[]=[];
 for(const it of items) {
  const ids:string[]=it.type==='cards'?(it.data.cards??[]).map((c:any)=>c.id):it.type==='questions'?(it.data.questions??[]).map((q:any)=>q.id):[];
  out.push(...ids.filter((id,i)=>ids.indexOf(id)!==i).map(id=>`${it.file}#${id}`));
 }
 return [...new Set(out)];
}
const stable=(v:unknown):string=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x)??'undefined';
const isPending=(o:any)=>o?.clinical===true&&(o.sean_review===undefined||o.sean_review==='pending');
/** Every clinical item (topic, card, question) whose sean_review is pending or missing, in file order. Example items are included: the flag is about review state only. */
export function findPending(items:Item[]):PendingItem[] {
 const out:PendingItem[]=[];
 for(const it of items) {
  const d=it.data, key=(id:string)=>`${it.file}#${id}`;
  if(it.type==='topic'&&isPending(d)) out.push({key:key(d.id),file:it.file,id:d.id,kind:'topic',group:group(it.file),title:`topic ${d.id}`,claim:it.body.trim(),verification:d.verification,snapshot:itemSnapshot(it.file,d.id,d,it.body)});
  else if(it.type==='cards') {
   for(const c of d.cards) if(isPending(c)) out.push({key:key(c.id),file:it.file,id:c.id,kind:'card',group:group(it.file),title:`card in ${d.topic_id}`,claim:cardClaim(c),verification:c.verification??d.verification,snapshot:itemSnapshot(it.file,c.id,d)});
  } else if(it.type==='questions') {
   for(const q of d.questions) if(isPending(q)) out.push({key:key(q.id),file:it.file,id:q.id,kind:'question',group:group(it.file),title:`question in ${d.title}`,claim:questionClaim(q),verification:q.verification??d.verification,snapshot:itemSnapshot(it.file,q.id,d)});
  }
 }
 return out;
}
/** Group pending items by course; groups and items are sorted so output is stable. */
export function groupPending(pending:PendingItem[]):[string,PendingItem[]][] {
 const groups=new Map<string,PendingItem[]>();
 for(const p of pending) groups.set(p.group,[...(groups.get(p.group)??[]),p]);
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([g,list])=>[g,[...list].sort((a,b)=>a.key.localeCompare(b.key))]);
}
const quote=(text:string)=>text.split('\n').map(l=>l?`> ${l}`:'>').join('\n');
function verificationLines(v?:Verification):string {
 if(!v) return '_Verification: none_';
 const parts=[`drafted_by: ${v.drafted_by??'?'}`,`verified_by: ${v.verified_by??'?'}`,`result: ${v.result??'?'}`];
 return `Verification: ${parts.join(', ')}${v.notes?`\n\nVerifier notes: ${v.notes}`:''}`;
}
export function formatPacket(pending:PendingItem[],opts:{date:string;since?:string}):string {
 const head=`# Clinical review packet, ${opts.date}\n\n${opts.since?`Items changed since \`${opts.since}\`. `:''}${pending.length} pending item${pending.length===1?'':'s'}.\n`;
 if(!pending.length) return `${head}\nNo pending clinical items. Nothing to review this week.\n`;
 const body=groupPending(pending).map(([group,list])=>`## ${group}\n\n${list.map(p=>`### \`${p.key}\`\n\n${p.kind}: ${p.title}\n\n${quote(p.claim)}\n\n${verificationLines(p.verification)}\n\n- [ ] approve  - [ ] reject  notes:\n`).join('\n')}`);
 return `${head}\nRecord decisions in the sibling \`.json\` file, then run \`pnpm clinical:apply <decisions.json>\`.\n\n${body.join('\n')}`;
}
export function decisionsTemplate(pending:PendingItem[]):Decisions {
 return Object.fromEntries([...pending].sort((a,b)=>a.key.localeCompare(b.key)).map(p=>[p.key,{decision:'pending',notes:''} as Decision]));
}
/** Keep only items that are new or differ from their counterpart at the ref. `old` returns the snapshot at that ref (undefined when absent). */
export function changedSince(pending:PendingItem[],old:(p:PendingItem)=>unknown):PendingItem[] {
 return pending.filter(p=>stable(old(p))!==stable(p.snapshot));
}
export type ApplyResult={changed:{key:string;decision:string;notes:string}[];unchanged:string[];pending:string[]};
export function parseDecisions(text:string):Decisions {
 let raw:any;
 try {raw=JSON.parse(text);} catch(e) {throw new Error(`Decisions file is not valid JSON: ${e}`);}
 if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new Error('Decisions file must be a JSON object keyed by <file>#<id>');
 const bad=Object.entries<any>(raw).filter(([,v])=>!v||typeof v!=='object'||!['pending','approved','rejected'].includes(v.decision)||(v.notes!==undefined&&typeof v.notes!=='string')).map(([k])=>k);
 if(bad.length) throw new Error(`Invalid decision (need decision pending|approved|rejected, notes string) for: ${bad.join(', ')}`);
 return Object.fromEntries(Object.entries<any>(raw).map(([k,v])=>[k,{decision:v.decision,notes:v.notes??''}]));
}
/** Locate the object carrying sean_review for an id inside a file's data. */
function target(type:string,id:string,data:any):any {
 if(type==='cards') return data.cards?.find((c:any)=>c.id===id);
 if(type==='questions') return data.questions?.find((q:any)=>q.id===id);
 return data.id===id?data:undefined;
}
const split=(key:string):[string,string]|undefined=>{const at=key.lastIndexOf('#');return at<1?undefined:[key.slice(0,at),key.slice(at+1)];};
/** Checks every key before touching disk: unknown keys and non-clinical items refuse the whole batch. */
export function planApply(items:Item[],decisions:Decisions):string[] {
 const dup=new Set(duplicateKeys(items)), errors:string[]=[];
 for(const key of Object.keys(decisions)) {
  if(dup.has(key)) {errors.push(`${key}: duplicate id (ambiguous), refusing to change it`);continue;}
  const [file,id]=split(key)??[];
  const item=items.find(i=>i.file===file), obj=item&&id!==undefined?target(item.type,id,item.data):undefined;
  if(!obj) errors.push(`${key}: unknown key (no such item)`);
  else if(obj.clinical!==true) errors.push(`${key}: item is not clinical: true, refusing to change it`);
 }
 return errors;
}
/** Applies approved/rejected decisions under `root`. Throws before writing anything if any key is refused. */
export async function applyDecisions(root:string,items:Item[],decisions:Decisions):Promise<ApplyResult> {
 const errors=planApply(items,decisions);
 if(errors.length) throw new Error(`Refusing to apply:\n${errors.map(e=>` ${e}`).join('\n')}`);
 const result:ApplyResult={changed:[],unchanged:[],pending:[]};
 const byFile=new Map<string,[string,string,Decision][]>();
 for(const [key,d] of Object.entries(decisions)) {
  if(d.decision==='pending') {result.pending.push(key);continue;}
  const [file,id]=split(key)!;
  byFile.set(file,[...(byFile.get(file)??[]),[key,id,d]]);
 }
 for(const [file,list] of byFile) {
  const path=join(root,file), raw=await readFile(path,'utf8'), mdx=file.endsWith('.mdx');
  const parsed=mdx?matter(raw):undefined, data=mdx?structuredClone(parsed!.data):JSON.parse(raw), type=items.find(i=>i.file===file)!.type;
  let dirty=false;
  for(const [key,id,d] of list) {
   const obj=target(type,id,data);
   if(obj.sean_review===d.decision) {result.unchanged.push(key);continue;}
   obj.sean_review=d.decision;dirty=true;
   result.changed.push({key,decision:d.decision,notes:d.notes});
  }
  if(dirty) await writeFile(path,mdx?matter.stringify(parsed!,data):JSON.stringify(data,null,2)+(raw.endsWith('\n')?'\n':''));
 }
 return result;
}
export function formatApplySummary(r:ApplyResult):string {
 const lines=[`clinical-apply: ${r.changed.length} changed, ${r.unchanged.length} already set, ${r.pending.length} left pending`];
 for(const c of r.changed) lines.push(` ${c.decision}: ${c.key}${c.notes?` (${c.notes})`:''}`);
 return lines.join('\n');
}
