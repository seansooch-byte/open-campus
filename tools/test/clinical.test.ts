import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtemp,writeFile,mkdir,rm,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import matter from 'gray-matter';
import {loadContent} from '../src/content.js';
import {applyDecisions,changedSince,duplicateKeys,itemSnapshot,decisionsTemplate,findPending,formatPacket,groupPending,parseDecisions,planApply,snapshotOf} from '../src/clinical/index.js';
import {runPacket,runApply} from '../src/clinical/cli.js';
let root:string, outDir:string;
beforeEach(async()=>{
 const base=fileURLToPath(new URL('./',import.meta.url));
 root=await mkdtemp(join(base,'.tmp-clinical-'));
 outDir=await mkdtemp(join(base,'.tmp-clinical-out-'));
});
afterEach(async()=>{await rm(root,{recursive:true,force:true});await rm(outDir,{recursive:true,force:true});});
async function write(file:string,data:unknown) {await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');}
const verification={drafted_by:'claude',verified_by:'codex',model:'m',date:'2026-10-07',result:'pass',notes:'checked twice'};
const question=(id:string,extra:object={})=>({id,stem:`Stem ${id}?`,choices:['A','B','C','D'].map(key=>({key,text:`Choice ${key}`,explanation:`Reason ${key}`})),answer:'B',tags:{fc:'FC1',category:'1A',skill:'S1'},difficulty:2,...extra});
const mdx=(front:string,body:string)=>`---\n${front}\n---\n${body}\n`;
const topicFront=(id:string,extra='')=>`id: ${id}\ntitle: Title ${id}\nsubject: biochemistry\ncategories: [1A]\nlearning_objectives: [Learn it]\ndiagrams: []\nversion: 1\nupdated: '2026-10-07'\n${extra}`;
async function fixture() {
 await write('subjects/biochemistry/t-clin/topic.mdx',mdx(topicFront('t-clin','clinical: true\nsean_review: pending\n'),'Clinical body claim.'));
 await write('subjects/biochemistry/t-plain/topic.mdx',mdx(topicFront('t-plain'),'Plain body.'));
 await write('subjects/biochemistry/t-done/topic.mdx',mdx(topicFront('t-done','clinical: true\nsean_review: approved\n'),'Approved body.'));
 await write('subjects/biochemistry/t-clin/cards.json',{topic_id:'t-clin',cards:[{id:'c1',front:'F1',back:'B1',clinical:true,sean_review:'pending',verification},{id:'c2',front:'F2',back:'B2'},{id:'c3',front:'F3',back:'B3',clinical:true,sean_review:'rejected'}]});
 await write('questions/bio-biochem/set.json',{id:'set',section:'bio-biochem',title:'Set',topics:['example-amino-acid-structure'],passage:null,questions:[question('q1',{clinical:true,sean_review:'pending'}),question('q2'),question('q3',{clinical:true,sean_review:'approved'})]});
 await write('guides/g1.mdx',mdx(`id: g1\ntitle: Guide\nkind: other\naudience: both\nsources: []\nclinical: true\nsean_review: pending`,'Guide claim.'));
 const {items,issues}=await loadContent(root);
 expect(issues.filter(i=>i.severity==='error')).toEqual([]);
 return items;
}
it('finds only clinical items with pending review across all kinds',async()=>{
 const pending=findPending(await fixture());
 expect(pending.map(p=>p.key).sort()).toEqual(['guides/g1.mdx#g1','questions/bio-biochem/set.json#q1','subjects/biochemistry/t-clin/cards.json#c1','subjects/biochemistry/t-clin/topic.mdx#t-clin']);
});
it('treats a missing sean_review as pending',()=>{
 const item={file:'subjects/biochemistry/x/cards.json',type:'cards',raw:'',body:'',data:{topic_id:'x',cards:[{id:'c',front:'f',back:'b',clinical:true}]}};
 expect(findPending([item]).map(p=>p.id)).toEqual(['c']);
});
it('extracts claim text and verification',async()=>{
 const by=Object.fromEntries(findPending(await fixture()).map(p=>[p.id,p]));
 expect(by['t-clin']!.claim).toBe('Clinical body claim.');
 expect(by['c1']!.claim).toContain('**Front:** F1');
 expect(by['c1']!.claim).toContain('**Back:** B1');
 expect(by['c1']!.verification).toMatchObject({verified_by:'codex',result:'pass'});
 expect(by['q1']!.claim).toContain('Stem q1?');
 expect(by['q1']!.claim).toContain('**Correct answer (B):** Choice B');
 expect(by['q1']!.claim).toContain('Reason B');
 expect(by['q1']!.claim).not.toContain('Reason A');
 expect(by['g1']!.verification).toBeUndefined();
});
it('groups by subject, section and guides in sorted order',async()=>{
 const groups=groupPending(findPending(await fixture()));
 expect(groups.map(([g])=>g)).toEqual(['guides','section: bio-biochem','subject: biochemistry']);
 expect(groups[2]![1].map(p=>p.id)).toEqual(['c1','t-clin']);
});
it('formats a packet with key, claim, verification, and checkbox line',async()=>{
 const text=formatPacket(findPending(await fixture()),{date:'2026-10-07'});
 expect(text).toContain('4 pending items');
 expect(text).toContain('### `subjects/biochemistry/t-clin/cards.json#c1`');
 expect(text).toContain('> **Front:** F1');
 expect(text).toContain('drafted_by: claude, verified_by: codex, result: pass');
 expect(text).toContain('Verifier notes: checked twice');
 expect(text).toContain('_Verification: none_');
 expect(text.match(/- \[ \] approve {2}- \[ \] reject {2}notes:/g)).toHaveLength(4);
});
it('says so when nothing is pending',()=>{
 expect(formatPacket([],{date:'2026-10-07'})).toContain('No pending clinical items');
 expect(decisionsTemplate([])).toEqual({});
});
it('builds the decisions template',async()=>{
 const t=decisionsTemplate(findPending(await fixture()));
 expect(Object.keys(t)).toHaveLength(4);
 expect(t['guides/g1.mdx#g1']).toEqual({decision:'pending',notes:''});
});
it('changedSince keeps new and edited items only',async()=>{
 const pending=findPending(await fixture());
 const old=new Map(pending.map(p=>[p.key,p.snapshot]));
 old.set('questions/bio-biochem/set.json#q1',snapshotOf('different'));
 old.delete('guides/g1.mdx#g1');
 expect(changedSince(pending,p=>old.get(p.key)).map(p=>p.id).sort()).toEqual(['g1','q1']);
});
it('itemSnapshot sees metadata-only changes and ignores key order',()=>{
 const deck=(tags:object)=>({section:'bio-biochem',title:'Set',questions:[{...question('q1',{clinical:true,sean_review:'pending'}),tags}]});
 const file='questions/bio-biochem/set.json';
 const a=itemSnapshot(file,'q1',deck({fc:'FC1',category:'1A',skill:'S1'})), b=itemSnapshot(file,'q1',deck({skill:'S1',category:'1A',fc:'FC1'})), c=itemSnapshot(file,'q1',deck({fc:'FC1',category:'1B',skill:'S1'}));
 const p=(snapshot:unknown)=>[{snapshot}] as any;
 expect(changedSince(p(a),()=>b)).toEqual([]);
 expect(changedSince(p(a),()=>c)).toHaveLength(1);
});
const dupDeck=()=>({topic_id:'t-clin',cards:[{id:'dup',front:'First claim',back:'B',clinical:true,sean_review:'pending'},{id:'dup',front:'Second claim',back:'B',clinical:true,sean_review:'pending'}]});
it('refuses decisions on duplicate ids before writing',async()=>{
 await write('subjects/biochemistry/t-clin/cards.json',dupDeck());
 const {items}=await loadContent(root);
 const key='subjects/biochemistry/t-clin/cards.json#dup';
 expect(duplicateKeys(items)).toEqual([key]);
 const before=await readFile(join(root,'subjects/biochemistry/t-clin/cards.json'),'utf8');
 expect(planApply(items,{[key]:{decision:'approved',notes:''}})[0]).toMatch(/duplicate id/);
 await expect(applyDecisions(root,items,{[key]:{decision:'approved',notes:''}})).rejects.toThrow(/duplicate id/);
 expect(await readFile(join(root,'subjects/biochemistry/t-clin/cards.json'),'utf8')).toBe(before);
});
it('packet refuses content with duplicate ids',async()=>{
 await write('subjects/biochemistry/t-clin/cards.json',dupDeck());
 expect(await runPacket(['--out',join(outDir,'p.md'),root])).toBe(1);
});
it('keeps a body that itself starts with a frontmatter-like block',async()=>{
 const body='---\nlayout: example\n---\nClinical claim.';
 await write('subjects/biochemistry/t-clin/topic.mdx',mdx(topicFront('t-clin','clinical: true\nsean_review: pending\n'),body));
 const {items}=await loadContent(root);
 await applyDecisions(root,items,{'subjects/biochemistry/t-clin/topic.mdx#t-clin':{decision:'approved',notes:''}});
 const out=matter(await readFile(join(root,'subjects/biochemistry/t-clin/topic.mdx'),'utf8'));
 expect(out.data.sean_review).toBe('approved');
 expect(out.data.layout).toBeUndefined();
 expect(out.content.trim()).toBe(body);
});
it('applies decisions and round-trips JSON and MDX formatting',async()=>{
 const items=await fixture();
 const cardsBefore=JSON.parse(await readFile(join(root,'subjects/biochemistry/t-clin/cards.json'),'utf8'));
 const res=await applyDecisions(root,items,{
  'subjects/biochemistry/t-clin/cards.json#c1':{decision:'approved',notes:''},
  'subjects/biochemistry/t-clin/topic.mdx#t-clin':{decision:'rejected',notes:'wrong range'},
  'questions/bio-biochem/set.json#q1':{decision:'pending',notes:''},
 });
 expect(res.changed.map(c=>c.decision).sort()).toEqual(['approved','rejected']);
 expect(res.pending).toEqual(['questions/bio-biochem/set.json#q1']);
 const cardsText=await readFile(join(root,'subjects/biochemistry/t-clin/cards.json'),'utf8');
 expect(cardsText.endsWith('\n')).toBe(true);
 const cards=JSON.parse(cardsText);
 expect(cards.cards[0].sean_review).toBe('approved');
 cardsBefore.cards[0].sean_review='approved';
 expect(cards).toEqual(cardsBefore);
 const topic=matter(await readFile(join(root,'subjects/biochemistry/t-clin/topic.mdx'),'utf8'));
 expect(topic.data.sean_review).toBe('rejected');
 expect(topic.data.updated).toBe('2026-10-07');
 expect(topic.content.trim()).toBe('Clinical body claim.');
 expect(JSON.parse(await readFile(join(root,'questions/bio-biochem/set.json'),'utf8')).questions[0].sean_review).toBe('pending');
 const after=await loadContent(root);
 expect(after.issues.filter(i=>i.severity==='error')).toEqual([]);
 expect(findPending(after.items).map(p=>p.id).sort()).toEqual(['g1','q1']);
});
it('refuses unknown keys and non-clinical items without writing anything',async()=>{
 const items=await fixture();
 const before=await readFile(join(root,'subjects/biochemistry/t-clin/cards.json'),'utf8');
 const decisions={
  'subjects/biochemistry/t-clin/cards.json#c1':{decision:'approved' as const,notes:''},
  'subjects/biochemistry/t-clin/cards.json#c2':{decision:'approved' as const,notes:''},
  'subjects/biochemistry/t-clin/cards.json#nope':{decision:'approved' as const,notes:''},
  'missing.json#x':{decision:'rejected' as const,notes:''},
  'garbage':{decision:'rejected' as const,notes:''},
 };
 const errors=planApply(items,decisions);
 expect(errors).toHaveLength(4);
 expect(errors.join('\n')).toMatch(/c2: item is not clinical/);
 await expect(applyDecisions(root,items,decisions)).rejects.toThrow(/Refusing to apply/);
 expect(await readFile(join(root,'subjects/biochemistry/t-clin/cards.json'),'utf8')).toBe(before);
});
it('validates the decisions file shape',()=>{
 expect(parseDecisions('{"a#b":{"decision":"approved"}}')).toEqual({'a#b':{decision:'approved',notes:''}});
 expect(()=>parseDecisions('nope')).toThrow(/not valid JSON/);
 expect(()=>parseDecisions('[]')).toThrow(/JSON object/);
 expect(()=>parseDecisions('{"a#b":{"decision":"maybe"}}')).toThrow(/a#b/);
});
it('writes a packet and template through the CLI, then applies the filled template',async()=>{
 await fixture();
 const out=join(outDir,'p.md');
 expect(await runPacket(['--out',out,root])).toBe(0);
 expect(await readFile(out,'utf8')).toContain('4 pending items');
 const json=JSON.parse(await readFile(join(outDir,'p.json'),'utf8'));
 expect(Object.keys(json)).toHaveLength(4);
 json['guides/g1.mdx#g1'].decision='approved';
 await writeFile(join(outDir,'p.json'),JSON.stringify(json));
 expect(await runApply([join(outDir,'p.json'),root])).toBe(0);
 expect(matter(await readFile(join(root,'guides/g1.mdx'),'utf8')).data.sean_review).toBe('approved');
 expect(await runApply([join(outDir,'p.json'),'--bad'])).toBe(2);
});
it('produces an empty packet when no clinical items exist',async()=>{
 await write('subjects/biochemistry/t-plain/topic.mdx',mdx(topicFront('t-plain'),'Plain body.'));
 const out=join(outDir,'empty.md');
 expect(await runPacket(['--out',out,root])).toBe(0);
 expect(await readFile(out,'utf8')).toContain('No pending clinical items');
 expect(JSON.parse(await readFile(join(outDir,'empty.json'),'utf8'))).toEqual({});
});
it('rejects bad packet flags and unknown refs',async()=>{
 await fixture();
 expect(await runPacket(['--bogus'])).toBe(2);
 expect(await runPacket(['--since'])).toBe(2);
 expect(await runPacket(['--since','no-such-ref-xyz','--out',join(outDir,'x.md'),root])).toBe(2);
});
