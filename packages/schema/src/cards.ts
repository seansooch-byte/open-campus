import { z } from 'zod';
import {IdSchema, TextSchema, VerificationSchema, reviewFields, clinicalReview} from './common.js';
import {CodeSchema} from './standard.js';
// codes: optional narrowing to some of the topic's outline codes; omitted means all of them.
export const CardSchema = z.strictObject({id:IdSchema,front:TextSchema,back:TextSchema,codes:z.array(CodeSchema).min(1).optional(),...reviewFields,verification:VerificationSchema.optional()}).refine(clinicalReview,{message:'Clinical items require sean_review'});
export type Card = z.infer<typeof CardSchema>;
export const CardDeckSchema = z.strictObject({topic_id:IdSchema,verification:VerificationSchema.optional(),cards:z.array(CardSchema).min(1),example:z.boolean().optional()});
export type CardDeck = z.infer<typeof CardDeckSchema>;
