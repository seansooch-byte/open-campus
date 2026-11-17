import {it,expect,beforeEach,afterEach} from 'vitest';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate} from '../src/validate.js';
import {makeFixtureRoot,contentDir} from './helpers/fixture-root.js';
let root:string;
const C='courses/ex-100';
const topic=`${C}/topics/example-amino-acid-structure/topic.mdx`;
const cards=`${C}/topics/example-amino-acid-structure/cards.json`;
const set=`${C}/questions/example-amino-acids-discrete.json`;
const course=`${C}/course.json`;
beforeEach(async()=>{root=await makeFixtureRoot('.tmp-oc-');});
afterEach(async()=>{await rm(root,{recursive:true,force:true});});
async function write(file:string,text:string) {await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),text);}
async function mutate(file:string,fn:(data:any)=>void) {const data=JSON.parse(await readFile(join(root,file),'utf8'));fn(data);await write(file,JSON.stringify(data));}
async function has(rule:string) {expect((await validate(root)).some(i=>i.rule===rule&&i.severity==='error')).toBe(true);}
it('fixture content validates and reports verification counts',async()=>{
 const result=await validate(contentDir);expect(result.filter(i=>i.severity==='error')).toEqual([]);
 expect(result.some(i=>/^unverified: \d+$/.test(i.message))).toBe(true);
},60_000);
it('schema fixture: malformed question',async()=>{await mutate(set,d=>{d.questions[0].choices.pop();});await has('schema');});
it('parse fixture: invalid JSON',async()=>{await write(set,'{');await has('parse');});
it('layout fixture: misplaced content',async()=>{await write('questions/bio-biochem/set.json','{}');await has('layout');});
it('body fixture: empty MDX body',async()=>{const raw=await readFile(join(root,topic),'utf8');await write(topic,raw.slice(0,raw.indexOf('\n---',4)+4));await has('body');});
it('path ID fixture: topic and deck directory mismatch',async()=>{await write(topic,(await readFile(join(root,topic),'utf8')).replace('id: example-amino-acid-structure','id: wrong-topic'));await has('path-id');await mutate(cards,d=>{d.topic_id='wrong-deck';});await has('path-id');});
it('path ID fixture: set filename mismatch',async()=>{await mutate(set,d=>{d.id='wrong-set';});await has('path-id');});
it('topic fixture: a drafted topic must be in the course plan',async()=>{
 const raw=await readFile(join(root,topic),'utf8');
 await write(`${C}/topics/unplanned/topic.mdx`,raw.replace('id: example-amino-acid-structure','id: unplanned').replace(/diagrams:[\s\S]*?(?=version:)/,''));await has('topic-ref');
});
it('topic fixture: content in a course with no course.json',async()=>{await rm(join(root,course));await has('course-ref');});
it('code fixture: a question code outside its set topics',async()=>{await mutate(set,d=>{d.questions[0].codes=['EX-9.9'];});await has('code');});
it('code fixture: a card code outside its topic',async()=>{await mutate(course,d=>{d.topics[0].codes=['EX-1.2'];d.topics[1].codes=['EX-1.1'];});await has('code');});
it('diagram fixture: missing asset',async()=>{await rm(join(root,dirname(topic),'diagrams/alpha-carbon.svg'));await has('diagram');});
it('deck topic fixture: orphan deck',async()=>{await rm(join(root,topic));await has('topic-ref');});
it('set topic fixture: a planned but undrafted topic',async()=>{await mutate(set,d=>{d.topics=['example-amino-acid-structure','example-peptide-bonds'];});await has('topic-ref');});
async function examFixture(name='good-exam') {
 await write(`${C}/questions/verified-set.json`,await readFile(new URL('./fixtures/verified-set.json',import.meta.url),'utf8'));
 await write(`${C}/exams/practice-1.json`,await readFile(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8'));
}
it('good exam fixture permits an eligible question',async()=>{await examFixture();expect((await validate(root)).filter(i=>i.severity==='error')).toEqual([]);});
it('exam reference fixture: missing question',async()=>{await examFixture('bad-exam');await has('exam-ref');});
it('exam reference fixture: missing set',async()=>{await examFixture();await mutate(`${C}/exams/practice-1.json`,d=>{d.items.push({set_id:'missing-set'});});await has('exam-ref');});
it.each(['example','missing-verification','disputed','clinical-pending','clinical-rejected'])('exam gating fixture: %s',async(mode)=>{
 await examFixture();await mutate(`${C}/questions/verified-set.json`,d=>{
  if(mode==='example') d.example=true;
  if(mode==='missing-verification') delete d.verification;
  if(mode==='disputed') d.questions[0].verification={...d.verification,result:'disputed'};
  if(mode.startsWith('clinical')) {d.questions[0].clinical=true;d.questions[0].sean_review=mode==='clinical-pending'?'pending':'rejected';}
 });await has('exam-eligibility');
});
it('duplicate question fixture',async()=>{await mutate(set,d=>{d.questions.push(d.questions[0]);});await has('schema');});
it('duplicate card fixture',async()=>{await mutate(cards,d=>{d.cards.push(d.cards[0]);});await has('unique-id');});
it('verification status counts include inherited disputed and clinical pending items',async()=>{
 await mutate(set,d=>{d.verification={drafted_by:'claude',verified_by:'codex',model:'fixture',date:'2026-10-07',result:'disputed'};d.questions[0].clinical=true;d.questions[0].sean_review='pending';});
 const result=await validate(root);expect(result.some(i=>i.message===`disputed: ${2}`)).toBe(true);expect(result.some(i=>i.message==='clinical-pending: 1')).toBe(true);
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
it('set topics fixture: a set must name its topics, non-empty and unique',async()=>{
 await mutate(set,d=>{delete d.topics;});await has('schema');
 await mutate(set,d=>{d.topics=[];});await has('schema');
 await mutate(set,d=>{d.topics=['example-amino-acid-structure','example-amino-acid-structure'];});await has('schema');
});
it('set topics fixture: a topic not in the plan is a topic-ref error',async()=>{await mutate(set,d=>{d.topics=['example-amino-acid-structure','no-such-topic'];});await has('topic-ref');});
