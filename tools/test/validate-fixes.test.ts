import {it,expect,beforeEach,afterEach} from 'vitest';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {validate} from '../src/validate.js';
import {makeFixtureRoot} from './helpers/fixture-root.js';
let root:string;
const C='courses/ex-100';
const dir=`${C}/topics/example-amino-acid-structure`;
const exam=`${C}/exams/practice-1.json`;
beforeEach(async()=>{root=await makeFixtureRoot('.tmp-oc-fixes-');});
afterEach(async()=>{await rm(root,{recursive:true,force:true});});
async function write(file:string,text:string) {await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),text);}
async function mutate(file:string,fn:(data:any)=>void) {const data=JSON.parse(await readFile(join(root,file),'utf8'));fn(data);await write(file,JSON.stringify(data));}
const errors=async()=>(await validate(root)).filter(i=>i.severity==='error');
async function examFixture() {
 await write(`${C}/questions/verified-set.json`,await readFile(new URL('./fixtures/verified-set.json',import.meta.url),'utf8'));
 await write(exam,await readFile(new URL('./fixtures/good-exam.json',import.meta.url),'utf8'));
}
it('prerequisites: a later or unknown topic is a schema error in the plan',async()=>{
 await mutate(`${C}/course.json`,d=>{d.topics[0].prerequisites=['example-peptide-bonds'];});
 expect((await errors()).some(i=>i.rule==='schema'&&i.message.includes('must be an earlier topic'))).toBe(true);
});
it('path-id: exam id must match its filename',async()=>{
 await examFixture();await mutate(exam,d=>{d.id='practice-2';});
 expect((await errors()).some(i=>i.rule==='path-id'&&i.file===exam)).toBe(true);
});
it('exam: sets come only from the same course',async()=>{
 await examFixture();
 await write('courses/ex-200/course.json',JSON.stringify({id:'ex-200',code:'EX-200',title:'Other',credits:1,block:'supporting',tier:'T0',anchors:[{standard:'example-outline'}],topics:[{id:'other',title:'Other',codes:['EX-1.1'],requires:['prose']}]}));
 await write('courses/ex-200/exams/practice-1.json',await readFile(new URL('./fixtures/good-exam.json',import.meta.url),'utf8'));
 expect((await errors()).some(i=>i.rule==='exam-ref'&&i.file==='courses/ex-200/exams/practice-1.json')).toBe(true);
});
it('exam: duplicate question_ids within an item',async()=>{
 await examFixture();await mutate(exam,d=>{d.items[0].question_ids.push('glycine-substituent');});
 expect((await errors()).some(i=>i.rule==='exam-ref'&&i.message.includes('Duplicate question_ids'))).toBe(true);
});
it('exam: duplicate (set, question) entries across items',async()=>{
 await examFixture();await mutate(exam,d=>{d.items.push({set_id:'verified-set',question_ids:['glycine-substituent']});});
 expect((await errors()).some(i=>i.rule==='exam-ref'&&i.message.includes('Duplicate exam entry'))).toBe(true);
});
it('layout: unrecognized files are errors, allowed files are not',async()=>{
 await write('notes.txt','x');await write(`${dir}/extra.md`,'x');
 expect((await errors()).filter(i=>i.rule==='layout').map(i=>i.file)).toEqual([`${dir}/extra.md`,'notes.txt'].sort());
 await rm(join(root,'notes.txt'));await rm(join(root,dir,'extra.md'));
 for(const f of [`${C}/questions/.gitkeep`,'README.md',`${C}/README.md`,`${dir}/diagrams/a.mmd`,`${dir}/diagrams/b.smi`]) await write(f,'x');
 expect((await errors()).filter(i=>i.rule==='layout')).toEqual([]);
});
