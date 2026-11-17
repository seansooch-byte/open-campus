import { z } from 'zod';
import {IdSchema,TextSchema,VerificationSchema,reviewFields,clinicalReview} from './common.js';
import {CodeSchema} from './standard.js';
const KeySchema=z.enum(['A','B','C','D']);
// codes: the outline codes the question tests; each must belong to one of the set's topics.
export const QuestionSchema=z.strictObject({id:IdSchema,stem:TextSchema,choices:z.array(z.strictObject({key:KeySchema,text:TextSchema,explanation:TextSchema})).length(4).refine(c=>c.every((v,i)=>v.key===['A','B','C','D'][i]),{message:'Choices must be A, B, C, D in order'}),answer:KeySchema,codes:z.array(CodeSchema).min(1),difficulty:z.number().int().min(1).max(5),...reviewFields,verification:VerificationSchema.optional()}).refine(clinicalReview,{message:'Clinical items require sean_review'});
export type Question=z.infer<typeof QuestionSchema>;
// topics: the course topics this set tests, main topic first.
export const QuestionSetSchema=z.strictObject({id:IdSchema,title:TextSchema,topics:z.array(IdSchema).min(1).refine(t=>new Set(t).size===t.length,{message:'Topic IDs must be unique'}),passage:z.strictObject({title:TextSchema.optional(),body:TextSchema}).nullable().default(null),questions:z.array(QuestionSchema).min(1),verification:VerificationSchema.optional(),example:z.boolean().optional()}).refine(s=>new Set(s.questions.map(q=>q.id)).size===s.questions.length,{message:'Question IDs must be unique within a set'});
export type QuestionSet=z.infer<typeof QuestionSetSchema>;
export function isExamEligible(question: Question, set: Pick<QuestionSet,'verification'|'example'>): boolean {
 const verification=question.verification ?? set.verification;
 return !set.example && (!question.clinical || question.sean_review==='approved') && (verification?.result==='pass' || verification?.result==='fixed');
}
