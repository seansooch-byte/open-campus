import { z } from 'zod';
import {IdSchema,TextSchema,SectionSchema} from './common.js';
export const ExamSchema=z.strictObject({id:IdSchema,title:TextSchema,sections:z.array(z.strictObject({section:SectionSchema,title:TextSchema,time_minutes:z.number().int().positive(),items:z.array(z.strictObject({set_id:IdSchema,question_ids:z.array(IdSchema).min(1).optional()})).min(1)})).min(1)});
export type Exam=z.infer<typeof ExamSchema>;
