import {it,expect} from 'vitest';
import {loadContent} from '../src/content.js';
import {buildReport,formatReport} from '../src/coverage/index.js';
import {runCoverage} from '../src/coverage/cli.js';
import {contentDir} from './helpers/fixture-root.js';
const items=async()=>(await loadContent(contentDir)).items;
it('counts drafted topics, cards and questions per outline code, examples only on request',async()=>{
 const without=buildReport(await items(),{minQuestions:1});
 expect(without.courses[0]!.rows.map(r=>[r.code,r.drafted,r.cards,r.questions])).toEqual([['EX-1.1',0,0,0],['EX-1.2',0,0,0]]);
 const withEx=buildReport(await items(),{minQuestions:1,includeExamples:true});
 const r=withEx.courses[0]!;
 expect(r.id).toBe('ex-100');
 // EX-1.1: one drafted topic of two planned; three cards (no codes means all topic codes); one question.
 expect(r.rows.map(x=>[x.code,x.planned,x.drafted,x.cards,x.questions])).toEqual([['EX-1.1',2,1,3,1],['EX-1.2',1,1,2,1]]);
 expect(r.drafted).toEqual({topics:1,of:2});
});
it('flags codes with no drafted topic or too few questions',async()=>{
 const r=buildReport(await items(),{minQuestions:2,includeExamples:true}).courses[0]!;
 expect(r.rows.find(x=>x.code==='EX-1.2')!.gaps).toEqual(['questions 1 < 2']);
 expect(buildReport(await items(),{minQuestions:0}).courses[0]!.rows[0]!.gaps).toEqual(['no drafted topic']);
});
it('formats a readable table',async()=>{
 const text=formatReport(buildReport(await items(),{minQuestions:1,includeExamples:true}));
 expect(text).toContain('EX-100 Example Course: 1 of 2 topics drafted');
 expect(text).toMatch(/EX-1\.1\s+2\s+1\s+3\s+1/);
});
it('runCoverage validates arguments and prints JSON',async()=>{
 expect(await runCoverage(['--min-questions','-1'])).toBe(2);
 expect(await runCoverage(['--nope'])).toBe(2);
 const logs:string[]=[];const log=console.log;console.log=(s:string)=>logs.push(s);
 try {expect(await runCoverage([contentDir,'--json','--include-examples'])).toBe(0);} finally {console.log=log;}
 expect(JSON.parse(logs[0]!).courses[0].id).toBe('ex-100');
});
