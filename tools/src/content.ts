import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import matter from 'gray-matter';
import * as s from '@open-campus/schema';
import type { z } from 'zod';
export type Issue = {file:string; rule:string; message:string; severity:'error'|'warning'|'info'};
export type Item = {file:string; type:string; data: any; body:string; raw:string};
export async function walk(root:string):Promise<string[]> {
 const entries=await readdir(root,{withFileTypes:true});
 return (await Promise.all(entries.map(e=>e.isDirectory()?walk(join(root,e.name)):Promise.resolve([join(root,e.name)])))).flat().sort();
}
export const schemas:Record<string,z.ZodType>={standard:s.StandardSchema,course:s.CourseSchema,topic:s.TopicFrontmatterSchema,cards:s.CardDeckSchema,questions:s.QuestionSetSchema,exam:s.ExamSchema};
// Everything a learner studies lives inside its course: courses/<course>/{course.json, topics/<topic>/, questions/, exams/}.
const layout:[RegExp,string][]=[
 [/^standards\/[^/]+\.json$/,'standard'],
 [/^courses\/[^/]+\/course\.json$/,'course'],
 [/^courses\/[^/]+\/topics\/[^/]+\/topic\.mdx$/,'topic'],
 [/^courses\/[^/]+\/topics\/[^/]+\/cards\.json$/,'cards'],
 [/^courses\/[^/]+\/questions\/[^/]+\.json$/,'questions'],
 [/^courses\/[^/]+\/exams\/[^/]+\.json$/,'exam'],
];
export function contentType(file:string):string|undefined {
 return layout.find(([re])=>re.test(file))?.[1];
}
/** The course directory a content file belongs to, if any. */
export function courseOf(file:string):string|undefined { return /^courses\/([^/]+)\//.exec(file)?.[1]; }
const ignorable=/(?:^|\/)(?:\.gitkeep|README\.md)$|^courses\/[^/]+\/topics\/[^/]+\/diagrams\/(?:[^/]+\/)*[^/]+\.(?:svg|mmd|smi)$/;
export async function loadContent(root:string):Promise<{items:Item[];issues:Issue[];files:string[]}> {
 const files=await walk(root), items:Item[]=[], issues:Issue[]=[];
 for(const absolute of files) {
  const file=relative(root,absolute).split('\\').join('/');
  const type=contentType(file);
  if(!type) {if(!ignorable.test(file)) issues.push({file,rule:'layout',message:'Unsupported content path',severity:'error'});continue;}
  try {
   const raw=await readFile(absolute,'utf8');
   const parsed=file.endsWith('.mdx')?matter(raw):{data:JSON.parse(raw),content:''};
   const result=schemas[type]!.safeParse(parsed.data);
   if(!result.success) {for(const e of result.error.issues) issues.push({file,rule:'schema',message:`${e.path.join('.')}: ${e.message}`,severity:'error'});continue;}
   if(file.endsWith('.mdx')&&!parsed.content.trim()) issues.push({file,rule:'body',message:'MDX body must be non-empty',severity:'error'});
   items.push({file,type,data:result.data,body:parsed.content,raw});
  } catch(e) {issues.push({file,rule:'parse',message:String(e),severity:'error'});}
 }
 return {items,issues,files};
}
