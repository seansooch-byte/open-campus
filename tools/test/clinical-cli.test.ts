import {it,expect,beforeEach,afterEach} from 'vitest';
import {mkdtemp,writeFile,mkdir,rm,readFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {runPacket,runApply} from '../src/clinical/cli.js';
let repo:string, root:string;
beforeEach(async()=>{
 repo=await realpath(await mkdtemp(join(tmpdir(),'clinical-cli-')));
 root=join(repo,'content');
 await mkdir(root,{recursive:true});
 git('init','-q');
});
afterEach(async()=>{await rm(repo,{recursive:true,force:true});});
const git=(...a:string[])=>execFileSync('git',['-c','user.name=t','-c','user.email=t@example.com','-c','commit.gpgsign=false',...a],{cwd:repo,stdio:'pipe',timeout:30_000,killSignal:'SIGKILL'}).toString();
const commit=(msg:string)=>{git('add','-A');git('commit','-q','-m',msg);};
async function write(file:string,data:unknown) {await mkdir(dirname(join(root,file)),{recursive:true});await writeFile(join(root,file),typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');}
const mdx=(front:string,body:string)=>`---\n${front}\n---\n${body}\n`;
const topicFront=(id:string,extra='')=>`id: ${id}\ntitle: Title ${id}\nsubject: biochemistry\ncategories: [1A]\nlearning_objectives: [Learn it]\ndiagrams: []\nversion: 1\nupdated: '2026-10-07'\n${extra}`;
const question=(id:string,extra:object={})=>({id,stem:`Stem ${id}?`,choices:['A','B','C','D'].map(key=>({key,text:`Choice ${key}`,explanation:`Reason ${key}`})),answer:'B',tags:{fc:'FC1',category:'1A',skill:'S1'},difficulty:2,...extra});
const topic=(id:string,extra='')=>write(`subjects/biochemistry/${id}/topic.mdx`,mdx(topicFront(id,extra),`Body ${id}.`));
const deck=(id:string,cards:object[])=>write(`subjects/biochemistry/${id}/cards.json`,{topic_id:id,cards});
const qset=(qs:object[])=>write('questions/bio-biochem/set.json',{id:'set',section:'bio-biochem',title:'Set',topics:['example-amino-acid-structure'],passage:null,questions:qs});
const guide=(extra='')=>write('guides/g1.mdx',mdx(`id: g1\ntitle: Guide\nkind: other\naudience: both\nsources: []${extra}`,'Guide claim.'));
async function packet(...extra:string[]) {
 const out=join(repo,'out','p.md');
 const code=await runPacket(['--out',out,...extra,root]);
 return {code,md:await readFile(out,'utf8').catch(()=>''),json:JSON.parse(await readFile(join(repo,'out','p.json'),'utf8').catch(()=>'null'))};
}
const pendingState=(on=true)=>on?'\nclinical: true\nsean_review: pending':'';

it('packets clinical items that have no sean_review, for every kind',async()=>{
 await topic('t1','clinical: true\n');
 await deck('t1',[{id:'c1',front:'F',back:'B',clinical:true}]);
 await qset([question('q1',{clinical:true})]);
 await guide('\nclinical: true');
 const {code,json}=await packet();
 expect(code).toBe(0);
 expect(Object.keys(json).sort()).toEqual(['guides/g1.mdx#g1','questions/bio-biochem/set.json#q1','subjects/biochemistry/t1/cards.json#c1','subjects/biochemistry/t1/topic.mdx#t1']);
});
it('applies decisions to items that have no sean_review and leaves source untouched on packet',async()=>{
 await topic('t1','clinical: true\n');
 await deck('t1',[{id:'c1',front:'F',back:'B',clinical:true}]);
 const before=await readFile(join(root,'subjects/biochemistry/t1/cards.json'),'utf8');
 const {json}=await packet();
 expect(await readFile(join(root,'subjects/biochemistry/t1/cards.json'),'utf8')).toBe(before);
 json['subjects/biochemistry/t1/cards.json#c1'].decision='rejected';
 json['subjects/biochemistry/t1/topic.mdx#t1'].decision='approved';
 await writeFile(join(repo,'d.json'),JSON.stringify(json));
 expect(await runApply([join(repo,'d.json'),root])).toBe(0);
 expect(JSON.parse(await readFile(join(root,'subjects/biochemistry/t1/cards.json'),'utf8')).cards[0].sean_review).toBe('rejected');
 expect(await readFile(join(root,'subjects/biochemistry/t1/topic.mdx'),'utf8')).toContain('sean_review: approved');
});
it('still reports real schema errors',async()=>{
 await topic('t1','clinical: true\n');
 await write('guides/bad.mdx',mdx('id: bad','x'));
 expect(await runPacket(['--out',join(repo,'out','p.md'),root])).toBe(1);
});

it('--since keeps new, newly clinical, reset, changed items and drops unchanged ones',async()=>{
 await topic('same',pendingState().trim()+'\n');
 await topic('newly');
 await topic('reset','clinical: true\nsean_review: approved\n');
 await topic('edited','clinical: true\nsean_review: pending\n');
 await deck('same',[{id:'c1',front:'F',back:'B',clinical:true,sean_review:'pending'}]);
 await deck('newly',[{id:'c2',front:'F',back:'B'}]);
 await qset([question('q1',{clinical:true,sean_review:'pending'}),question('q2',{clinical:true,sean_review:'rejected'})]);
 await guide(pendingState());
 commit('base');
 await topic('newly','clinical: true\nsean_review: pending\n');
 await topic('reset','clinical: true\nsean_review: pending\n');
 await write('subjects/biochemistry/edited/topic.mdx',mdx(topicFront('edited','clinical: true\nsean_review: pending\n'),'Changed body.'));
 await topic('brand-new','clinical: true\nsean_review: pending\n');
 await deck('newly',[{id:'c2',front:'F',back:'B',clinical:true,sean_review:'pending'}]);
 await qset([question('q1',{clinical:true,sean_review:'pending'}),question('q2',{clinical:true,sean_review:'pending'})]);
 const {code,json}=await packet('--since','HEAD');
 expect(code).toBe(0);
 expect(Object.keys(json).sort()).toEqual([
  'questions/bio-biochem/set.json#q2',
  'subjects/biochemistry/brand-new/topic.mdx#brand-new',
  'subjects/biochemistry/edited/topic.mdx#edited',
  'subjects/biochemistry/newly/cards.json#c2',
  'subjects/biochemistry/newly/topic.mdx#newly',
  'subjects/biochemistry/reset/topic.mdx#reset',
 ]);
});
it('--since treats missing sean_review at the ref as pending and keeps unchanged items out',async()=>{
 await topic('t1','clinical: true\n');
 commit('base');
 await topic('t1','clinical: true\nsean_review: pending\n');
 const {json}=await packet('--since','HEAD');
 expect(json).toEqual({});
});
it('--since compares MDX identity: a different id at the same path counts as changed',async()=>{
 await write('subjects/biochemistry/t1/topic.mdx',mdx(topicFront('old','clinical: true\nsean_review: pending\n'),'Same body.'));
 commit('base');
 await write('subjects/biochemistry/t1/topic.mdx',mdx(topicFront('new','clinical: true\nsean_review: pending\n'),'Same body.'));
 const {json}=await packet('--since','HEAD');
 expect(Object.keys(json)).toEqual(['subjects/biochemistry/t1/topic.mdx#new']);
});
