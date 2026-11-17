import { z } from 'zod';
import {IdSchema,TextSchema,VerificationSchema} from './common.js';
export const PathSchema=z.strictObject({id:IdSchema,title:TextSchema,track:z.enum(['md','do','both']),steps:z.array(z.strictObject({id:IdSchema,title:TextSchema,timing:TextSchema,description:TextSchema,refs:z.array(TextSchema).optional()})).min(1),verification:VerificationSchema.optional()});
export type Path=z.infer<typeof PathSchema>;
