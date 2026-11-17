import { z } from 'zod';
import {IdSchema,TextSchema,DateSchema,sharedFields,clinicalReview} from './common.js';
export const GuideFrontmatterSchema=z.strictObject({id:IdSchema,title:TextSchema,kind:z.enum(['amcas','aacomas','tmdsas','personal-statement','secondary','interview','mmi','path','other']),audience:z.enum(['md','do','both']),sources:z.array(z.strictObject({url:z.url(),as_of:DateSchema,note:TextSchema.optional()})),...sharedFields}).refine(clinicalReview,{message:'Clinical items require sean_review'});
export type GuideFrontmatter=z.infer<typeof GuideFrontmatterSchema>;
