// The publish pipeline, split across two machines (the hybrid in DECISIONS.md):
//   cloud:  prepare  rebuild the hand-off branch claude/drafts from main, carry over unverified drafts,
//                    and write a brief for each of the next N topics to .drafts/briefs/
//           ingest   turn the drafting agent's .drafts/out/*.json into topic files, with mechanical findings
//   laptop: verify   check every unverified draft with Codex (revising with Claude) until it passes or is held
//   either: queue    print the derived queue
// Committing, pushing and shipping belong to the cloud routine prompt and tools/publish/daily.sh.
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync,appendFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import matter from 'gray-matter';
import {CourseSchema,StandardSchema,type Course,type Standard} from '@open-campus/schema';
import {deriveQueue,pendingToCarry,type QueueEntry} from './queue.js';
import {DRAFT_SCHEMA,VERIFY_SCHEMA,draftPrompt,revisePrompt,verifyPrompt,lintDraft,type Context,type Draft,type Finding,type Verdict} from './prompts.js';
import {validate} from '../validate.js';
import {lintOriginality} from '../originality/index.js';

const ROOT=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const CONTENT=join(ROOT,'content');
const WORK=join(ROOT,'.drafts');
export const LOG=join(ROOT,'tools/publish/log.jsonl');
export const HANDOFF='claude/drafts';
const REVISE_MODEL=process.env.OC_REVISE_MODEL??'claude-opus-5-5';
const VERIFY_MODEL=process.env.OC_VERIFY_MODEL??'gpt-5.6-sol';
const MAX_ROUNDS=Number(process.env.OC_MAX_ROUNDS??4);
const MAX_PENDING=Number(process.env.OC_MAX_PENDING??40);
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});
const say=(m:string)=>console.log(`[${new Date().toISOString()}] ${m}`);
const keyOf=(e:{course:string;topic:string})=>`${e.course}/${e.topic}`;

type LogLine={date:string;course:string;topic:string;result:'published'|'held'|'error';rounds:number;notes:string};
function readLog():LogLine[] {return existsSync(LOG)?readFileSync(LOG,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l)):[];}
function writeLog(l:LogLine) {mkdirSync(join(ROOT,'tools/publish'),{recursive:true});appendFileSync(LOG,JSON.stringify(l)+'\n');}
/** A topic is held while its latest log line says held; delete that line to release it. */
function heldKeys():Set<string> {
 const last=new Map<string,string>();
 for(const l of readLog()) last.set(`${l.course}/${l.topic}`,l.result);
 return new Set([...last].filter(([,r])=>r==='held').map(([k])=>k));
}

type Plans={courses:Course[];standards:Standard[];drafted:Set<string>;unverified:Set<string>};
/** drafted: every planned topic with a topic.mdx; unverified: those whose frontmatter has no verification yet. */
function loadPlans():Plans {
 const courses:Course[]=[], drafted=new Set<string>(), unverified=new Set<string>();
 const dir=join(CONTENT,'courses');
 for(const id of existsSync(dir)?readdirSync(dir):[]) {
  const file=join(dir,id,'course.json');
  if(!existsSync(file)) continue;
  const c=CourseSchema.parse(JSON.parse(readFileSync(file,'utf8')));
  courses.push(c);
  for(const t of c.topics) {
   const mdx=join(dir,id,'topics',t.id,'topic.mdx');
   if(!existsSync(mdx)) continue;
   drafted.add(`${c.id}/${t.id}`);
   if(!matter(readFileSync(mdx,'utf8')).data.verification) unverified.add(`${c.id}/${t.id}`);
  }
 }
 const sdir=join(CONTENT,'standards');
 const standards=(existsSync(sdir)?readdirSync(sdir):[]).filter(f=>f.endsWith('.json')).map(f=>StandardSchema.parse(JSON.parse(readFileSync(join(sdir,f),'utf8'))));
 return {courses,standards,drafted,unverified};
}

function run(cmd:string,args:string[],input='',timeoutMin=25):string {
 const r=spawnSync(cmd,args,{cwd:ROOT,input,encoding:'utf8',maxBuffer:64*1024*1024,timeout:timeoutMin*60_000});
 if(r.error) throw r.error;
 if(r.status!==0) throw new Error(`${cmd} ${args.slice(0,2).join(' ')} exited ${r.status}: ${(r.stderr||r.stdout).slice(-2000)}`);
 return r.stdout;
}
const git=(...a:string[])=>run('git',a);

/** The revising lane on the laptop: headless Claude, no tools, structured output. */
function claude(prompt:string):Draft {
 const out=JSON.parse(run('claude',['-p','--model',REVISE_MODEL,'--tools','','--no-session-persistence','--output-format','json','--json-schema',JSON.stringify(DRAFT_SCHEMA)],prompt));
 if(out.is_error||!out.structured_output) throw new Error(`claude lane: ${String(out.result).slice(0,500)}`);
 return out.structured_output as Draft;
}

