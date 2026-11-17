import {it,expect,beforeEach,afterEach} from 'vitest';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {bannedMatches,hasVerbatimRun,shingles,jaccard,lintOriginality,structureNumberingIssues} from '../src/originality/index.js';
import {bannedDomain,bannedSources} from '../src/originality/config.js';
import {makeFixtureRoot,contentDir} from './helpers/fixture-root.js';
let root:string,refs:string;
beforeEach(async()=>{root=await makeFixtureRoot('.tmp-originality-');refs=join(root,'references');await mkdir(refs);});
afterEach(async()=>{await rm(root,{recursive:true,force:true});});
it('detects every banned source without case sensitivity',()=>{
 for(const banned of [...bannedSources.names,...bannedSources.domains]) expect(bannedMatches(`Prefix ${banned.toUpperCase()} suffix`)).toContain(banned);
 expect(bannedMatches('Original author wording')).toEqual([]);
 expect(bannedDomain('https://MSAR.AAMC.ORG/data')).toBe(true);
 expect(bannedDomain('https://mec.aamc.org.example.edu')).toBe(false);
});
it('normalizes punctuation, unicode and case for 12-word runs',()=>{
 const twelve='one two three four five six seven eight nine ten eleven twelve';
 expect(hasVerbatimRun(`Prefix ${twelve.toUpperCase().replaceAll(' ', ', ')}.`,`${twelve} suffix`)).toBe(true);
 expect(hasVerbatimRun(twelve,twelve.split(' ').slice(0,11).join(' '))).toBe(false);
 expect(hasVerbatimRun(twelve,twelve.replace('seven','different'))).toBe(false);
});
it('computes five-word shingle Jaccard similarity',()=>{
 expect(shingles('one two three four five six').size).toBe(2);
 expect(jaccard(shingles('one two three four five six'),shingles('one two three four five six'))).toBe(1);
 expect(jaccard(new Set(),new Set())).toBe(0);
 expect(jaccard(new Set(['a','b','c']),new Set(['a','b','d']))).toBe(0.5);
});
it('real examples have no originality errors and report empty references',async()=>{
 const issues=await lintOriginality(contentDir,refs);expect(issues.filter(i=>i.severity==='error')).toEqual([]);expect(issues.some(i=>i.rule==='verbatim'&&i.severity==='info')).toBe(true);
},180_000); // one full lint of the growing content tree; ~50s locally, over 60s on the CI runner
it('banned source fixture: allows only taxonomy note and source exemption',async()=>{
 const file=join(root,'taxonomy/aamc-outline.json'),taxonomy=JSON.parse(await readFile(file,'utf8'));
 taxonomy.note+=' AAMC Official Guide';await writeFile(file,JSON.stringify(taxonomy));
 expect((await lintOriginality(root,refs)).filter(i=>i.rule==='banned-source')).toEqual([]);
 taxonomy.sections[0].title='Kaplan';await writeFile(file,JSON.stringify(taxonomy));
 expect((await lintOriginality(root,refs)).some(i=>i.rule==='banned-source')).toBe(true);
 const topic=join(root,'subjects/biochemistry/example-amino-acid-structure/topic.mdx');
 await writeFile(topic,(await readFile(topic,'utf8'))+'\nUWORLD\n');expect((await lintOriginality(root,refs)).some(i=>i.rule==='banned-source'&&i.file.endsWith('topic.mdx'))).toBe(true);
},30000); // three full lints of the growing content tree; the default 5s is too tight on CI
it('structure-numbering: flags x.y numbering in titles and headings, not decimals in prose or math',()=>{
 const topic=(title:string,body:string)=>({file:'t.mdx',type:'topic',data:{id:'t',title},body,raw:''});
 const rules=(items:any[])=>structureNumberingIssues(items).map(i=>i.rule);
 for(const hit of ['1.1 Amino acids','2.3.4: Folding','1.2) Bonds','1.2. Bonds','3.1 - Rates']) expect(rules([topic(hit,'Body.')]),hit).toEqual(['structure-numbering']);
 for(const hit of ['# 1.1 Amino acids','## 2.3.4 Folding','  ### 4.2: Rates']) expect(rules([topic('Plain',`Intro.\n${hit}\nMore.`)]),hit).toEqual(['structure-numbering']);
 expect(rules([{file:'q.json',type:'questions',data:{id:'q',title:'1.2 Enzyme set'},body:'',raw:''}])).toEqual(['structure-numbering']);
 for(const miss of ['Amino acids','Buffers at pH 7.4','The 2.5 rule']) expect(rules([topic(miss,'Body.')]),miss).toEqual([]);
 expect(rules([topic('Plain','The constant is 3.14 here.\n1.5 mol of gas.\nSet x = 2.5 + 1.\n## Rates of 2.5 mol\n```\n# 1.1 code comment\n```')])).toEqual([]);
 expect(rules([{file:'q.json',type:'questions',data:{id:'q',title:'Enzyme set'},body:'',raw:''}])).toEqual([]);
});
it('structure-numbering: Setext headings and fence matching',()=>{
 const topic=(body:string)=>({file:'t.mdx',type:'topic',data:{id:'t',title:'Plain'},body,raw:''});
 const rules=(body:string)=>structureNumberingIssues([topic(body)]).map(i=>i.rule);
 expect(rules('Intro.\n\n1.2 Amino acids\n--------------\n\nMore.')).toEqual(['structure-numbering']);
 expect(rules('Intro.\n\n3.1 Rates\n===\n')).toEqual(['structure-numbering']);
 expect(rules('Intro.\n\nPlain heading\n---\n')).toEqual([]);
 // a ```` block containing a ``` line stays open until a matching ```` fence
 expect(rules('````md\n```\n# 1.1 inside code\n````\n# 2.1 After the block\n')).toEqual(['structure-numbering']);
 // a ~~~ line does not close a ``` block, so the heading inside stays ignored
 expect(rules('```\n~~~\n# 1.1 still code\n```\nDone.')).toEqual([]);
});
it('structure-numbering: lintOriginality reports it as an error',async()=>{
 const file=join(root,'subjects/biochemistry/example-amino-acid-structure/topic.mdx');
 await writeFile(file,(await readFile(file,'utf8'))+'\n## 1.1 Amino acids\n');
 expect((await lintOriginality(root,refs)).some(i=>i.rule==='structure-numbering'&&i.severity==='error')).toBe(true);
});
it('verbatim fixture flags local references',async()=>{
 await writeFile(join(refs,'local.txt'),'Its central carbon connects to an amino group, a carboxyl group, a hydrogen atom, and a side chain.');
 expect((await lintOriginality(root,refs)).some(i=>i.rule==='verbatim'&&i.severity==='error')).toBe(true);
});
async function deckPair(wordsA:string,wordsB:string) {
 const file=join(root,'subjects/biochemistry/example-amino-acid-structure/cards.json'),deck=JSON.parse(await readFile(file,'utf8'));
 deck.cards=[{id:'first',front:wordsA,back:'end',clinical:false},{id:'second',front:wordsB,back:'end',clinical:false}];await writeFile(file,JSON.stringify(deck));
 return (await lintOriginality(root,refs)).filter(i=>i.rule==='near-duplicate');
}
it('near-duplicate fixture: error at 0.8 or greater',async()=>{
 const text='one two three four five six seven eight nine ten eleven twelve';
 expect((await deckPair(text,text))[0]?.severity).toBe('error');
});
it('near-duplicate fixture: warning between 0.6 and 0.8',async()=>{
 const text=Array.from({length:30},(_,i)=>`word${i}`).join(' ');
 const altered=text.replace('word0','different0').replace('word1','different1').replace('word2','different2').replace('word3','different3');
 const issues=await deckPair(text,altered);expect(issues[0]?.severity).toBe('warning');
});
