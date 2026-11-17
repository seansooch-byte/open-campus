import {describe,it,expect} from 'vitest';
import {readFile,readdir} from 'node:fs/promises';
import * as s from './index.js';
import {exportedSchemas} from './export.js';
const verification={drafted_by:'claude',verified_by:'codex',model:'independent-test',date:'2026-10-07',result:'pass'};
const question={id:'q-one',stem:'Pick one.',choices:['A','B','C','D'].map(key=>({key,text:`Choice ${key}`,explanation:`Reason ${key}`})),answer:'A',tags:{fc:'FC1',category:'1A',skill:'S1'},difficulty:1};
const taxonomy={outlineVersion:'2020 outline',source:'https://example.org/outline',retrieved:'2026-10-07',note:'Original titles',sections:[{id:'bio-biochem',title:'Cells'}],foundationalConcepts:[{id:'FC1',title:'Molecules',section:'bio-biochem',categories:[{id:'1A',title:'Proteins'}]}],skills:[{id:'S1',title:'Recall',kind:'sirs'},{id:'C1',title:'Locate',kind:'cars'}]};
const cases:[string,{safeParse:(data:unknown)=>{success:boolean}},object,object][]=[
 ['Verification',s.VerificationSchema,verification,{...verification,verified_by:'claude'}],
 ['AamcTag',s.AamcTagSchema,question.tags,{...question.tags,category:'99Z'}],
 ['DiagramRef',s.DiagramRefSchema,{id:'figure',file:'diagrams/figure.svg',kind:'svg',alt:'A figure'},{id:'figure',file:'../figure.svg',kind:'svg',alt:'A figure'}],
 ['TopicFrontmatter',s.TopicFrontmatterSchema,{id:'topic',title:'Topic',subject:'biology',categories:['1A'],learning_objectives:['Learn'],diagrams:[],version:1,updated:'2026-10-07'},{id:'topic',title:'Topic',subject:'biology',categories:['1A'],learning_objectives:[],diagrams:[],version:1,updated:'2026-10-07'}],
 ['Card',s.CardSchema,{id:'card',front:'Front',back:'Back'},{id:'card',front:'Front',back:'Back',clinical:true}],
 ['CardDeck',s.CardDeckSchema,{topic_id:'topic',cards:[{id:'card',front:'Front',back:'Back'}]},{topic_id:'topic',cards:[]}],
 ['Question',s.QuestionSchema,question,{...question,choices:question.choices.slice(0,3)}],
 ['QuestionSet',s.QuestionSetSchema,{id:'set',section:'bio-biochem',title:'Set',topics:['topic-one'],passage:null,questions:[question]},{id:'set',section:'bio-biochem',title:'Set',topics:['topic-one'],passage:null,questions:[question,question]}],
 ['Exam',s.ExamSchema,{id:'fl-1',title:'Exam',sections:[{section:'bio-biochem',title:'Biology',time_minutes:95,items:[{set_id:'set'}]}]},{id:'fl-1',title:'Exam',sections:[]}],
 ['GuideFrontmatter',s.GuideFrontmatterSchema,{id:'guide',title:'Guide',kind:'amcas',audience:'both',sources:[]},{id:'guide',title:'Guide',kind:'amcas',audience:'both',sources:[],clinical:true}],
 ['SchoolProfile',s.SchoolProfileSchema,{id:'school',name:'School',degree:'MD',state:'MI',website:'https://example.edu',facts:[{key:'name',value:'School',source_url:'https://example.edu',as_of:'2026-10-07'}]},{id:'school',name:'School',degree:'MD',state:'MI',website:'https://example.edu',facts:[{key:'name',value:'School',source_url:'https://example.edu'}]}],
 ['Path',s.PathSchema,{id:'path',title:'Path',track:'both',steps:[{id:'step',title:'Step',timing:'Before applying',description:'Prepare'}]},{id:'path',title:'Path',track:'both',steps:[{id:'bad slug',title:'Step',timing:'Soon',description:'Prepare'}]}],
 ['Taxonomy',s.TaxonomySchema,taxonomy,{...taxonomy,foundationalConcepts:[{...taxonomy.foundationalConcepts[0]!,categories:[{id:'2A',title:'Proteins'}]}]}],
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
  const good=cases.find(c=>c[0]==='TopicFrontmatter')![2];
  expect(s.TopicFrontmatterSchema.safeParse({...good,clinical:true}).success).toBe(false);
 });
 it('taxonomy enforces https source, date format, skill kind and word limit',()=>{
  expect(s.TaxonomySchema.safeParse({...taxonomy,source:'http://example.org'}).success).toBe(false);
  expect(s.TaxonomySchema.safeParse({...taxonomy,retrieved:'10/07/2026'}).success).toBe(false);
  expect(s.TaxonomySchema.safeParse({...taxonomy,skills:[{id:'S1',title:'Recall',kind:'other'}]}).success).toBe(false);
  expect(s.TaxonomySchema.safeParse({...taxonomy,sections:[{id:'bio-biochem',title:'one two three four five six seven eight nine'}]}).success).toBe(false);
  expect(s.TaxonomySchema.safeParse({...taxonomy,extra:1}).success).toBe(false);
 });
 it('topics may have no categories only when skills are given, and reject crosswalk fields',()=>{
  const t=cases.find(c=>c[0]==='TopicFrontmatter')![2] as any;
  expect(s.TopicFrontmatterSchema.safeParse({...t,categories:[]}).success).toBe(false);
  expect(s.TopicFrontmatterSchema.safeParse({...t,categories:[],skills:['S4']}).success).toBe(true);
  expect(s.TopicFrontmatterSchema.safeParse({...t,skills:[]}).success).toBe(false);
  expect(s.TopicFrontmatterSchema.safeParse({...t,aa_lesson:'lesson-one'}).success).toBe(false);
 });
 it('uses AAMC skill and section ids',()=>{
  expect(s.SkillSchema.options).toEqual(['S1','S2','S3','S4','C1','C2','C3']);
  expect(s.SectionSchema.options).toEqual(['bio-biochem','chem-phys','psych-soc','cars']);
 });
 it('defaults clinical to false and prerequisites to empty',()=>{
  expect(s.QuestionSchema.parse(question).clinical).toBe(false);
  expect(s.TopicFrontmatterSchema.parse(cases.find(c=>c[0]==='TopicFrontmatter')![2]).prerequisites).toEqual([]);
 });
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
 const base={id:'set',section:'bio-biochem',title:'Set',passage:null,questions:[question]};
 expect(s.QuestionSetSchema.safeParse(base).success).toBe(false);
 expect(s.QuestionSetSchema.safeParse({...base,topics:[]}).success).toBe(false);
 expect(s.QuestionSetSchema.safeParse({...base,topics:['a-topic','a-topic']}).success).toBe(false);
 expect(s.QuestionSetSchema.safeParse({...base,topics:['A Topic']}).success).toBe(false);
 expect(s.QuestionSetSchema.safeParse({...base,topics:['main-topic','other-topic']}).success).toBe(true);
});
