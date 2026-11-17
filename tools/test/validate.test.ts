import {it,expect,beforeEach,afterEach} from 'vitest';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate} from '../src/validate.js';
import {makeFixtureRoot,contentDir} from './helpers/fixture-root.js';
let root:string;
const topic='subjects/biochemistry/example-amino-acid-structure/topic.mdx';
const cards='subjects/biochemistry/example-amino-acid-structure/cards.json';
const set='questions/bio-biochem/example-amino-acids-discrete.json';
beforeEach(async()=>{root=await makeFixtureRoot('.tmp-oc-');});
afterEach(async()=>{await rm(root,{recursive:true,force:true});});
async function write(file:string,text:string) {await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),text);}
async function mutate(file:string,fn:(data:any)=>void) {const data=JSON.parse(await readFile(join(root,file),'utf8'));fn(data);await write(file,JSON.stringify(data));}
async function has(rule:string) {expect((await validate(root)).some(i=>i.rule===rule&&i.severity==='error')).toBe(true);}
it('fixture content validates and reports verification counts',async()=>{
 const result=await validate(contentDir);expect(result.filter(i=>i.severity==='error')).toEqual([]);
 expect(result.some(i=>/^unverified: \d+$/.test(i.message))).toBe(true);
},60_000);
it('schema fixture: malformed question, independent verification and clinical gating fields',async()=>{await mutate(set,d=>{d.questions[0].choices.pop();});await has('schema');});
it('parse fixture: invalid JSON',async()=>{await write(set,'{');await has('parse');});
it('layout fixture: misplaced content',async()=>{await write('questions/unknown/set.json','{}');await has('layout');});
it('body fixture: empty MDX body',async()=>{const raw=await readFile(join(root,topic),'utf8');await write(topic,raw.slice(0,raw.indexOf('\n---',4)+4));await has('body');});
it('unique ID fixture: duplicated topics',async()=>{await write('subjects/biology/another/topic.mdx',await readFile(join(root,topic),'utf8'));await has('unique-id');});
it('path ID fixture: topic and deck directory mismatch',async()=>{await write(topic,(await readFile(join(root,topic),'utf8')).replace('id: example-amino-acid-structure','id: wrong-topic'));await has('path-id');await mutate(cards,d=>{d.topic_id='wrong-deck';});await has('path-id');});
it('path ID fixture: set filename and section mismatch',async()=>{await mutate(set,d=>{d.id='wrong-set';d.section='chem-phys';});await has('path-id');});
it('tag fixture: category belongs to wrong concept',async()=>{await mutate(set,d=>{d.questions[0].tags.fc='FC2';});await has('tag');});
it('tag fixture: science question has reading skill',async()=>{await mutate(set,d=>{d.questions[0].tags.skill='C1';});await has('tag');});
it('tag fixture: topic category missing from taxonomy',async()=>{await mutate('taxonomy/aamc-outline.json',d=>{d.foundationalConcepts[0].categories.shift();});await has('tag');});
it('taxonomy fixture: missing taxonomy',async()=>{await rm(join(root,'taxonomy/aamc-outline.json'));await has('taxonomy');});
it('taxonomy fixture: duplicate or misclassified codes',async()=>{await mutate('taxonomy/aamc-outline.json',d=>{d.skills.push(d.skills[0]);d.foundationalConcepts[0].section='chem-phys';});await has('taxonomy');});
it('prerequisite fixture: missing topic',async()=>{await write(topic,(await readFile(join(root,topic),'utf8')).replace('categories: [1A]','categories: [1A]\nprerequisites: [missing-topic]'));await has('prerequisite');});
it('diagram fixture: missing asset',async()=>{await rm(join(root,dirname(topic),'diagrams/alpha-carbon.svg'));await has('diagram');});
it('deck topic fixture: orphan deck',async()=>{await rm(join(root,topic));await has('topic-ref');});
async function examFixture(name='good-exam') {
 await write('questions/bio-biochem/verified-set.json',await readFile(new URL('./fixtures/verified-set.json',import.meta.url),'utf8'));
 await write('exams/fl-1.json',await readFile(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8'));
}
it('good exam fixture permits an eligible question',async()=>{await examFixture();expect((await validate(root)).filter(i=>i.severity==='error')).toEqual([]);});
it('exam reference fixture: missing question',async()=>{await examFixture('bad-exam');await has('exam-ref');});
it('exam reference fixture: missing set and section mismatch',async()=>{await examFixture();await mutate('exams/fl-1.json',d=>{d.sections[0].section='chem-phys';d.sections[0].items.push({set_id:'missing-set'});});await has('exam-ref');});
it.each(['example','missing-verification','disputed','clinical-pending','clinical-rejected'])('exam gating fixture: %s',async(mode)=>{
 await examFixture();await mutate('questions/bio-biochem/verified-set.json',d=>{
  if(mode==='example') d.example=true;
  if(mode==='missing-verification') delete d.verification;
  if(mode==='disputed') d.questions[0].verification={...d.verification,result:'disputed'};
  if(mode.startsWith('clinical')) {d.questions[0].clinical=true;d.questions[0].sean_review=mode==='clinical-pending'?'pending':'rejected';}
 });await has('exam-eligibility');
});
it('duplicate question fixture',async()=>{await mutate(set,d=>{d.questions.push(d.questions[0]);});await has('schema');});
it('duplicate card fixture',async()=>{await mutate(cards,d=>{d.cards.push(d.cards[0]);});await has('unique-id');});
it('school source fixture rejects banned domains and subdomains',async()=>{
 await write('schools/example.json',JSON.stringify({id:'example',name:'Example',degree:'MD',state:'MI',website:'https://example.edu',facts:[{key:'name',value:'Example',source_url:'https://sub.mec.aamc.org/data',as_of:'2026-10-07'}]}));await has('school-source');
});
it('verification status counts include inherited disputed and clinical pending items',async()=>{
 await mutate(set,d=>{d.verification={drafted_by:'claude',verified_by:'codex',model:'fixture',date:'2026-10-07',result:'disputed'};d.questions[0].clinical=true;d.questions[0].sean_review='pending';});
 const result=await validate(root);expect(result.some(i=>i.message==='disputed: 2')).toBe(true);expect(result.some(i=>i.message==='clinical-pending: 1')).toBe(true);
});
it('CLI JSON output and process status reflect validation and originality errors',async()=>{
 const {execFile}=await import('node:child_process');
 const cwd=fileURLToPath(new URL('../',import.meta.url));
 const run=()=>new Promise<{status:number|null;stdout:string}>(resolve=>{
  execFile(process.execPath,['node_modules/tsx/dist/cli.mjs','src/cli.ts','all',root,'--json'],{cwd,encoding:'utf8',timeout:30_000,killSignal:'SIGKILL',maxBuffer:32*1024*1024},(err,stdout)=>{
   const code=(err as any)?.code;resolve({status:err?(typeof code==='number'?code:null):0,stdout});
  });
 });
 const good=await run();expect(good.status).toBe(0);expect(JSON.parse(good.stdout).summary.errors).toBe(0);
 await mutate(set,d=>{d.questions[0].stem='UWorld';});
 const bad=await run();expect(bad.status).toBe(1);expect(JSON.parse(bad.stdout).issues.some((i:any)=>i.rule==='banned-source')).toBe(true);
 await mutate(set,d=>{d.questions[0].choices.pop();});
 expect(JSON.parse((await run()).stdout).issues.some((i:any)=>i.rule==='schema')).toBe(true);
},120_000);
it('set topics fixture: a set must name its topics, main topic first',async()=>{await mutate(set,d=>{delete d.topics;});await has('schema');});
it('set topics fixture: an empty or repeated topic list is a schema error',async()=>{
 await mutate(set,d=>{d.topics=[];});await has('schema');
 await mutate(set,d=>{d.topics=['example-amino-acid-structure','example-amino-acid-structure'];});await has('schema');
});
it('set topics fixture: a topic that does not exist is a topic-ref error',async()=>{await mutate(set,d=>{d.topics=['example-amino-acid-structure','no-such-topic'];});await has('topic-ref');});
it('set topics fixture: an existing topic passes',async()=>{
 await mutate(set,d=>{d.topics=['example-amino-acid-structure'];});
 expect((await validate(root)).filter(i=>i.severity==='error'&&i.file===set)).toEqual([]);
});
