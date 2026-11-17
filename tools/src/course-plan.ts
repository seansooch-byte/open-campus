import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {StandardSchema,CourseSchema,courseCoverage,type Course,type Standard} from '@open-campus/schema';
// Renders a course's README.md: the topic plan in teaching order and the per-code coverage table
// the T1 gate asks for. Generated from course.json and the anchored standards; never hand-edited.
export function renderCoursePlan(course:Course,standards:Standard[]):string {
 const cov=courseCoverage(course,standards), title=new Map<string,string>(), weight=new Map<string,number|undefined>(), parent=new Map<string,string|undefined>();
 for(const s of standards) for(const n of s.nodes) {title.set(n.code,n.title);weight.set(n.code,n.weight);parent.set(n.code,n.parent);}
 const area=(code:string)=>{const p=parent.get(code);if(!p) return '';const w=weight.get(p);return `${p} ${title.get(p)}${w===undefined?'':` (${w}%)`}`;};
 const out=[`# ${course.code} ${course.title}`,'',`Generated from \`course.json\` by \`pnpm course-plan\`. Do not edit by hand.`,'',
  `Tier ${course.tier}. ${course.credits} credits, ${course.block.replace('-',' ')} block. Anchored to ${course.anchors.map(a=>standards.find(s=>s.id===a.standard)?.title??a.standard).join(', ')}.`,''];
 if(course.summary) out.push(course.summary,'');
 out.push('## Topic plan','','In teaching order. Every prerequisite comes earlier.','','| # | Topic | Codes | Unit types | Prerequisites |','|---|---|---|---|---|');
 course.topics.forEach((t,i)=>out.push(`| ${i+1} | ${t.title} | ${t.codes.join(', ')} | ${t.requires.join(', ')} | ${t.prerequisites.join(', ')||'none'} |`));
 out.push('','## Coverage by code','',`${cov.rows.length-cov.missing.length} of ${cov.rows.length} codes covered.`,'','| Area | Code | Topics | Unit types |','|---|---|---|---|');
 for(const r of cov.rows) out.push(`| ${area(r.code)} | ${r.code} ${title.get(r.code)} | ${r.topics.join(', ')||'**not covered**'} | ${r.types.join(', ')||'none'} |`);
 for(const u of cov.unknown) out.push('',`Unknown code ${u.code} on topic ${u.topic}.`);
 return out.join('\n')+'\n';
}
/** Writes (or with check, compares) README.md for every course under root/courses. Returns stale course ids. */
export async function writeCoursePlans(root:string,check=false):Promise<string[]> {
 const standards=await Promise.all((await readdir(join(root,'standards'))).filter(f=>f.endsWith('.json')).map(async f=>StandardSchema.parse(JSON.parse(await readFile(join(root,'standards',f),'utf8')))));
 const stale:string[]=[];
 for(const dir of await readdir(join(root,'courses'))) {
  const course=CourseSchema.parse(JSON.parse(await readFile(join(root,'courses',dir,'course.json'),'utf8')));
  const md=renderCoursePlan(course,standards), file=join(root,'courses',dir,'README.md');
  const current=await readFile(file,'utf8').catch(()=>'');
  if(current!==md) {stale.push(course.id);if(!check) await writeFile(file,md);}
 }
 return stale;
}
