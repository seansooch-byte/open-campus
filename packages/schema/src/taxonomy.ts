import { z } from 'zod';
import {TextSchema,DateSchema,IdSchema,SectionSchema,AamcSectionSchema,SubjectSchema,FcSchema,CategorySchema,SkillSchema} from './common.js';
const Title=TextSchema.refine(s=>s.split(/\s+/).length<=8,{message:'Titles must be at most eight words'});
export const TaxonomySchema=z.strictObject({
 outlineVersion:TextSchema,
 source:z.url().regex(/^https:\/\//,{message:'Source must be an https URL'}),
 retrieved:DateSchema,
 note:TextSchema,
 sections:z.array(z.strictObject({id:SectionSchema,title:Title})).min(1),
 foundationalConcepts:z.array(z.strictObject({id:FcSchema,title:Title,section:AamcSectionSchema,categories:z.array(z.strictObject({id:CategorySchema,title:Title})).min(1)}).refine(fc=>fc.categories.every(c=>parseInt(c.id,10)===Number(fc.id.slice(2))),{message:'Category number must match its foundational concept'})).min(1),
 skills:z.array(z.strictObject({id:SkillSchema,title:Title,kind:z.enum(['sirs','cars'])})).min(1),
});
export type Taxonomy=z.infer<typeof TaxonomySchema>;
