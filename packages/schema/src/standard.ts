import { z } from 'zod';
import {IdSchema,TextSchema,DateSchema} from './common.js';
// A standard is an outline Open Campus does not write (an exam blueprint, a credit-by-exam outline,
// a curriculum guideline), referenced by code. Titles are our own short paraphrases; when the
// publisher assigns no codes, Open Campus assigns them and says so in `note`.
export const CodeSchema=z.string().regex(/^[A-Z][A-Z0-9]*(?:[-.][A-Z0-9]+)*$/,{message:'Codes are upper-case segments joined by - or .'});
const Title=TextSchema.refine(t=>t.split(/\s+/).length<=8,{message:'Titles must be at most eight words'});
const Weight=z.number().positive().max(100);
const total=(xs:{weight?:number}[])=>xs.reduce((a,x)=>a+(x.weight??0),0);
const weightsOk=(xs:{weight?:number}[])=>xs.every(x=>x.weight===undefined)||(xs.every(x=>x.weight!==undefined)&&Math.abs(total(xs)-100)<1e-9);
export const StandardNodeSchema=z.strictObject({code:CodeSchema,level:IdSchema,title:Title,parent:CodeSchema.optional(),weight:Weight.optional(),note:TextSchema.optional()});
export const DimensionSchema=z.strictObject({id:IdSchema,title:Title,values:z.array(z.strictObject({id:IdSchema,title:Title,weight:Weight.optional()})).min(2)}).refine(d=>weightsOk(d.values),{message:'Dimension weights must all be given and total 100, or all be omitted'});
export const StandardSchema=z.strictObject({
 id:IdSchema,title:TextSchema,publisher:TextSchema,
 source:z.url().regex(/^https:\/\//,{message:'Source must be an https URL'}),
 retrieved:DateSchema,version:TextSchema,note:TextSchema,
 levels:z.array(z.strictObject({id:IdSchema,title:Title})).min(1),
 nodes:z.array(StandardNodeSchema).min(1),
 dimensions:z.array(DimensionSchema).optional(),
 exam:z.strictObject({questions:z.number().int().positive(),minutes:z.number().int().positive(),calculator:TextSchema.optional(),credit:TextSchema.optional()}).optional(),
}).superRefine((s,ctx)=>{
 const issue=(message:string)=>ctx.addIssue({code:'custom',message,path:['nodes']});
 const depth=new Map(s.levels.map((l,i)=>[l.id,i]));
 if(depth.size!==s.levels.length) issue('Level ids must be unique');
 const byCode=new Map<string,typeof s.nodes[number]>();
 for(const n of s.nodes) {if(byCode.has(n.code)) issue(`Duplicate code ${n.code}`);byCode.set(n.code,n);}
 for(const n of s.nodes) {
  const d=depth.get(n.level);
  if(d===undefined) {issue(`${n.code}: unknown level ${n.level}`);continue;}
  if(d===0) {if(n.parent) issue(`${n.code}: top-level nodes take no parent`);continue;}
  const p=n.parent&&byCode.get(n.parent);
  if(!p) issue(`${n.code}: missing parent ${n.parent??'(none)'}`);
  else if(depth.get(p.level)!==d-1) issue(`${n.code}: parent ${p.code} is not one level up`);
 }
 const groups=new Map<string,typeof s.nodes>();
 for(const n of s.nodes) groups.set(n.parent??'',[...(groups.get(n.parent??'')??[]),n]);
 for(const [parent,kids] of groups) if(!weightsOk(kids)) issue(`Weights under ${parent||'the top level'} must all be given and total 100, or all be omitted`);
});
export type Standard=z.infer<typeof StandardSchema>;
/** Codes with no children: the units a course must cover. Outline order. */
export function leafCodes(s:Pick<Standard,'nodes'>,within?:string[]):string[] {
 const parents=new Set(s.nodes.flatMap(n=>n.parent?[n.parent]:[]));
 const parentOf=new Map(s.nodes.map(n=>[n.code,n.parent]));
 const inside=(code:string):boolean=>!within||within.includes(code)||(parentOf.get(code)!==undefined&&inside(parentOf.get(code)!));
 return s.nodes.filter(n=>!parents.has(n.code)&&inside(n.code)).map(n=>n.code);
}
