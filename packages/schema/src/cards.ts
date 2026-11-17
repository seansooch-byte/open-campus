import { z } from 'zod';
import {IdSchema, TextSchema, CategorySchema, VerificationSchema, reviewFields, clinicalReview} from './common.js';
export const CardSchema = z.strictObject({id:IdSchema,front:TextSchema,back:TextSchema,categories:z.array(CategorySchema).optional(),tags:z.array(TextSchema).optional(),...reviewFields,verification:VerificationSchema.optional()}).refine(clinicalReview,{message:'Clinical items require sean_review'});
export type Card = z.infer<typeof CardSchema>;
export const CardDeckSchema = z.strictObject({topic_id:IdSchema,verification:VerificationSchema.optional(),cards:z.array(CardSchema).min(1),example:z.boolean().optional()});
export type CardDeck = z.infer<typeof CardDeckSchema>;