/** The verifying lane: Codex, read-only sandbox, findings in a fixed schema. */
function codex(prompt:string):Verdict {
 const tmp=mkdtempSync(join(tmpdir(),'oc-verify-'));
 try {
  writeFileSync(join(tmp,'schema.json'),JSON.stringify(VERIFY_SCHEMA));
  run('codex',['exec','-m',VERIFY_MODEL,'-s','read-only','-C',ROOT,'--skip-git-repo-check','--ephemeral','--output-schema',join(tmp,'schema.json'),'-o',join(tmp,'out.json'),'-'],prompt);
  return JSON.parse(readFileSync(join(tmp,'out.json'),'utf8')) as Verdict;
 } finally {rmSync(tmp,{recursive:true,force:true});}
}

function paths(e:{course:string;topic:string}) {
 const dir=`content/courses/${e.course}/topics/${e.topic}`;
 return {dir,mdx:`${dir}/topic.mdx`,cards:`${dir}/cards.json`,questions:`content/courses/${e.course}/questions/${e.topic}-practice.json`};
}

function writeDraft(e:QueueEntry,d:Draft,verification?:Record<string,string>) {
 const p=paths(e);
 mkdirSync(join(ROOT,p.dir),{recursive:true});
 const v=verification?`verification:\n${Object.entries(verification).map(([k,val])=>`  ${k}: ${JSON.stringify(val)}`).join('\n')}\n`:'';
 writeFileSync(join(ROOT,p.mdx),`---\nid: ${e.topic}\nversion: 1\nupdated: '${today()}'\n${v}---\n${d.body.trim()}\n`);
 writeFileSync(join(ROOT,p.cards),JSON.stringify({topic_id:e.topic,cards:d.cards},null,1)+'\n');
 writeFileSync(join(ROOT,p.questions),JSON.stringify({id:`${e.topic}-practice`,title:`${e.title}: practice`,topics:[e.topic],questions:d.questions},null,1)+'\n');
}
function removeDraft(e:{course:string;topic:string}) {const p=paths(e);rmSync(join(ROOT,p.dir),{recursive:true,force:true});rmSync(join(ROOT,p.questions),{force:true});}

