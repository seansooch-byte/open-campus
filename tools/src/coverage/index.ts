import type {Item} from '../content.js';
import {courseOf} from '../content.js';
import {courseCoverage,type Course,type Standard} from '@open-campus/schema';
// Per course, per outline code: how many plan topics cover it, how many are drafted, and how many
// cards and questions exist. Example items count only when asked.
export type CodeRow={code:string;planned:number;drafted:number;cards:number;questions:number;gaps:string[]};
export type CourseReport={id:string;code:string;title:string;drafted:{topics:number;of:number};rows:CodeRow[]};
export type Report={options:{minQuestions:number;includeExamples:boolean};courses:CourseReport[]};
export type Options={minQuestions?:number;includeExamples?:boolean};
export function buildReport(items:Item[],{minQuestions=10,includeExamples=false}:Options={}):Report {
 const standards=items.filter(i=>i.type==='standard').map(i=>i.data as Standard);
 const counted=(d:any)=>includeExamples||!d.example;
 const courses=items.filter(i=>i.type==='course').map(i=>{
  const c=i.data as Course, dir=courseOf(i.file)!, mine=items.filter(x=>courseOf(x.file)===dir);
  const drafted=new Set(mine.filter(x=>x.type==='topic'&&counted(x.data)).map(x=>x.data.id as string));
  const codesOf=new Map(c.topics.map(t=>[t.id,t.codes]));
  const rows:CodeRow[]=courseCoverage(c,standards).rows.map(r=>({code:r.code,planned:r.topics.length,drafted:r.topics.filter(t=>drafted.has(t)).length,cards:0,questions:0,gaps:[]}));
  const row=(code:string)=>rows.find(r=>r.code===code);
  for(const x of mine) {
   if(x.type==='cards'&&counted(x.data)) for(const card of x.data.cards) for(const code of card.codes??codesOf.get(x.data.topic_id)??[]) {const r=row(code);if(r) r.cards++;}
   if(x.type==='questions'&&counted(x.data)) for(const q of x.data.questions) for(const code of q.codes) {const r=row(code);if(r) r.questions++;}
  }
  for(const r of rows) {
   if(!r.drafted) r.gaps.push('no drafted topic');
   else if(r.questions<minQuestions) r.gaps.push(`questions ${r.questions} < ${minQuestions}`);
  }
  return {id:c.id,code:c.code,title:c.title,drafted:{topics:c.topics.filter(t=>drafted.has(t.id)).length,of:c.topics.length},rows};
 });
 return {options:{minQuestions,includeExamples},courses};
}
export function formatReport(report:Report):string {
 const out:string[]=[];
 for(const c of report.courses) {
  out.push(`${c.code} ${c.title}: ${c.drafted.topics} of ${c.drafted.of} topics drafted`,'code      planned drafted cards questions  gaps');
  for(const r of c.rows) out.push(`${r.code.padEnd(9)} ${String(r.planned).padStart(7)} ${String(r.drafted).padStart(7)} ${String(r.cards).padStart(5)} ${String(r.questions).padStart(9)}  ${r.gaps.join('; ')}`);
  out.push('');
 }
 return out.join('\n');
}
