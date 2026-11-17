import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {validate} from './validate.js';
import {lintOriginality} from './originality/index.js';
const args=process.argv.slice(2);
const command=args.shift();
if(command==='coverage') {
 const {runCoverage}=await import('./coverage/cli.js');
 process.exit(await runCoverage(args));
}
if(command==='clinical-packet'||command==='clinical-apply') {
 const {runPacket,runApply}=await import('./clinical/cli.js');
 process.exit(await (command==='clinical-packet'?runPacket(args):runApply(args)));
}
if(command!=='validate'&&command!=='originality'&&command!=='all') throw new Error('Usage: cli.ts validate|originality|all [content-directory] [--json]');
const root=resolve(args.find(a=>!a.startsWith('--'))??fileURLToPath(new URL('../../content/',import.meta.url)));
const reported=command==='all'?[...await validate(root),...await lintOriginality(root)]:await (command==='validate'?validate(root):lintOriginality(root));
const issues=[...new Map(reported.map(issue=>[JSON.stringify(issue),issue])).values()];
const counts={errors:issues.filter(i=>i.severity==='error').length,warnings:issues.filter(i=>i.severity==='warning').length,info:issues.filter(i=>i.severity==='info').length};
if(args.includes('--json')) console.log(JSON.stringify({issues,summary:counts},null,2));
else {
 for(const issue of issues) console.log(`${issue.file}: ${issue.rule}: ${issue.message} [${issue.severity}]`);
 console.log(`${command}: ${counts.errors} errors, ${counts.warnings} warnings, ${counts.info} info`);
}
process.exitCode=counts.errors?1:0;
