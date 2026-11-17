import {describe,it,expect} from 'vitest';
import {readFile,readdir} from 'node:fs/promises';
import * as s from './index.js';
import {exportedSchemas} from './export.js';
const verification={drafted_by:'claude',verified_by:'codex',model:'independent-test',date:'2026-10-07',result:'pass'};
const question={id:'q-one',stem:'Pick one.',choices:['A','B','C','D'].map(key=>({key,text:`Choice ${key}`,explanation:`Reason ${key}`})),answer:'A',codes:['CA-4.1'],difficulty:1};
const topic={id:'topic',version:1,updated:'2026-10-07'};
const cases:[string,{safeParse:(data:unknown)=>{success:boolean}},object,object][]=[
 ['Verification',s.VerificationSchema,verification,{...verification,verified_by:'claude'}],
 ['DiagramRef',s.DiagramRefSchema,{id:'figure',file:'diagrams/figure.svg',kind:'svg',alt:'A figure'},{id:'figure',file:'../figure.svg',kind:'svg',alt:'A figure'}],
 ['TopicFrontmatter',s.TopicFrontmatterSchema,topic,{...topic,version:0}],
 ['Card',s.CardSchema,{id:'card',front:'Front',back:'Back',codes:['CA-4.1']},{id:'card',front:'Front',back:'Back',clinical:true}],
 ['CardDeck',s.CardDeckSchema,{topic_id:'topic',cards:[{id:'card',front:'Front',back:'Back'}]},{topic_id:'topic',cards:[]}],
 ['Question',s.QuestionSchema,question,{...question,choices:question.choices.slice(0,3)}],
 ['QuestionSet',s.QuestionSetSchema,{id:'set',title:'Set',topics:['topic-one'],questions:[question]},{id:'set',title:'Set',topics:['topic-one'],questions:[question,question]}],
 ['Exam',s.ExamSchema,{id:'practice-1',title:'Exam',time_minutes:90,items:[{set_id:'set'}]},{id:'practice-1',title:'Exam',time_minutes:90,items:[]}],
];
describe('schema contracts',()=>{
 for(const [name,schema,good,bad] of cases) {
  it(`${name} accepts valid data`,()=>expect(schema.safeParse(good).success).toBe(true));
  it(`${name} rejects invalid data`,()=>expect(schema.safeParse(bad).success).toBe(false));
 }
 it('rejects impossible dates and invalid slugs',()=>{
  expect(s.DateSchema.safeParse('2026-02-30').success).toBe(false);
  expect(s.IdSchema.safeParse('Upper_Case').success).toBe(false);
 });
 it('checks choice order, clinical review, and independent lanes on nested items',()=>{
  expect(s.QuestionSchema.safeParse({...question,choices:[...question.choices].reverse()}).success).toBe(false);
  expect(s.QuestionSchema.safeParse({...question,clinical:true}).success).toBe(false);
  expect(s.QuestionSchema.safeParse({...question,clinical:true,sean_review:'pending'}).success).toBe(true);
  expect(s.QuestionSchema.safeParse({...question,verification:{...verification,verified_by:'claude'}}).success).toBe(false);
  expect(s.TopicFrontmatterSchema.safeParse({...topic,clinical:true}).success).toBe(false);
 });



 it('defaults clinical to false, diagrams to empty and passage to null',()=>{
  expect(s.QuestionSchema.parse(question).clinical).toBe(false);
  expect(s.TopicFrontmatterSchema.parse(topic).diagrams).toEqual([]);
  expect(s.QuestionSetSchema.parse({id:'set',title:'Set',topics:['t'],questions:[question]}).passage).toBeNull();
 });
});
it('topic files reject plan fields, and questions need outline codes',()=>{
 expect(s.TopicFrontmatterSchema.safeParse({...topic,title:'Topic'}).success).toBe(false);
 expect(s.TopicFrontmatterSchema.safeParse({...topic,subject:'biology'}).success).toBe(false);
 expect(s.QuestionSchema.safeParse({...question,codes:[]}).success).toBe(false);
 expect(s.QuestionSchema.safeParse({...question,codes:['ca-4.1']}).success).toBe(false);
 expect(s.QuestionSchema.safeParse({...question,tags:{fc:'FC1',category:'1A',skill:'S1'}}).success).toBe(false);
});
it('committed JSON Schemas exactly match fresh exports',async()=>{
 const generated=exportedSchemas(), directory=new URL('../json-schema/',import.meta.url);
 expect((await readdir(directory)).sort()).toEqual(Object.keys(generated).map(k=>`${k}.json`).sort());
 for(const [name,json] of Object.entries(generated)) expect(await readFile(new URL(`${name}.json`,directory),'utf8')).toBe(json);
});
describe('exam eligibility',()=>{
 const q=s.QuestionSchema.parse(question), pass=s.VerificationSchema.parse(verification);
 it('allows independently verified nonclinical questions',()=>expect(s.isExamEligible(q,{verification:pass})).toBe(true));
 it('blocks missing, disputed, and example verification',()=>{
  expect(s.isExamEligible(q,{})).toBe(false);
  expect(s.isExamEligible(q,{verification:{...pass,result:'disputed'}})).toBe(false);
  expect(s.isExamEligible(q,{verification:pass,example:true})).toBe(false);
 });
 it('question verification overrides set verification in either direction',()=>{
  expect(s.isExamEligible({...q,verification:{...pass,result:'disputed'}},{verification:pass})).toBe(false);
  expect(s.isExamEligible({...q,verification:pass},{verification:{...pass,result:'disputed'}})).toBe(true);
  expect(s.isExamEligible({...q,verification:{...pass,result:'fixed'}},{})).toBe(true);
 });
 it.each(['pending','rejected','approved'] as const)('clinical review %s',review=>expect(s.isExamEligible({...q,clinical:true,sean_review:review},{verification:pass})).toBe(review==='approved'));
});

it('question sets name their topics: non-empty, unique ids, main topic first',()=>{
 const base={id:'set',title:'Set',questions:[question]};
 expect(s.QuestionSetSchema.safeParse(base).success).toBe(false);
 expect(s.QuestionSetSchema.safeParse({...base,topics:[]}).success).toBe(false);
 expect(s.QuestionSetSchema.safeParse({...base,topics:['a-topic','a-topic']}).success).toBe(false);
 expect(s.QuestionSetSchema.safeParse({...base,topics:['A Topic']}).success).toBe(false);
 expect(s.QuestionSetSchema.safeParse({...base,topics:['main-topic','other-topic']}).success).toBe(true);
});
