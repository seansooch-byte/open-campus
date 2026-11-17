import { z } from 'zod';
import {IdSchema,TextSchema,DateSchema,VerificationSchema} from './common.js';
export const SchoolProfileSchema=z.strictObject({id:IdSchema,name:TextSchema,degree:z.enum(['MD','DO']),state:z.string().regex(/^[A-Z]{2}$/),website:z.url(),facts:z.array(z.strictObject({key:TextSchema,value:z.union([TextSchema,z.number(),z.boolean()]),unit:TextSchema.optional(),source_url:z.url(),as_of:DateSchema})).min(1),verification:VerificationSchema.optional(),notes:z.string().optional()});
export type SchoolProfile=z.infer<typeof SchoolProfileSchema>;
