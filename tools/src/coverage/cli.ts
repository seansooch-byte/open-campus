import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadContent} from '../content.js';
import {buildReport,formatReport} from './index.js';
const usage='Usage: cli.ts coverage [content-directory] [--min-questions N] [--include-examples] [--json]';
/** Returns the process exit code. Gaps are reported, not failed on; content errors and bad flags fail. */
export async function runCoverage(args:string[]):Promise<number> {
 const positional:string[]=[];
 let minQuestions=10, includeExamples=false, json=false;
 for(let i=0;i<args.length;i++) {
  const a=args[i]!;
  if(a==='--json') json=true;
  else if(a==='--include-examples') includeExamples=true;
  else if(a==='--min-questions') {
   const n=Number(args[++i]);
   if(!Number.isInteger(n)||n<0) {console.error(`--min-questions needs a non-negative integer\n${usage}`);return 2;}
   minQuestions=n;
  } else if(a.startsWith('--')) {console.error(`Unknown flag ${a}\n${usage}`);return 2;}
  else positional.push(a);
 }
 if(positional.length>1) {console.error(`Expected at most one content directory, got ${positional.length}\n${usage}`);return 2;}
 const root=resolve(positional[0]??fileURLToPath(new URL('../../../content/',import.meta.url)));
 try {
  const {items,issues}=await loadContent(root);
  const errors=issues.filter(i=>i.severity==='error');
  for(const e of errors) console.error(`${e.file}: ${e.rule}: ${e.message}`);
  const report=buildReport(items,{minQuestions,includeExamples});
  console.log(json?JSON.stringify(report,null,2):formatReport(report));
  return errors.length?1:0;
 } catch(e) {
  console.error(String(e));
  return 2;
 }
}
