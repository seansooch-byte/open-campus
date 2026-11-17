import {it,expect,beforeEach,afterEach} from 'vitest';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {bannedMatches,shingles,similarity,lintOriginality} from '../src/originality/index.js';
import {makeFixtureRoot,contentDir} from './helpers/fixture-root.js';
let root:string,refs:string;
beforeEach(async()=>{root=await makeFixtureRoot('.tmp-originality-fixes-');refs=join(root,'references');await mkdir(refs);});
afterEach(async()=>{await rm(root,{recursive:true,force:true});});
const passage='Tidal pools form where the receding ocean leaves water trapped among rocks along a shoreline. Organisms living there experience rapid swings in temperature, salinity, and dissolved oxygen as the day progresses. During daytime low tides, evaporation concentrates salts while sunlight warms the shallow water. Photosynthetic algae raise oxygen levels in the afternoon, whereas respiration by animals lowers them overnight. A researcher sampled one pool at regular intervals and recorded each measurement in a notebook. The data suggested that mussels attached to the rock survived the largest fluctuations, while small fish retreated to deeper crevices whenever conditions became extreme.';
const question=(id:string,stem:string,choiceText:string)=>({id,stem,choices:['A','B','C','D'].map(key=>({key,text:`${choiceText} ${key}`,explanation:`Explanation for ${key}`})),answer:'A',tags:{fc:'FC1',category:'1A',skill:'S1'},difficulty:1,clinical:false});
const writeSet=(id:string,body:string|null,questions:any[])=>writeFile(join(root,`questions/bio-biochem/${id}.json`),JSON.stringify({id,section:'bio-biochem',title:id,topics:['example-amino-acid-structure'],passage:body?{body}:null,example:true,questions}));
const dups=async()=>(await lintOriginality(root,refs)).filter(i=>i.rule==='near-duplicate');
it('passage set with different sibling questions has no near-duplicate',async()=>{
 await writeSet('tide-set',passage,[question('q-one','Which organism type best tolerates large swings in salinity according to the passage data?','Mussels'),question('q-two','Why does oxygen concentration in the pool decline during the night hours?','Respiration')]);
 expect(await dups()).toEqual([]);
});
it('identical stems in different sets are still flagged',async()=>{
 const stem='Which organism type best tolerates large swings in salinity according to the passage data?';
 await writeSet('set-one',null,[question('q-one',stem,'Mussels')]);
 await writeSet('set-two',null,[question('q-one',stem,'Mussels')]);
 expect((await dups()).some(i=>i.severity==='error')).toBe(true);
});
it('items shorter than five words are compared by exact word sequence',async()=>{
 expect(shingles('too short').size).toBe(0);
 expect(similarity('Too  short!','too short')).toBe(1);
 expect(similarity('too short','too long')).toBe(0);
 expect(similarity('','')).toBe(0);
 const file=join(root,'subjects/biochemistry/example-amino-acid-structure/cards.json'),deck=JSON.parse(await readFile(file,'utf8'));
 deck.cards=[{id:'first',front:'same',back:'tiny',clinical:false},{id:'second',front:'Same',back:'Tiny',clinical:false}];await writeFile(file,JSON.stringify(deck));
 expect((await dups()).some(i=>i.severity==='error')).toBe(true);
});
it('banned names use word boundaries while domains keep substring matching',()=>{
 expect(bannedMatches('Data from MSAR here')).toContain('MSAR');
 expect(bannedMatches('see msar.')).toContain('MSAR');
 expect(bannedMatches('Unmsarized and xmsarx words')).not.toContain('MSAR');
 expect(bannedMatches('visit sub.kaplan.com')).toContain('kaplan.com');
});
