import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtemp,cp,writeFile,mkdir,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadContent} from '../src/content.js';
import {runCoverage} from '../src/coverage/cli.js';
import {buildReport,compareBlueprint,parseBlueprint,formatReport} from '../src/coverage/index.js';
let root:string;
beforeEach(async()=>{
 root=await mkdtemp(join(fileURLToPath(new URL('./',import.meta.url)),'.tmp-coverage-'));
 await cp(new URL('./fixtures/content/taxonomy/',import.meta.url),join(root,'taxonomy'),{recursive:true});
});
afterEach(async()=>{await rm(root,{recursive:true,force:true});});
async function write(file:string,data:unknown) {await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),typeof data==='string'?data:JSON.stringify(data));}
const question=(id:string,category:string,skill:string,difficulty:number,fc='FC1')=>({id,stem:'Pick one.',choices:['A','B','C','D'].map(key=>({key,text:`Choice ${key}`,explanation:`Reason ${key}`})),answer:'A',tags:{fc,category,skill},difficulty});
const topic=(id:string,categories:string[],example=false)=>`---\nid: ${id}\ntitle: ${id}\nsubject: biochemistry\ncategories: [${categories.join(', ')}]\nlearning_objectives: [Learn it]\ndiagrams: []\nversion: 1\nupdated: '2026-10-07'\n${example?'example: true\n':''}---\nBody text.\n`;
async function fixture() {
 await write('subjects/biochemistry/real-topic/topic.mdx',topic('real-topic',['1A','1B']));
 await write('subjects/biochemistry/demo-topic/topic.mdx',topic('demo-topic',['1A'],true));
 await write('subjects/biochemistry/real-topic/cards.json',{topic_id:'real-topic',cards:[{id:'c1',front:'f',back:'b',categories:['1A']},{id:'c2',front:'f',back:'b',categories:['1A','1B']},{id:'c3',front:'f',back:'b'}]});
 await write('questions/bio-biochem/real-set.json',{id:'real-set',section:'bio-biochem',title:'Real',topics:['example-amino-acid-structure'],passage:null,questions:[question('q1','1A','S1',2),question('q2','1A','S2',3),question('q3','1B','S1',3)]});
 await write('questions/bio-biochem/demo-set.json',{id:'demo-set',section:'bio-biochem',title:'Demo',topics:['example-amino-acid-structure'],passage:null,example:true,questions:[question('q4','1A','S4',5)]});
 const {items,issues}=await loadContent(root);
 expect(issues.filter(i=>i.severity==='error')).toEqual([]);
 return items;
}
const find=(r:ReturnType<typeof buildReport>,code:string)=>r.categories.find(c=>c.code===code)!;
it('counts topics, questions, sets, cards, skills and difficulty by category',async()=>{
 const r=buildReport(await fixture());
 expect(find(r,'1A')).toMatchObject({section:'bio-biochem',topics:1,questions:2,sets:1,cards:2});
 expect(find(r,'1B')).toMatchObject({topics:1,questions:1,sets:1,cards:1});
 expect(r.skills).toEqual({S1:2,S2:1,S3:0,S4:0,C1:0,C2:0,C3:0});
 expect(r.difficulty).toEqual({'1':0,'2':1,'3':2,'4':0,'5':0});
 expect(r.sections['bio-biochem']).toMatchObject({topics:1,questions:3,sets:1,cards:2});
 expect(r.categories.map(c=>c.code).slice(0,3)).toEqual(['1A','1B','1C']);
 expect(r.categories.map(c=>c.code)).toContain('10A');
});
it('excludes example items by default and includes them on request',async()=>{
 const items=await fixture();
 const withEx=buildReport(items,{includeExamples:true});
 expect(find(withEx,'1A')).toMatchObject({topics:2,questions:3,sets:2});
 expect(withEx.skills.S4).toBe(1);
 expect(withEx.difficulty['5']).toBe(1);
 expect(buildReport(items).skills.S4).toBe(0);
});
it('flags categories with zero topics or too few questions',async()=>{
 const items=await fixture();
 const r=buildReport(items,{minQuestions:2});
 expect(find(r,'1A').gaps).toEqual([]);
 expect(find(r,'1B').gaps).toEqual(['fewer than 2 questions']);
 expect(find(r,'1C').gaps).toEqual(['no topics','fewer than 2 questions']);
 expect(r.gaps.find(g=>g.category==='1A')).toBeUndefined();
 expect(r.gaps.find(g=>g.category==='1C')?.reasons).toHaveLength(2);
 expect(find(buildReport(items),'1A').gaps).toEqual(['fewer than 10 questions']);
});
it('computes blueprint deltas, treating unknown categories as zero',async()=>{
 const r=buildReport(await fixture(),{blueprint:{categories:{'1A':{topics:3,questions:1},'9Z':{questions:4}}}});
 expect(r.blueprint).toEqual([
  {category:'1A',metric:'topics',target:3,actual:1,delta:-2},
  {category:'1A',metric:'questions',target:1,actual:2,delta:1},
  {category:'9Z',metric:'questions',target:4,actual:0,delta:-4},
 ]);
 expect(compareBlueprint(r.categories,{categories:{}})).toEqual([]);
 expect(formatReport(r)).toContain('delta -2');
});
it('counts CARS questions under CARS skill rows and excludes example decks',async()=>{
 await write('questions/cars/cars-set.json',{id:'cars-set',section:'cars',title:'C',topics:['example-amino-acid-structure'],passage:{body:'Some passage.'},questions:[question('c1','1A','C1',2),question('c2','1A','C2',3),question('c3','1A','C2',3)]});
 await write('subjects/biochemistry/demo-topic/cards.json',{topic_id:'demo-topic',example:true,cards:[{id:'d1',front:'f',back:'b',categories:['1A']}]});
 const {items,issues}=await loadContent(root);
 expect(issues.filter(i=>i.severity==='error')).toEqual([]);
 const r=buildReport(items);
 expect(find(r,'C1')).toMatchObject({section:'cars',topics:null,cards:null,questions:1,sets:1});
 expect(find(r,'C2')).toMatchObject({questions:2,sets:1});
 expect(find(r,'C3')).toMatchObject({questions:0,sets:0});
 expect(find(r,'1A').questions).toBe(0);
 expect(find(r,'1A').cards).toBe(0);
 expect(r.sections.cars).toEqual({topics:null,questions:3,sets:1,cards:null});
 expect(r.skills.C2).toBe(2);
 expect(find(r,'C3').gaps).toEqual(['fewer than 10 questions']);
});
it('validates blueprint files',()=>{
 for(const bad of ['null','1','"x"','[]']) expect(()=>parseBlueprint(`{"categories":{"1A":${bad}}}`)).toThrow();
 expect(parseBlueprint('{"categories":{"1A":{"topics":2}}}').categories['1A']).toEqual({topics:2});
 expect(()=>parseBlueprint('{}')).toThrow();
 expect(()=>parseBlueprint('{"categories":{"1A":{"topics":-1}}}')).toThrow();
});
it('has a stable JSON shape',async()=>{
 const r=JSON.parse(JSON.stringify(buildReport(await fixture())));
 expect(Object.keys(r).sort()).toEqual(['categories','difficulty','gaps','options','sections','skills']);
 expect(Object.keys(r.categories[0]).sort()).toEqual(['cards','code','gaps','questions','questionsBySection','section','sets','setsBySection','topics']);
 expect(r.options).toEqual({minQuestions:10,includeExamples:false});
});
it('attributes questions and sets to the question set section, per category',async()=>{
 await write('questions/chem-phys/cp-set.json',{id:'cp-set',section:'chem-phys',title:'CP',topics:['example-amino-acid-structure'],passage:null,questions:[question('p1','1A','S1',2,'FC4'),question('p2','1A','S2',2,'FC4')]});
 const {items,issues}=await loadContent(root);
 expect(issues.filter(i=>i.severity==='error')).toEqual([]);
 const r=buildReport(items);
 expect(find(r,'1A')).toMatchObject({section:'bio-biochem',questions:2,sets:1,questionsBySection:{'chem-phys':2},setsBySection:{'chem-phys':1}});
 await write('questions/bio-biochem/real-set.json',{id:'real-set',section:'bio-biochem',title:'Real',topics:['example-amino-acid-structure'],passage:null,questions:[question('q1','1A','S1',2),question('q3','1B','S1',3)]});
 const r2=buildReport((await loadContent(root)).items);
 expect(find(r2,'1A')).toMatchObject({questions:3,sets:2,questionsBySection:{'bio-biochem':1,'chem-phys':2},setsBySection:{'bio-biochem':1,'chem-phys':1}});
 expect(r2.sections['chem-phys']).toMatchObject({questions:2,sets:1});
 expect(r2.sections['bio-biochem']).toMatchObject({questions:2,sets:1});
 expect(formatReport(r2)).toContain('bio-biochem:1 chem-phys:2');
});
async function runCli(args:string[]) {
 const out:string[]=[], err:string[]=[];
 const log=console.log, error=console.error;
 console.log=(...a:unknown[])=>{out.push(a.join(' '));};
 console.error=(...a:unknown[])=>{err.push(a.join(' '));};
 try {return {code:await runCoverage(args),out:out.join('\n'),err:err.join('\n')};}
 finally {console.log=log;console.error=error;}
}
it('runCoverage validates arguments',async()=>{
 await fixture();
 expect((await runCli([root,'extra','--json'])).code).toBe(2);
 expect((await runCli([root,'--min-questions','x'])).code).toBe(2);
 expect((await runCli([root,'--bogus'])).code).toBe(2);
 expect((await runCli([root,'--blueprint'])).code).toBe(2);
 expect((await runCli([root,'--blueprint',join(root,'missing.json')])).code).toBe(2);
});
it('runCoverage prints JSON and reports content errors with exit 1',async()=>{
 await fixture();
 const ok=await runCli([root,'--json','--min-questions','2']);
 expect(ok.code).toBe(0);
 expect(JSON.parse(ok.out).options).toEqual({minQuestions:2,includeExamples:false});
 await write('questions/bio-biochem/broken.json',{id:'broken'});
 const bad=await runCli([root,'--json']);
 expect(bad.code).toBe(1);
 expect(bad.err).toContain('broken.json');
});
