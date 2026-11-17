import {it,expect,beforeEach,afterEach} from 'vitest';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {validate} from '../src/validate.js';
import {makeFixtureRoot,contentDir} from './helpers/fixture-root.js';
let root:string;
const topic='subjects/biochemistry/example-amino-acid-structure/topic.mdx';
const dir=dirname(topic);
const tax='taxonomy/aamc-outline.json';
beforeEach(async()=>{root=await makeFixtureRoot('.tmp-oc-fixes-');});
afterEach(async()=>{await rm(root,{recursive:true,force:true});});
async function write(file:string,text:string) {await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),text);}
async function mutate(file:string,fn:(data:any)=>void) {const data=JSON.parse(await readFile(join(root,file),'utf8'));fn(data);await write(file,JSON.stringify(data));}
const errors=async()=>(await validate(root)).filter(i=>i.severity==='error');
async function examFixture() {
 await write('questions/bio-biochem/verified-set.json',await readFile(new URL('./fixtures/verified-set.json',import.meta.url),'utf8'));
 await write('exams/fl-1.json',await readFile(new URL('./fixtures/good-exam.json',import.meta.url),'utf8'));
}
async function topicWith(id:string,prereqs:string[]) {
 const raw=await readFile(join(root,topic),'utf8');
 await write(`subjects/biochemistry/${id}/topic.mdx`,raw.replace('id: example-amino-acid-structure',`id: ${id}`).replace('categories: [1A]',`categories: [1A]\nprerequisites: [${prereqs.join(', ')}]`));
 await write(`subjects/biochemistry/${id}/diagrams/alpha-carbon.svg`,await readFile(join(root,dir,'diagrams/alpha-carbon.svg'),'utf8'));
}
it('taxonomy: missing code is an error',async()=>{await mutate(tax,d=>{d.skills.pop();});expect((await errors()).some(i=>i.rule==='taxonomy'&&i.message.includes('Missing skill code'))).toBe(true);});
it('taxonomy: 10A under FC1 is an error',async()=>{
 await mutate(tax,d=>{const fc10=d.foundationalConcepts.find((f:any)=>f.id==='FC10');d.foundationalConcepts[0].categories.push(...fc10.categories);});
 expect((await errors()).some(i=>i.rule==='schema'&&i.message.includes('Category number must match its foundational concept'))).toBe(true);
});
it('prerequisite: self reference',async()=>{await topicWith('self-ref',['self-ref']);expect((await errors()).some(i=>i.rule==='prerequisite'&&i.message.includes('itself'))).toBe(true);});
it('prerequisite: cycle',async()=>{await topicWith('cycle-a',['cycle-b']);await topicWith('cycle-b',['cycle-a']);expect((await errors()).some(i=>i.message.startsWith('Prerequisite cycle'))).toBe(true);});
it('path-id: exam id and filename must match fl-<n>',async()=>{
 await examFixture();await mutate('exams/fl-1.json',d=>{d.id='fl-2';});
 expect((await errors()).some(i=>i.rule==='path-id'&&i.file==='exams/fl-1.json')).toBe(true);
 await rm(join(root,'exams/fl-1.json'));
 await write('exams/full-length.json',(await readFile(new URL('./fixtures/good-exam.json',import.meta.url),'utf8')).replace('"fl-1"','"full-length"'));
 expect((await errors()).some(i=>i.rule==='path-id'&&i.file==='exams/full-length.json')).toBe(true);
});
it('path-id: school, path and guide ids must match filenames',async()=>{
 await write('schools/example.json',JSON.stringify({id:'other',name:'Example',degree:'MD',state:'MI',website:'https://example.edu',facts:[{key:'name',value:'Example',source_url:'https://example.edu/a',as_of:'2026-10-07'}]}));
 expect((await errors()).some(i=>i.rule==='path-id'&&i.file==='schools/example.json')).toBe(true);
});
function pathJson(id:string){return JSON.stringify({id,title:'Path',track:'both',steps:[{id:'step',title:'Step',timing:'Before applying',description:'Prepare'}]});}
function guideMdx(id:string){return `---\nid: ${id}\ntitle: Guide\nkind: amcas\naudience: both\nsources:\n  - url: https://example.edu/admissions\n    as_of: '2026-10-07'\n---\nPrepare the application from public school pages.\n`;}
it('path-id: path id differs from its filename',async()=>{
 await write('paths/example-path.json',pathJson('other'));
 expect((await errors()).some(i=>i.rule==='path-id'&&i.file==='paths/example-path.json'&&i.message==='ID must match filename')).toBe(true);
});
it('path-id: matching path id has no path-id error',async()=>{
 await write('paths/example-path.json',pathJson('example-path'));
 expect((await errors()).filter(i=>i.rule==='path-id'||i.file==='paths/example-path.json')).toEqual([]);
});
it('path-id: guide id differs from its filename',async()=>{
 await write('guides/example-guide.mdx',guideMdx('other'));
 expect((await errors()).some(i=>i.rule==='path-id'&&i.file==='guides/example-guide.mdx'&&i.message==='ID must match filename')).toBe(true);
});
it('path-id: matching guide id has no path-id error',async()=>{
 await write('guides/example-guide.mdx',guideMdx('example-guide'));
 expect((await errors()).filter(i=>i.rule==='path-id'||i.file==='guides/example-guide.mdx')).toEqual([]);
});
it('exam: duplicate question_ids within an item',async()=>{
 await examFixture();await mutate('exams/fl-1.json',d=>{d.sections[0].items[0].question_ids.push('glycine-substituent');});
 expect((await errors()).some(i=>i.rule==='exam-ref'&&i.message.includes('Duplicate question_ids'))).toBe(true);
});
it('exam: duplicate (set, question) entries across items',async()=>{
 await examFixture();await mutate('exams/fl-1.json',d=>{d.sections[0].items.push({set_id:'verified-set',question_ids:['glycine-substituent']});});
 expect((await errors()).some(i=>i.rule==='exam-ref'&&i.message.includes('Duplicate exam entry'))).toBe(true);
});
it('layout: unrecognized files are errors, allowed files are not',async()=>{
 await write('notes.txt','x');await write(`${dir}/extra.md`,'x');
 expect((await errors()).filter(i=>i.rule==='layout').map(i=>i.file)).toEqual([`${dir}/extra.md`,'notes.txt'].sort());
 await rm(join(root,'notes.txt'));await rm(join(root,dir,'extra.md'));
 for(const f of ['questions/.gitkeep','README.md','schools/README.md',`${dir}/diagrams/a.mmd`,`${dir}/diagrams/b.smi`]) await write(f,'x');
 expect((await errors()).filter(i=>i.rule==='layout')).toEqual([]);
});
