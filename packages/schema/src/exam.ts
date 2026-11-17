import { z } from 'zod';
import {IdSchema,TextSchema} from './common.js';
// A timed practice exam for one course, drawn from that course's question sets.
export const ExamSchema=z.strictObject({id:IdSchema,title:TextSchema,time_minutes:z.number().int().positive(),items:z.array(z.strictObject({set_id:IdSchema,question_ids:z.array(IdSchema).min(1).optional()})).min(1)});
export type Exam=z.infer<typeof ExamSchema>;
