import { readFileSync } from 'node:fs';
export const bannedSources: {names:string[];domains:string[]}=JSON.parse(readFileSync(new URL('../../originality/banned-sources.json',import.meta.url),'utf8'));
export function bannedDomain(url:string):boolean {
 const hostname=new URL(url).hostname.toLowerCase();
 return bannedSources.domains.some(d=>hostname===d||hostname.endsWith(`.${d}`));
}
