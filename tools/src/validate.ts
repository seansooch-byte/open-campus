import { dirname, basename, join } from 'node:path';
import { access, readFile } from 'node:fs/promises';
import { validateSmiles } from './diagrams/index.js';
import { isExamEligible, type Taxonomy, type QuestionSet } from '@open-campus/schema';
import {loadContent,type Issue} from './content.js';
import {bannedDomain} from './originality/config.js';
const expectedCategories:Record<string,string[]>={FC1:['1A','1B','1C','1D'],FC2:['2A','2B','2C'],FC3:['3A','3B'],FC4:['4A','4B','4C','4D','4E'],FC5:['5A','5B','5C','5D','5E'],FC6:['6A','6B','6C'],FC7:['7A','7B','7C'],FC8:['8A','8B','8C'],FC9:['9A','9B'],FC10:['10A']};
export async function validate(root:string):Promise<Issue[]> {
 const {items,issues}=await loadContent(root);
 const error=(file:string,rule:string,message:string)=>issues.push({file,rule,message,severity:'error'});
 const taxonomy=items.find(i=>i.type==='taxonomy')?.data as Taxonomy|undefined;
 if(!taxonomy) error('taxonomy/aamc-outline.json','taxonomy','A valid taxonomy is required');
 const categories=new Map(taxonomy?.foundationalConcepts.flatMap(fc=>fc.categories.map(c=>[c.id,fc.id] as const))??[]);
 const skills=new Map(taxonomy?.skills.map(s=>[s.id,s.kind] as const)??[]);
 const fcs=new Set(taxonomy?.foundationalConcepts.map(fc=>fc.id));
 const sections=new Set(taxonomy?.sections.map(s=>s.id));
 if(taxonomy) {
  for(const [name,codes] of [['sections',taxonomy.sections.map(x=>x.id)],['concepts',taxonomy.foundationalConcepts.map(x=>x.id)],['categories',taxonomy.foundationalConcepts.flatMap(x=>x.categories.map(c=>c.id))],['skills',taxonomy.skills.map(x=>x.id)]] as const) if(new Set(codes).size!==codes.length) error('taxonomy/aamc-outline.json','taxonomy',`Duplicate ${name} codes`);
  const exactSet=(name:string,actual:string[],expected:string[])=>{
   for(const code of expected) if(!actual.includes(code)) error('taxonomy/aamc-outline.json','taxonomy',`Missing ${name} code ${code}`);
   for(const code of actual) if(!expected.includes(code)) error('taxonomy/aamc-outline.json','taxonomy',`Unexpected ${name} code ${code}`);
  };
  exactSet('section',taxonomy.sections.map(x=>x.id),['bio-biochem','chem-phys','psych-soc','cars']);
  exactSet('concept',taxonomy.foundationalConcepts.map(x=>x.id),Object.keys(expectedCategories));
  for(const fc of taxonomy.foundationalConcepts) if(expectedCategories[fc.id]) exactSet(`${fc.id} category`,fc.categories.map(c=>c.id),expectedCategories[fc.id]!);
  exactSet('skill',taxonomy.skills.map(x=>x.id),['S1','S2','S3','S4','C1','C2','C3']);
  for(const fc of taxonomy.foundationalConcepts) {
   const n=Number(fc.id.slice(2)), expected=n<=3?'bio-biochem':n<=5?'chem-phys':'psych-soc';
   if(fc.section!==expected||!sections.has(fc.section)) error('taxonomy/aamc-outline.json','taxonomy',`${fc.id} has incorrect primary section`);
   for(const c of fc.categories) if(Number(/^(\d+)[A-E]$/.exec(c.id)?.[1])!==n) error('taxonomy/aamc-outline.json','taxonomy',`${c.id} does not belong to ${fc.id}`);
  }
  for(const skill of taxonomy.skills) if(skill.kind!==(skill.id.startsWith('C')?'cars':'sirs')) error('taxonomy/aamc-outline.json','taxonomy',`${skill.id} has incorrect skill kind`);
 }
 const topics=new Map(items.filter(i=>i.type==='topic').map(i=>[i.data.id,i]));
 const sets=new Map(items.filter(i=>i.type==='questions').map(i=>[i.data.id,i]));
 const ids=new Map<string,Set<string>>();
 const counts={unverified:0,disputed:0,'clinical-pending':0};
 const count=(v:any, fallback?:any)=>{
  const verification=v.verification??fallback;
  if(!verification) counts.unverified++;
  else if(verification.result==='disputed') counts.disputed++;
  if(v.clinical&&v.sean_review==='pending') counts['clinical-pending']++;
 };
 for(const {file,type,data:d} of items) {
  if(type!=='taxonomy') {
   const id=type==='cards'?d.topic_id:d.id;
   const seen=ids.get(type)??new Set<string>();
   if(seen.has(id)) error(file,'unique-id',`Duplicate ${type} ID ${id}`);
   seen.add(id);ids.set(type,seen);
  }
  if(type==='exam'||type==='school'||type==='path'||type==='guide') {
   const base=basename(file).replace(/\.(json|mdx)$/,'');
   if(d.id!==base) error(file,'path-id','ID must match filename');
   if(type==='exam'&&!/^fl-\d+$/.test(base)) error(file,'path-id','Exam filename must be fl-<n>.json');
  }
  if(type==='topic'||type==='cards') {
   if((type==='topic'?d.id:d.topic_id)!==basename(dirname(file))) error(file,'path-id','ID must match topic directory');
   if(type==='topic') {
    if(d.subject!==file.split('/')[1]) error(file,'path-id','Subject must match directory');
    for(const c of d.categories) if(!categories.has(c)) error(file,'tag',`Unknown category ${c}`);
    for(const sk of d.skills??[]) if(!skills.has(sk)) error(file,'tag',`Unknown skill ${sk}`);
    for(const ref of d.prerequisites) {
     if(ref===d.id) error(file,'prerequisite',`Topic ${ref} lists itself as a prerequisite`);
     else if(!topics.has(ref)) error(file,'prerequisite',`Missing topic ${ref}`);
    }
    for(const diagram of d.diagrams) {
     try {await access(join(root,dirname(file),diagram.file));} catch {error(file,'diagram',`Missing diagram ${diagram.file}`);continue;}
     if(diagram.kind==='smiles') {
      const smiPath=`${dirname(file)}/${diagram.file}`;
      try {validateSmiles(await readFile(join(root,smiPath),'utf8'),smiPath);} catch(e) {error(smiPath,'diagram',e instanceof Error?e.message:String(e));}
     }
    }
    count(d);
   } else {
    if(!topics.has(d.topic_id)) error(file,'topic-ref',`Missing topic ${d.topic_id}`);
    const seen=new Set<string>();
    for(const card of d.cards) {
     if(seen.has(card.id)) error(file,'unique-id',`Duplicate card ID ${card.id}`);seen.add(card.id);
     for(const c of card.categories??[]) if(!categories.has(c)) error(file,'tag',`Unknown category ${c}`);
     count(card,d.verification);
    }
   }
  } else if(type==='questions') {
   if(basename(file,'.json')!==d.id||file.split('/')[1]!==d.section) error(file,'path-id','Set ID and section must match path');
   if(!sections.has(d.section)) error(file,'tag',`Unknown section ${d.section}`);
   for(const t of d.topics) if(!topics.has(t)) error(file,'topic-ref',`Missing topic ${t}`);
   for(const q of d.questions) {
    if(!fcs.has(q.tags.fc)||categories.get(q.tags.category)!==q.tags.fc) error(file,'tag',`${q.id}: category must belong to foundational concept`);
    if(skills.get(q.tags.skill)!==(d.section==='cars'?'cars':'sirs')) error(file,'tag',`${q.id}: skill does not match section`);
    count(q,d.verification);
   }
  } else if(type==='exam') {
   const used=new Set<string>();
   for(const section of d.sections) for(const ref of section.items) {
    const set=sets.get(ref.set_id)?.data as QuestionSet|undefined;
    if(!set) {error(file,'exam-ref',`Missing set ${ref.set_id}`);continue;}
    if(set.section!==section.section) error(file,'exam-ref',`Set ${set.id} section mismatch`);
    const chosen:string[]=ref.question_ids??set.questions.map(q=>q.id);
    if(new Set(chosen).size!==chosen.length) error(file,'exam-ref',`Duplicate question_ids within item for ${set.id}`);
    for(const id of chosen) {
     if(used.has(`${set.id}/${id}`)) error(file,'exam-ref',`Duplicate exam entry ${set.id}/${id}`);
     used.add(`${set.id}/${id}`);
     const q=set.questions.find(q=>q.id===id);
     if(!q) error(file,'exam-ref',`Missing question ${id} in ${set.id}`);
     else if(!isExamEligible(q,set)) error(file,'exam-eligibility',`${set.id}/${id}: example, unverified, disputed, or clinical review not approved`);
    }
   }
  } else if(type==='school') {
   for(const fact of d.facts) if(bannedDomain(fact.source_url)) error(file,'school-source',`Banned domain for fact ${fact.key}`);
   count(d);
  } else if(type!=='taxonomy') count(d);
 }
 const state=new Map<string,'visiting'|'done'>();
 const visit=(id:string,path:string[])=>{
  const topic=topics.get(id);
  if(!topic||state.get(id)==='done') return;
  if(state.get(id)==='visiting') {error(topic.file,'prerequisite',`Prerequisite cycle: ${[...path.slice(path.indexOf(id)),id].join(' -> ')}`);return;}
  state.set(id,'visiting');
  for(const ref of topic.data.prerequisites as string[]) if(ref!==id) visit(ref,[...path,id]);
  state.set(id,'done');
 };
 for(const id of topics.keys()) visit(id,[]);
 for(const [name,total] of Object.entries(counts)) issues.push({file:'content',rule:'verification',message:`${name}: ${total}`,severity:'info'});
 return issues;
}
