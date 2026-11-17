import {it,expect} from 'vitest';
import {StandardSchema,CourseSchema} from '@open-campus/schema';
import {renderCoursePlan} from '../src/course-plan.js';
const std=StandardSchema.parse({id:'demo-exam',title:'Demo Exam',publisher:'Board',source:'https://example.org',retrieved:'2026-11-17',version:'v1',note:'n',levels:[{id:'area',title:'Area'},{id:'topic',title:'Topic'}],nodes:[{code:'D-1',level:'area',title:'Ops',weight:100},{code:'D-1.1',level:'topic',parent:'D-1',title:'Exponents'},{code:'D-1.2',level:'topic',parent:'D-1',title:'Radicals'}]});
const course=CourseSchema.parse({id:'ge-901',code:'GE-901',title:'Demo',credits:3,block:'general-education',tier:'T1',anchors:[{standard:'demo-exam'}],topics:[{id:'powers',title:'Powers',codes:['D-1.1'],requires:['math','prose']},{id:'roots',title:'Roots',codes:['D-1.2'],requires:['math'],prerequisites:['powers']}]});
it('renders the topic plan and a per-code coverage table with area weights',()=>{
 const md=renderCoursePlan(course,[std]);
 expect(md).toContain('# GE-901 Demo');
 expect(md).toContain('| 2 | Roots | D-1.2 | math | powers |');
 expect(md).toContain('| D-1 Ops (100%) | D-1.1 Exponents | powers | math, prose |');
 expect(md).toContain('2 of 2 codes covered');
 expect(md).not.toMatch(/[–—]/);
});
