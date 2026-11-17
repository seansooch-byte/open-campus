import { z } from 'zod';
export const IdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const TextSchema = z.string().trim().min(1);
export const DateSchema = z.iso.date();
export const LaneSchema = z.enum(['claude','codex','grok','sean']);
export type Lane = z.infer<typeof LaneSchema>;
export const VerificationSchema = z.strictObject({ drafted_by: LaneSchema, verified_by: LaneSchema, model: TextSchema, date: DateSchema, result: z.enum(['pass','fixed','disputed']), notes: z.string().optional() }).refine(v => v.drafted_by !== v.verified_by, { message: 'Drafting and verifying lanes must differ' });
export type Verification = z.infer<typeof VerificationSchema>;
export const SectionSchema = z.enum(['bio-biochem','chem-phys','psych-soc','cars']);
export const AamcSectionSchema = z.enum(['bio-biochem','chem-phys','psych-soc']);
export const SubjectSchema = z.enum(['biology','biochemistry','general-chemistry','organic-chemistry','physics','psychology-sociology']);
export const FcSchema = z.enum(['FC1','FC2','FC3','FC4','FC5','FC6','FC7','FC8','FC9','FC10']);
export const CategorySchema = z.enum(['1A','1B','1C','1D','2A','2B','2C','3A','3B','4A','4B','4C','4D','4E','5A','5B','5C','5D','5E','6A','6B','6C','7A','7B','7C','8A','8B','8C','9A','9B','10A']);
export const SkillSchema = z.enum(['S1','S2','S3','S4','C1','C2','C3']);
export const AamcTagSchema = z.strictObject({fc: FcSchema, category: CategorySchema, skill: SkillSchema});
export type AamcTag = z.infer<typeof AamcTagSchema>;
export const reviewFields = {clinical: z.boolean().default(false), sean_review: z.enum(['pending','approved','rejected']).optional()};
export const sharedFields = {...reviewFields, verification: VerificationSchema.optional(), example: z.boolean().optional()};
export function clinicalReview(v: {clinical: boolean; sean_review?: string}) { return !v.clinical || v.sean_review !== undefined; }
