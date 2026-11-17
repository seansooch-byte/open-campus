import { z } from 'zod';
import {IdSchema,TextSchema} from './common.js';
import {CodeSchema,leafCodes,type Standard} from './standard.js';
// The unit types of SPEC.md section 6. A type is listed here when the spec names it; it is usable
// for content only once packages/unit-types/<type>/ exists.
export const UnitTypeSchema=z.enum(['prose','cards','mcq','math','code','open','notebook','ledger','sim','structure','brief','audio','portfolio','proof']);
export type UnitType=z.infer<typeof UnitTypeSchema>;
export const TierSchema=z.enum(['T0','T1','T2','T3','T4','T5']);
export const CourseTopicSchema=z.strictObject({
 id:IdSchema,title:TextSchema,
 codes:z.array(CodeSchema).min(1),
 requires:z.array(UnitTypeSchema).min(1),
 prerequisites:z.array(IdSchema).default([]),
 objectives:z.array(TextSchema).optional(),
});
// Topics are listed in teaching order, so a prerequisite must appear earlier: the plan is a DAG by construction.
export const CourseSchema=z.strictObject({
 id:IdSchema,code:z.string().regex(/^[A-Z]{2,4}-\d{3}$/),title:TextSchema,
 credits:z.number().int().positive(),
 block:z.enum(['general-education','major-core','major-elective','supporting']),
 tier:TierSchema,
 summary:TextSchema.optional(),
 anchors:z.array(z.strictObject({standard:IdSchema,codes:z.array(CodeSchema).min(1).optional()})).min(1),
 prerequisites:z.array(IdSchema).default([]),
 topics:z.array(CourseTopicSchema).min(1),
}).superRefine((c,ctx)=>{
 const seen=new Set<string>();
 c.topics.forEach((t,i)=>{
  if(seen.has(t.id)) ctx.addIssue({code:'custom',path:['topics',i,'id'],message:`Duplicate topic ${t.id}`});
  for(const p of t.prerequisites) if(!seen.has(p)) ctx.addIssue({code:'custom',path:['topics',i,'prerequisites'],message:`${t.id}: prerequisite ${p} must be an earlier topic`});
  seen.add(t.id);
 });
});
export type Course=z.infer<typeof CourseSchema>;
export type CoverageRow={standard:string;code:string;topics:string[];types:UnitType[]};
/** Contract item 1 (Mapped): every leaf code in the course's slice, with the topics and unit types covering it. */
export function courseCoverage(course:Pick<Course,'anchors'|'topics'>,standards:Standard[]) {
 const missingStandards:string[]=[], rows:CoverageRow[]=[], duplicateCodes:string[]=[], unknownAnchorCodes:{standard:string;code:string}[]=[];
 for(const a of course.anchors) {
  const std=standards.find(s=>s.id===a.standard);
  if(!std) {missingStandards.push(a.standard);continue;}
  // A slice code the standard lacks would silently shrink what the course must cover.
  for(const code of a.codes??[]) if(!std.nodes.some(n=>n.code===code)) unknownAnchorCodes.push({standard:std.id,code});
  for(const code of leafCodes(std,a.codes)) {
   if(rows.some(r=>r.code===code)) {duplicateCodes.push(code);continue;}
   rows.push({standard:std.id,code,topics:[],types:[]});
  }
 }
 const unknown:{topic:string;code:string}[]=[];
 for(const t of course.topics) for(const code of t.codes) {
  const row=rows.find(r=>r.code===code);
  if(!row) {unknown.push({topic:t.id,code});continue;}
  row.topics.push(t.id);row.types=[...new Set([...row.types,...t.requires])].sort();
 }
 const missing=rows.filter(r=>r.topics.length===0).map(({standard,code})=>({standard,code}));
 return {rows,missing,unknown,missingStandards,unknownAnchorCodes,duplicateCodes};
}
