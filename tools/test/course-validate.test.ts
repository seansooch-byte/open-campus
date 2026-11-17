import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {validate} from '../src/validate.js';
let root:string;
const standard={id:'demo-exam',title:'Demo Exam',publisher:'Example Board',source:'https://example.org/exam',retrieved:'2026-11-17',version:'v1',note:'Codes assigned by Open Campus',levels:[{id:'area',title:'Area'},{id:'topic',title:'Topic'}],nodes:[{code:'D-1',level:'area',title:'Operations'},{code:'D-1.1',level:'topic',parent:'D-1',title:'Exponents'},{code:'D-1.2',level:'topic',parent:'D-1',title:'Radicals'}]};
const course=(o:object={})=>({id:'ge-901',code:'GE-901',title:'Demo',credits:3,block:'general-education',tier:'T1',anchors:[{standard:'demo-exam'}],topics:[{id:'powers',title:'Powers',codes:['D-1.1','D-1.2'],requires:['math']}],...o});
async function put(file:string,data:object) {await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),JSON.stringify(data));}
const errors=async()=>(await validate(root)).filter(i=>i.severity==='error');
beforeEach(async()=>{root=await mkdtemp(join(tmpdir(),'oc-course-'));await put('standards/demo-exam.json',standard);});
afterEach(async()=>rm(root,{recursive:true,force:true}));
it('a course-only tree validates',async()=>{await put('courses/ge-901/course.json',course());expect(await errors()).toEqual([]);});
it('ids must match their paths',async()=>{
 await put('courses/ge-902/course.json',course());await put('standards/other.json',standard);
 expect((await errors()).filter(e=>e.rule==='path-id').map(e=>e.file).sort()).toEqual(['courses/ge-902/course.json','standards/other.json']);
});
it('anchors must name an existing standard',async()=>{await put('courses/ge-901/course.json',course({anchors:[{standard:'nope'}]}));expect((await errors()).some(e=>e.rule==='anchor')).toBe(true);});
it('topic codes must exist in the anchored slice',async()=>{await put('courses/ge-901/course.json',course({topics:[{id:'powers',title:'Powers',codes:['D-1.1','D-1.2','D-9.9'],requires:['math']}]}));expect((await errors()).some(e=>e.rule==='coverage'&&/D-9\.9/.test(e.message))).toBe(true);});
it('from T1 every leaf code must be covered; T0 is exempt',async()=>{
 const partial={topics:[{id:'powers',title:'Powers',codes:['D-1.1'],requires:['math']}]};
 await put('courses/ge-901/course.json',course(partial));
 expect((await errors()).some(e=>e.rule==='coverage'&&/D-1\.2/.test(e.message))).toBe(true);
 await put('courses/ge-901/course.json',course({...partial,tier:'T0'}));
 expect(await errors()).toEqual([]);
});
it('an anchor slice naming an unknown code is an error, even at T1 with nothing else wrong',async()=>{await put('courses/ge-901/course.json',course({anchors:[{standard:'demo-exam',codes:['D-9']}],tier:'T1',topics:[{id:'powers',title:'Powers',codes:['D-1.1','D-1.2'],requires:['math']}]}));expect((await errors()).some(e=>e.rule==='anchor'&&/D-9/.test(e.message))).toBe(true);});
