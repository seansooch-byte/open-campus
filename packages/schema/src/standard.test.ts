import {describe,it,expect} from 'vitest';
import * as s from './index.js';
const standard={id:'demo-exam',title:'Demo Exam',publisher:'Example Board',source:'https://example.org/exam',retrieved:'2026-11-17',version:'Page as retrieved',note:'Titles are ours; codes assigned by Open Campus',
 levels:[{id:'area',title:'Content area'},{id:'topic',title:'Topic'}],
 nodes:[{code:'D-1',level:'area',title:'Operations',weight:60},{code:'D-1.1',level:'topic',parent:'D-1',title:'Exponents'},{code:'D-2',level:'area',title:'Functions',weight:40},{code:'D-2.1',level:'topic',parent:'D-2',title:'Inverses'}]};
const course={id:'ge-901',code:'GE-901',title:'Demo Course',credits:3,block:'general-education',tier:'T1',
 anchors:[{standard:'demo-exam'}],
 topics:[{id:'exponents',title:'Exponents',codes:['D-1.1'],requires:['prose','math']},{id:'inverses',title:'Inverse functions',codes:['D-2.1'],requires:['math'],prerequisites:['exponents']}]};
const bad=(o:object,schema:{safeParse:(d:unknown)=>{success:boolean}})=>expect(schema.safeParse(o).success).toBe(false);
describe('StandardSchema',()=>{
 it('accepts a two-level outline',()=>expect(s.StandardSchema.safeParse(standard).success).toBe(true));
 it('rejects duplicate codes',()=>bad({...standard,nodes:[...standard.nodes,standard.nodes[0]]},s.StandardSchema));
 it('rejects a missing parent',()=>bad({...standard,nodes:[...standard.nodes,{code:'D-3.1',level:'topic',parent:'D-3',title:'Orphan'}]},s.StandardSchema));
 it('rejects a parent at the wrong level',()=>bad({...standard,nodes:[...standard.nodes,{code:'D-1.2',level:'topic',parent:'D-1.1',title:'Too deep'}]},s.StandardSchema));
 it('rejects a top-level node with a parent or a lower node without one',()=>{
  bad({...standard,nodes:[{...standard.nodes[0],parent:'D-2'},...standard.nodes.slice(1)]},s.StandardSchema);
  bad({...standard,nodes:[...standard.nodes,{code:'D-9',level:'topic',title:'Loose'}]},s.StandardSchema);
 });
 it('rejects sibling weights that do not total 100',()=>bad({...standard,nodes:standard.nodes.map(n=>n.code==='D-2'?{...n,weight:30}:n)},s.StandardSchema));
 it('rejects an unknown level and an http source',()=>{
  bad({...standard,nodes:[...standard.nodes,{code:'D-1.9',level:'skill',parent:'D-1',title:'X'}]},s.StandardSchema);
  bad({...standard,source:'http://example.org'},s.StandardSchema);
 });
 it('accepts dimensions whose weights total 100 and rejects ones that do not',()=>{
  const dim={id:'kind',title:'Problem kind',values:[{id:'routine',title:'Routine',weight:50},{id:'nonroutine',title:'Non-routine',weight:50}]};
  expect(s.StandardSchema.safeParse({...standard,dimensions:[dim]}).success).toBe(true);
  bad({...standard,dimensions:[{...dim,values:[{...dim.values[0],weight:70},dim.values[1]]}]},s.StandardSchema);
 });
 it('leafCodes lists only nodes without children, in outline order',()=>expect(s.leafCodes(s.StandardSchema.parse(standard))).toEqual(['D-1.1','D-2.1']));
});
describe('CourseSchema',()=>{
 it('accepts a planned course',()=>expect(s.CourseSchema.safeParse(course).success).toBe(true));
 it('rejects a bad course code, tier, unit type and block',()=>{
  bad({...course,code:'ge-901'},s.CourseSchema);
  bad({...course,tier:'T9'},s.CourseSchema);
  bad({...course,topics:[{...course.topics[0],requires:['video']}]},s.CourseSchema);
  bad({...course,block:'elective'},s.CourseSchema);
 });
 it('rejects duplicate topics, topics without codes, and prerequisites that are unknown or come later',()=>{
  bad({...course,topics:[course.topics[0],course.topics[0]]},s.CourseSchema);
  bad({...course,topics:[{...course.topics[0],codes:[]}]},s.CourseSchema);
  bad({...course,topics:[{...course.topics[0],prerequisites:['nowhere']},course.topics[1]]},s.CourseSchema);
  bad({...course,topics:[{...course.topics[0],prerequisites:['inverses']},course.topics[1]]},s.CourseSchema);
 });
});
describe('courseCoverage',()=>{
 const std=s.StandardSchema.parse(standard), c=s.CourseSchema.parse(course);
 it('maps every leaf code to the topics and unit types that cover it',()=>{
  const r=s.courseCoverage(c,[std]);
  expect(r.missing).toEqual([]);expect(r.unknown).toEqual([]);
  expect(r.rows).toEqual([{standard:'demo-exam',code:'D-1.1',topics:['exponents'],types:['math','prose']},{standard:'demo-exam',code:'D-2.1',topics:['inverses'],types:['math']}]);
 });
 it('reports uncovered and unknown codes',()=>{
  const r=s.courseCoverage({...c,topics:[{...c.topics[0]!,codes:['D-1.1','D-7.7']}]},[std]);
  expect(r.missing).toEqual([{standard:'demo-exam',code:'D-2.1'}]);
  expect(r.unknown).toEqual([{topic:'exponents',code:'D-7.7'}]);
 });
 it('a parent code covers nothing by itself, and an anchor slice limits what is required',()=>{
  expect(s.courseCoverage({...c,topics:[{...c.topics[0]!,codes:['D-1','D-1.1']}]},[std]).unknown).toEqual([{topic:'exponents',code:'D-1'}]);
  expect(s.courseCoverage({...c,anchors:[{standard:'demo-exam',codes:['D-1']}],topics:[c.topics[0]!]},[std]).missing).toEqual([]);
 });
 it('reports anchor slice codes the standard does not have, so a typo cannot empty the requirement',()=>{
  const r=s.courseCoverage({...c,anchors:[{standard:'demo-exam',codes:['D-9']}]},[std]);
  expect(r.unknownAnchorCodes).toEqual([{standard:'demo-exam',code:'D-9'}]);
 });
 it('reports a leaf code required twice across anchors',()=>{
  expect(s.courseCoverage({...c,anchors:[{standard:'demo-exam'},{standard:'demo-exam'}]},[std]).duplicateCodes).toEqual(['D-1.1','D-2.1']);
 });
 it('reports a missing standard',()=>expect(s.courseCoverage(c,[]).missingStandards).toEqual(['demo-exam']));
});
