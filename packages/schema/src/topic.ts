import { z } from 'zod';
import {IdSchema, DateSchema, TextSchema, sharedFields, clinicalReview} from './common.js';
export const DiagramRefSchema = z.strictObject({id: IdSchema, file: z.string().regex(/^diagrams\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(svg|mmd|smi)$/), kind: z.enum(['svg','mermaid','smiles']), alt: TextSchema, caption: TextSchema.optional()}).refine(d => d.file.endsWith({svg:'.svg',mermaid:'.mmd',smiles:'.smi'}[d.kind]), {message:'Diagram kind must match extension'});
export type DiagramRef = z.infer<typeof DiagramRefSchema>;
// A topic's title, outline codes, objectives and prerequisites live in its course plan (course.json);
// the topic file carries only what is drafted: the body, its diagrams, version and review state.
export const TopicFrontmatterSchema = z.strictObject({id: IdSchema, diagrams: z.array(DiagramRefSchema).default([]), version: z.number().int().min(1), updated: DateSchema, ...sharedFields}).refine(clinicalReview,{message:'Clinical items require sean_review'});
export type TopicFrontmatter = z.infer<typeof TopicFrontmatterSchema>;
