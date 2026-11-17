import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as schemas from './index.js';
export function exportedSchemas(): Record<string,string> {
 return Object.fromEntries(Object.entries(schemas).filter(([name])=>name.endsWith('Schema')).map(([name,schema])=>[name,JSON.stringify(z.toJSONSchema(schema as z.ZodType),null,2)+'\n']));
}
export async function exportSchemas(directory=fileURLToPath(new URL('../json-schema/',import.meta.url))) {
 await mkdir(directory,{recursive:true});
 for(const [name,json] of Object.entries(exportedSchemas())) await writeFile(`${directory}/${name}.json`,json);
}
if(process.argv[1]===fileURLToPath(import.meta.url)) await exportSchemas();
