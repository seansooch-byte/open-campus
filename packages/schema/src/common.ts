import { z } from 'zod';
export const IdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const TextSchema = z.string().trim().min(1);
export const DateSchema = z.iso.date();
export const LaneSchema = z.enum(['claude','codex','grok','sean']);
export type Lane = z.infer<typeof LaneSchema>;
export const VerificationSchema = z.strictObject({ drafted_by: LaneSchema, verified_by: LaneSchema, model: TextSchema, date: DateSchema, result: z.enum(['pass','fixed','disputed']), notes: z.string().optional() }).refine(v => v.drafted_by !== v.verified_by, { message: 'Drafting and verifying lanes must differ' });
export type Verification = z.infer<typeof VerificationSchema>;
export const reviewFields = {clinical: z.boolean().default(false), sean_review: z.enum(['pending','approved','rejected']).optional()};
export const sharedFields = {...reviewFields, verification: VerificationSchema.optional(), example: z.boolean().optional()};
export function clinicalReview(v: {clinical: boolean; sean_review?: string}) { return !v.clinical || v.sean_review !== undefined; }
