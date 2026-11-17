import { dirname, basename, join } from 'node:path';
import { access, readFile } from 'node:fs/promises';
import { validateSmiles } from './diagrams/index.js';
import { isExamEligible, courseCoverage, type QuestionSet, type Standard, type Course } from '@open-campus/schema';
import {loadContent,courseOf,type Issue,type Item} from './content.js';

const tierRank=(t:string)=>Number(t.slice(1));

export async function validate(root:string):Promise<Issue[]> {
 const {items,issues}=await loadContent(root);
 const error=(file:string,rule:string,message:string)=>issues.push({file,rule,message,severity:'error'});
 const standards=items.filter(i=>i.type==='standard');
 for(const {file,data} of standards) if(basename(file,'.json')!==data.id) error(file,'path-id','Standard ID must match filename');
 const allStandards=standards.map(i=>i.data as Standard);
 const courses=new Map<string,Course>();
 for(const {file,data} of items.filter(i=>i.type==='course')) {
  const c=data as Course;
  if(basename(dirname(file))!==c.id) error(file,'path-id','Course ID must match its directory');
  courses.set(basename(dirname(file)),c);
  // Contract item 1 (Mapped): anchors resolve, and from T1 every leaf code in the slice is covered.
  const r=courseCoverage(c,allStandards);
  for(const id of r.missingStandards) error(file,'anchor',`Missing standard ${id}`);
  for(const a of r.unknownAnchorCodes) error(file,'anchor',`${a.standard} has no code ${a.code}`);
  for(const code of r.duplicateCodes) error(file,'anchor',`Code ${code} is required by more than one anchor; topic codes would be ambiguous`);
  for(const u of r.unknown) error(file,'coverage',`${u.topic}: ${u.code} is not a leaf code of an anchored standard`);
  if(tierRank(c.tier)>=1) for(const m of r.missing) error(file,'coverage',`${m.standard} ${m.code} is not covered by any topic`);
 }
 const counts={unverified:0,disputed:0,'clinical-pending':0};
 const count=(v:any,fallback?:any)=>{
  const verification=v.verification??fallback;
  if(!verification) counts.unverified++;
  else if(verification.result==='disputed') counts.disputed++;
  if(v.clinical&&v.sean_review==='pending') counts['clinical-pending']++;
 };
 // Everything else belongs to a course; resolve it against that course's plan.
 const drafted=new Map<string,Set<string>>(), setsByCourse=new Map<string,Map<string,Item>>();
 const inCourse=(file:string)=>{const id=courseOf(file)!;const c=courses.get(id);if(!c) error(file,'course-ref',`No course.json for course ${id}`);return c;};
 for(const it of items) {
  if(it.type==='topic'||it.type==='cards') {
   const c=inCourse(it.file), dirId=basename(dirname(it.file)), id=it.type==='topic'?it.data.id:it.data.topic_id;
   if(id!==dirId) error(it.file,'path-id','ID must match topic directory');
   const planned=c?.topics.find(t=>t.id===dirId);
   if(c&&!planned) error(it.file,'topic-ref',`Topic ${dirId} is not in the ${c.id} plan`);
   if(it.type==='topic') {
    const seen=drafted.get(courseOf(it.file)!)??new Set();seen.add(dirId);drafted.set(courseOf(it.file)!,seen);
    for(const d of it.data.diagrams) {
     try {await access(join(root,dirname(it.file),d.file));} catch {error(it.file,'diagram',`Missing diagram ${d.file}`);continue;}
     if(d.kind==='smiles') {
      const smiPath=`${dirname(it.file)}/${d.file}`;
      try {validateSmiles(await readFile(join(root,smiPath),'utf8'),smiPath);} catch(e) {error(smiPath,'diagram',e instanceof Error?e.message:String(e));}
     }
    }
    count(it.data);
   } else {
    const seen=new Set<string>();
    for(const card of it.data.cards) {
     if(seen.has(card.id)) error(it.file,'unique-id',`Duplicate card ID ${card.id}`);seen.add(card.id);
     if(planned) for(const code of card.codes??[]) if(!planned.codes.includes(code)) error(it.file,'code',`${card.id}: ${code} is not a code of topic ${planned.id}`);
     count(card,it.data.verification);
    }
   }
  } else if(it.type==='questions') {
   const c=inCourse(it.file), d=it.data as QuestionSet;
   if(basename(it.file,'.json')!==d.id) error(it.file,'path-id','Set ID must match filename');
   const sets=setsByCourse.get(courseOf(it.file)!)??new Map();sets.set(d.id,it);setsByCourse.set(courseOf(it.file)!,sets);
   const topics=d.topics.map(id=>c?.topics.find(t=>t.id===id));
   d.topics.forEach((id,i)=>{if(c&&!topics[i]) error(it.file,'topic-ref',`Topic ${id} is not in the ${c.id} plan`);});
   const codes=new Set(topics.flatMap(t=>t?.codes??[]));
   for(const q of d.questions) {
    if(c) for(const code of q.codes) if(!codes.has(code)) error(it.file,'code',`${q.id}: ${code} is not a code of the set's topics`);
    count(q,d.verification);
   }
  }
 }
 // Every topic a deck or set relies on must be drafted, and exams draw only from their own course.
 for(const it of items) {
  const course=courseOf(it.file);
  if(it.type==='cards'&&!drafted.get(course!)?.has(it.data.topic_id)) error(it.file,'topic-ref',`Deck for ${it.data.topic_id} has no topic.mdx`);
  if(it.type==='questions') for(const t of it.data.topics) if(!drafted.get(course!)?.has(t)) error(it.file,'topic-ref',`Topic ${t} is not drafted`);
  if(it.type!=='exam') continue;
  inCourse(it.file);
  if(basename(it.file,'.json')!==it.data.id) error(it.file,'path-id','Exam ID must match filename');
  const sets=setsByCourse.get(course!)??new Map<string,Item>(), used=new Set<string>();
  for(const ref of it.data.items) {
   const set=sets.get(ref.set_id)?.data as QuestionSet|undefined;
   if(!set) {error(it.file,'exam-ref',`Missing set ${ref.set_id}`);continue;}
   const chosen:string[]=ref.question_ids??set.questions.map(q=>q.id);
   if(new Set(chosen).size!==chosen.length) error(it.file,'exam-ref',`Duplicate question_ids within item for ${set.id}`);
   for(const id of chosen) {
    if(used.has(`${set.id}/${id}`)) error(it.file,'exam-ref',`Duplicate exam entry ${set.id}/${id}`);
    used.add(`${set.id}/${id}`);
    const q=set.questions.find(q=>q.id===id);
    if(!q) error(it.file,'exam-ref',`Missing question ${id} in ${set.id}`);
    else if(!isExamEligible(q,set)) error(it.file,'exam-eligibility',`${set.id}/${id}: example, unverified, disputed, or clinical review not approved`);
   }
  }
 }
 for(const [name,total] of Object.entries(counts)) issues.push({file:'content',rule:'verification',message:`${name}: ${total}`,severity:'info'});
 return issues;
}
