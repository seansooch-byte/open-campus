import {it,expect} from 'vitest';
import {CourseSchema} from '@open-campus/schema';
import {deriveQueue} from '../src/publish/queue.js';

const topic=(id:string,extra:Record<string,unknown>={})=>({id,title:id,codes:['D-1'],requires:['prose','cards','mcq'],...extra});
const course=(id:string,code:string,block:string,topics:unknown[],prerequisites:string[]=[])=>CourseSchema.parse({id,code,title:id,credits:3,block,tier:'T1',anchors:[{standard:'demo'}],prerequisites,topics});

const algebra=course('ge-111','GE-111','general-education',[topic('reals'),topic('powers',{prerequisites:['reals']}),topic('roots',{prerequisites:['powers']})]);
const comp=course('ge-101','GE-101','general-education',[topic('thesis')]);
const acct=course('bus-201','BUS-201','major-core',[topic('journal',{requires:['prose','ledger']}),topic('ratios',{requires:['prose','mcq','math']})],['ge-111']);
const calc=course('mat-151','MAT-151','major-core',[topic('limits')]);

it('lists every planned topic without a draft, general education first, then by course code, each in plan order',()=>{
 const q=deriveQueue([acct,calc,algebra,comp],new Set(['ge-111/reals']));
 expect(q.ready.map(e=>`${e.course}/${e.topic}`)).toEqual(['ge-101/thesis','ge-111/powers','ge-111/roots','bus-201/ratios','mat-151/limits']);
});

it('puts a course after the courses it lists as prerequisites, whatever its code',()=>{
 const intro=course('bus-101','BUS-101','major-core',[topic('firms')],['mat-151']);
 const q=deriveQueue([intro,calc],new Set());
 expect(q.ready.map(e=>e.course)).toEqual(['mat-151','bus-101']);
});

it('holds a topic that needs a unit type the players cannot show yet, and says which',()=>{
 const q=deriveQueue([acct],new Set());
 expect(q.blocked).toEqual([{course:'bus-201',topic:'journal',reason:'needs unit type ledger'}]);
});

it('holds a topic whose prerequisite is held, and a topic listed as held, instead of drafting out of order',()=>{
 const q=deriveQueue([algebra],new Set(),new Set(['ge-111/powers']));
 expect(q.ready.map(e=>e.topic)).toEqual(['reals']);
 expect(q.blocked).toEqual([
  {course:'ge-111',topic:'powers',reason:'held after a failed verification'},
  {course:'ge-111',topic:'roots',reason:'prerequisite powers is held'},
 ]);
});

it('is empty when every planned topic is drafted',()=>{
 const q=deriveQueue([comp],new Set(['ge-101/thesis']));
 expect(q).toEqual({ready:[],blocked:[]});
});

import {lintDraft,type Draft} from '../src/publish/prompts.js';
const q=(id:string,answer:'A'|'B'|'C'|'D',extra:Partial<Draft['questions'][number]>={})=>({id,stem:'What is 2 + 2?',choices:(['A','B','C','D'] as const).map(key=>({key,text:'4',explanation:'because'})),answer,codes:['D-1'],difficulty:1,...extra});
const clean:Draft={body:'Intro.\n\n## Summary\n\n- one',cards:[{id:'a',front:'Q?',back:'√4 = 2'}],questions:[q('a','A'),q('b','A'),q('c','B'),q('d','B'),q('e','C'),q('f','C'),q('g','D'),q('h','D')]};

it('passes a clean draft with no mechanical findings',()=>{
 expect(lintDraft(clean,['D-1'])).toEqual([]);
});

it('catches dashes, LaTeX in cards, foreign codes and an unbalanced key before the verifier spends a round',()=>{
 const dash=String.fromCharCode(0x2014);
 const bad:Draft={...clean,body:`A rule ${dash} stated.`,cards:[{id:'a',front:'What is $x^2$?',back:'x squared'}],questions:[...clean.questions.slice(0,7),q('h','A',{codes:['Z-9']})]};
 const problems=lintDraft(bad,['D-1']).map(f=>`${f.where}: ${f.problem}`);
 expect(problems).toEqual(expect.arrayContaining(['body: contains an em or en dash','a: LaTeX or $ in a card',"h: codes Z-9 are not this topic's",'set: D is the answer fewer than two times']));
});

import {pendingToCarry} from '../src/publish/queue.js';
it('carries drafts from the hand-off branch that main lacks and that are not held',()=>{
 const onBranch=['ge-111/powers','ge-111/roots','ge-111/reals','ge-101/thesis'];
 expect(pendingToCarry(onBranch,new Set(['ge-111/reals']),new Set(['ge-101/thesis']))).toEqual(['ge-111/powers','ge-111/roots']);
});