/** Schema and plan errors for this topic's files, from the repository validator. */
async function schemaFindings(e:{course:string;topic:string}):Promise<Finding[]> {
 const p=paths(e), mine=[p.mdx,p.cards,p.questions].map(f=>f.replace(/^content\//,''));
 return (await validate(CONTENT)).filter(i=>i.severity==='error'&&mine.includes(i.file)).map(i=>({file:i.file,where:i.rule,problem:i.message,fix:'make the file satisfy the schema and plan'}));
}

function example():Context['example'] {
 const dir=join(CONTENT,'courses/ge-111');
 return {body:readFileSync(join(dir,'topics/real-numbers/topic.mdx'),'utf8').replace(/^---[\s\S]*?---\n/,''),cards:readFileSync(join(dir,'topics/real-numbers/cards.json'),'utf8'),questions:readFileSync(join(dir,'questions/real-numbers-practice.json'),'utf8')};
}

function readDraft(e:QueueEntry):Draft {
 const p=paths(e);
 return {body:matter(readFileSync(join(ROOT,p.mdx),'utf8')).content.trim(),cards:JSON.parse(readFileSync(join(ROOT,p.cards),'utf8')).cards,questions:JSON.parse(readFileSync(join(ROOT,p.questions),'utf8')).questions};
}

function context(e:QueueEntry,plans:Plans):Context {
 const course=plans.courses.find(c=>c.id===e.course)!;
 const anchor=course.anchors.find(a=>plans.standards.some(s=>s.id===a.standard&&s.nodes.some(n=>e.codes.includes(n.code))))??course.anchors[0];
 return {entry:e,courseTitle:course.title,standard:plans.standards.find(s=>s.id===anchor?.standard),planTitles:course.topics.map(t=>t.title),example:example()};
}

/** Every planned topic as a queue entry, drafted or not (for looking up a draft's plan entry). */
function entries(plans:Plans):QueueEntry[] {
 return deriveQueue(plans.courses,new Set()).ready;
}

// ---------- cloud ----------

/** Rebuild the hand-off branch from main, carry over drafts the laptop has not verified yet, write the next briefs. */
async function prepare(count:number) {
 git('fetch','-q','origin','main');
 const hasHandoff=spawnSync('git',['fetch','-q','origin',`${HANDOFF}:refs/remotes/origin/${HANDOFF}`],{cwd:ROOT}).status===0;
 git('checkout','-q','-B',HANDOFF,'origin/main');
 let plans=loadPlans();
 const held=heldKeys();
 if(hasHandoff) {
  const onBranch=git('ls-tree','-r','--name-only',`origin/${HANDOFF}`,'content/courses').split('\n')
   .map(f=>/^content\/courses\/([^/]+)\/topics\/([^/]+)\/topic\.mdx$/.exec(f)).filter(m=>!!m).map(m=>`${m![1]}/${m![2]}`);
  const carry=pendingToCarry(onBranch,plans.drafted,held);
  for(const k of carry) {const [course,topic]=k.split('/') as [string,string];const p=paths({course,topic});git('checkout',`origin/${HANDOFF}`,'--',p.dir,p.questions);}
  say(`carried ${carry.length} unverified draft${carry.length===1?'':'s'} from ${HANDOFF}`);
  plans=loadPlans();
 }
 rmSync(WORK,{recursive:true,force:true});
 mkdirSync(join(WORK,'briefs'),{recursive:true});mkdirSync(join(WORK,'out'),{recursive:true});
 writeFileSync(join(WORK,'schema.json'),JSON.stringify(DRAFT_SCHEMA,null,1));
 const room=Math.max(0,MAX_PENDING-plans.unverified.size);
 if(room<count) say(`${plans.unverified.size} drafts await verification (limit ${MAX_PENDING}); drafting ${room}`);
 const q=deriveQueue(plans.courses,plans.drafted,held), picked=q.ready.slice(0,Math.min(count,room));
 for(const e of picked) writeFileSync(join(WORK,'briefs',`${e.course}__${e.topic}.md`),draftPrompt(context(e,plans)));
 say(`wrote ${picked.length} brief${picked.length===1?'':'s'}: ${picked.map(keyOf).join(', ')||'none'}`);
}

/** Read one drafted topic from .drafts/out: a folder <course>__<topic>/ holding body.mdx, cards.json and
 * questions.json (cards and questions as arrays), or a single <course>__<topic>.json with all three. */
function readOut(name:string):Draft {
 const at=join(WORK,'out',name);
 if(name.endsWith('.json')) return JSON.parse(readFileSync(at,'utf8'));
 const arr=(f:string)=>{const v=JSON.parse(readFileSync(join(at,f),'utf8'));return Array.isArray(v)?v:v.cards??v.questions;};
 return {body:readFileSync(join(at,'body.mdx'),'utf8'),cards:arr('cards.json'),questions:arr('questions.json')};
}

/** Turn each drafted topic in .drafts/out into topic files; report findings so the drafting agent can fix them. */
async function ingest():Promise<number> {
 const plans=loadPlans(), all=entries(plans);
 const outs=existsSync(join(WORK,'out'))?readdirSync(join(WORK,'out')).filter(f=>!f.startsWith('.')):[];
 let problems=0;
 for(const f of outs) {
  const [course,topic]=f.replace(/\.json$/,'').split('__');
  const e=all.find(x=>x.course===course&&x.topic===topic);
  if(!e) {console.log(`${f}: not a planned topic`);problems++;continue;}
  let d:Draft;
  try {d=readOut(f);} catch(err) {console.log(`${f}: cannot read: ${String(err).slice(0,300)}`);problems++;continue;}
  if(!d||typeof d.body!=='string'||!Array.isArray(d.cards)||!Array.isArray(d.questions)) {console.log(`${f}: needs body.mdx, a cards array and a questions array (see .drafts/schema.json)`);problems++;continue;}
  writeDraft(e,d);
  const findings=[...lintDraft(d,e.codes),...await schemaFindings(e)];
  for(const x of findings) console.log(`${f}: ${x.where}: ${x.problem} (fix: ${x.fix})`);
  if(findings.length) problems+=findings.length; else console.log(`${f}: ok`);
 }
 console.log(problems?`${problems} problem${problems===1?'':'s'}: fix the files in .drafts/out and run ingest again`:`ingested ${outs.length} draft${outs.length===1?'':'s'} with no problems`);
 return problems?1:0;
}

// ---------- laptop ----------

/** Bring the hand-off branch's unverified drafts into this tree (they stay on the branch until main has them). */
function fetchPending(plans:Plans):Plans {
 if(spawnSync('git',['fetch','-q','origin',`${HANDOFF}:refs/remotes/origin/${HANDOFF}`],{cwd:ROOT}).status!==0) {say(`no ${HANDOFF} branch yet`);return plans;}
 const onBranch=git('ls-tree','-r','--name-only',`origin/${HANDOFF}`,'content/courses').split('\n')
  .map(f=>/^content\/courses\/([^/]+)\/topics\/([^/]+)\/topic\.mdx$/.exec(f)).filter(m=>!!m).map(m=>`${m![1]}/${m![2]}`);
 for(const k of pendingToCarry(onBranch,plans.drafted,heldKeys())) {const [course,topic]=k.split('/') as [string,string];const p=paths({course,topic});git('checkout',`origin/${HANDOFF}`,'--',p.dir,p.questions);git('reset','-q','--',p.dir,p.questions);}
 return loadPlans();
}

async function verifyOne(e:QueueEntry,plans:Plans):Promise<LogLine> {
 const ctx=context(e,plans), p=paths(e);
 let draft=readDraft(e);
 const history:string[]=[];
 for(let round=1;round<=MAX_ROUNDS;round++) {
  writeDraft(e,draft);
  let findings=[...lintDraft(draft,e.codes),...await schemaFindings(e)];
  if(!findings.length) {
   say(`${keyOf(e)}: verify round ${round} with ${VERIFY_MODEL}`);
   const v=codex(verifyPrompt(ctx,[p.mdx,p.cards,p.questions]));
   findings=v.pass?[]:v.findings.length?v.findings:[{file:'topic',where:'all',problem:'verifier failed the topic without findings',fix:'recheck every item'}];
   history.push(`round ${round}: ${findings.length} finding${findings.length===1?'':'s'}${findings.length?` (${findings.map(f=>f.problem).join('; ').slice(0,300)})`:''}`);
   if(!findings.length) {
    const result=round===1?'pass':'fixed';
    const notes=`Drafted by Claude in the cloud drafting run; revised by ${REVISE_MODEL} where noted. ${history.join('. ')}.`;
    writeDraft(e,draft,{drafted_by:'claude',verified_by:'codex',model:VERIFY_MODEL,date:today(),result,notes});
    say(`${keyOf(e)}: ${result} after ${round} round${round===1?'':'s'}`);
    return {date:today(),course:e.course,topic:e.topic,result:'published',rounds:round,notes:history.join('. ')};
   }
  } else history.push(`round ${round}: ${findings.length} mechanical finding${findings.length===1?'':'s'}`);
  say(`${keyOf(e)}: round ${round}, ${findings.length} finding${findings.length===1?'':'s'}${round<MAX_ROUNDS?'; revising':'; holding'}`);
  if(round<MAX_ROUNDS) draft=claude(revisePrompt(ctx,draft,findings));
 }
 removeDraft(e);
 return {date:today(),course:e.course,topic:e.topic,result:'held',rounds:MAX_ROUNDS,notes:history.join('. ')};
}

async function verify(count:number) {
 const plans=fetchPending(loadPlans());
 const all=entries(plans), pending=all.filter(e=>plans.unverified.has(keyOf(e)));
 const picked=pending.slice(0,count);
 say(`${pending.length} unverified draft${pending.length===1?'':'s'}; checking ${picked.length}`);
 let published=0;
 try {
  for(const e of picked) {
   try {const line=await verifyOne(e,plans);writeLog(line);if(line.result==='published') published++;}
   catch(err) {
    // A lane failure (sign-in, timeout) is not the topic's fault: log it and stop; the draft stays on the hand-off branch.
    writeLog({date:today(),course:e.course,topic:e.topic,result:'error',rounds:0,notes:String(err).slice(0,500)});
    say(`${keyOf(e)}: lane error, stopping: ${String(err).slice(0,500)}`);
    break;
   }
  }
 } finally {
  // Main only ever holds verified topics: drop every draft this run did not verify (it waits on the branch).
  const now=loadPlans();
  for(const e of all) if(now.unverified.has(keyOf(e))) removeDraft(e);
 }
 const issues=[...await validate(CONTENT),...await lintOriginality(CONTENT)].filter(i=>i.severity==='error');
 if(issues.length) {for(const i of issues) console.log(`${i.file}: ${i.rule}: ${i.message}`);throw new Error(`gate failed with ${issues.length} errors`);}
 say(`verified and ready to publish: ${published} of ${picked.length}`);
}

function printQueue() {
 const plans=loadPlans(), q=deriveQueue(plans.courses,plans.drafted,heldKeys());
 console.log(`${q.ready.length} ready, ${plans.unverified.size} unverified here, ${q.blocked.length} held`);
 q.ready.forEach((e,i)=>console.log(`${String(i+1).padStart(5)}  ${e.code}  ${e.topic}`));
 q.blocked.forEach(b=>console.log(`held  ${b.course}/${b.topic}: ${b.reason}`));
}

const [command,...rest]=process.argv.slice(2);
const countArg=rest.includes('--count')?Number(rest[rest.indexOf('--count')+1]):undefined;
if(command==='queue') printQueue();
else if(command==='prepare') await prepare(countArg??Number(process.env.OC_DRAFT_COUNT??12));
else if(command==='ingest') process.exitCode=await ingest();
else if(command==='verify') await verify(countArg??Number(process.env.OC_VERIFY_COUNT??40));
else {console.error('Usage: run.ts queue | prepare [--count N] | ingest | verify [--count N]');process.exitCode=2;}
