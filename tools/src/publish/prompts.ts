import type {Standard} from '@open-campus/schema';
import type {QueueEntry} from './queue.js';

// The fixed briefs for the two lanes. The drafting lane writes a topic; the verifying lane checks it
// against CHECKLIST and returns findings in VERIFY_SCHEMA. Both see the same rules, so a finding is
// always something the drafter was told.

export type Draft={body:string;cards:{id:string;front:string;back:string}[];questions:{id:string;stem:string;choices:{key:'A'|'B'|'C'|'D';text:string;explanation:string}[];answer:'A'|'B'|'C'|'D';codes:string[];difficulty:number}[]};
export type Finding={file:string;where:string;problem:string;fix:string};
export type Verdict={pass:boolean;findings:Finding[]};

const id={type:'string',pattern:'^[a-z0-9]+(-[a-z0-9]+)*$'};
const key={type:'string',enum:['A','B','C','D']};
export const DRAFT_SCHEMA={type:'object',additionalProperties:false,required:['body','cards','questions'],properties:{
 body:{type:'string',description:'The lesson in MDX, without frontmatter'},
 cards:{type:'array',minItems:12,maxItems:20,items:{type:'object',additionalProperties:false,required:['id','front','back'],properties:{id,front:{type:'string'},back:{type:'string'}}}},
 questions:{type:'array',minItems:10,maxItems:14,items:{type:'object',additionalProperties:false,required:['id','stem','choices','answer','codes','difficulty'],properties:{
  id,stem:{type:'string'},answer:key,codes:{type:'array',minItems:1,items:{type:'string'}},difficulty:{type:'integer',minimum:1,maximum:3},
  choices:{type:'array',minItems:4,maxItems:4,items:{type:'object',additionalProperties:false,required:['key','text','explanation'],properties:{key,text:{type:'string'},explanation:{type:'string'}}}}}}},
}};
export const VERIFY_SCHEMA={type:'object',additionalProperties:false,required:['pass','findings'],properties:{
 pass:{type:'boolean'},
 findings:{type:'array',items:{type:'object',additionalProperties:false,required:['file','where','problem','fix'],properties:{file:{type:'string'},where:{type:'string'},problem:{type:'string'},fix:{type:'string'}}}},
}};

export const RULES=`House rules for every Open Campus topic:
1. Correct. Every statement, worked example, card and answer key is true at the level of a first college course. Every arithmetic step checks.
2. Scoped. Teach exactly the topic's objectives and outline codes. Do not teach later topics in the plan; you may use earlier ones.
3. Original. Write in your own words. Do not reproduce or closely paraphrase any textbook, test-prep company or exam publisher. Do not name commercial test-prep companies.
4. No em dashes or en dashes anywhere (the characters U+2014 and U+2013). Use commas, colons, parentheses or separate sentences. A minus sign in math is fine.
5. Lesson (body): MDX with no frontmatter, 1000 to 1600 words. Open with one short paragraph saying what the topic is for, with no heading above it. Then "## " sections, "### " subsections where useful, at least two worked examples in bold "**Worked example.**" paragraphs, GFM tables where a comparison helps, and a final "## Summary" with a short bullet list. Math in KaTeX: $...$ inline and $$ on its own lines for display. Plain, direct sentences for an adult learner. No HTML, no imports, no JSX components, no images, no links.
6. Cards: 14 to 18. Each card tests one fact, rule or move from the lesson. Fronts are questions; backs answer in one to three sentences. Math in Unicode (for example √, ², ³, ≤, ≥, ≠, π, ∞, ∪, ∩, ½), never LaTeX or $ signs. Ids are short kebab-case and unique.
7. Questions: 12 single-best-answer items, difficulty 1 to 3 (about four of each). Exactly four choices keyed A, B, C, D in order; one is right. The right answer's position varies across the set (each of A, B, C and D is the answer at least twice). Each distractor is a mistake a learner really makes, and every choice's explanation says why it is right or what mistake leads to it. Stems stand alone and are answerable from the lesson. Each question's codes are drawn only from the topic's codes. Math in Unicode, never LaTeX. Ids are short kebab-case and unique.`;

export const CHECKLIST=`Check the topic files against each item and report every failure as a finding:
A. Correctness: every claim, worked example step, card back, answer key and explanation is true. Recompute every calculation.
B. Answer keys: exactly one choice is correct for each question, and the key names it. No second choice is also defensible.
C. Explanations: every choice's explanation is accurate about that choice.
D. Scope: the lesson, cards and questions cover the listed objectives, stay on the listed outline codes, and do not depend on topics later in the plan.
E. Format: lesson math is KaTeX that renders; cards and questions use Unicode math with no LaTeX or $ signs; question codes come only from the topic's codes; each of A to D is the answer at least twice.
F. Style: no em dashes or en dashes anywhere; no named test-prep companies; nothing that reads as copied from a known textbook or exam.
Set pass to true only when there are no findings. Do not report matters of taste; report only failures of A to F, each with a concrete fix.`;

export type Context={entry:QueueEntry;courseTitle:string;standard?:Standard;planTitles:string[];example:{body:string;cards:string;questions:string}};

function brief(c:Context):string {
 const nodes=c.standard?.nodes??[];
 const codeLines=c.entry.codes.map(code=>{
  const n=nodes.find(x=>x.code===code), parent=n?.parent?nodes.find(x=>x.code===n.parent):undefined;
  return `- ${code}: ${parent?`${parent.title} > `:''}${n?.title??'(not in the outline)'}`;
 });
 const i=c.planTitles.indexOf(c.entry.title);
 return `Course: ${c.entry.code} ${c.courseTitle}
Topic id: ${c.entry.topic}
Topic title: ${c.entry.title}
Outline${c.standard?` (${c.standard.title})`:''} codes this topic covers:
${codeLines.join('\n')}
Objectives:
${c.entry.objectives.map(o=>`- ${o}`).join('\n')||'- (none listed: teach the codes above)'}
Earlier topics in the plan (may be assumed): ${c.planTitles.slice(0,i).join('; ')||'none'}
Later topics in the plan (do not teach): ${c.planTitles.slice(i+1).join('; ')||'none'}`;
}

export function draftPrompt(c:Context):string {
 return `You are drafting one topic of Open Campus, a free open university. Return the lesson body, the card deck and the practice questions as JSON in the given schema.

${brief(c)}

${RULES}

For shape and register only (do not reuse its content), here is a finished topic from another course plan.
<example-lesson>
${c.example.body}
</example-lesson>
<example-cards>
${c.example.cards}
</example-cards>
<example-questions>
${c.example.questions}
</example-questions>`;
}

export function revisePrompt(c:Context,current:Draft,findings:Finding[]):string {
 return `You drafted this Open Campus topic. An independent reviewer found the problems below. Fix every one, change nothing else that is correct, and return the whole topic again as JSON in the given schema.

${brief(c)}

${RULES}

<findings>
${JSON.stringify(findings,null,1)}
</findings>
<current-draft>
${JSON.stringify(current)}
</current-draft>`;
}

export function verifyPrompt(c:Context,files:string[]):string {
 return `You are the verifying lane for Open Campus, a free open university. A different model drafted one topic. Read these files (paths relative to the working directory) and check them. Do not edit anything.
${files.map(f=>`- ${f}`).join('\n')}
The YAML frontmatter at the top of topic.mdx is written by the publishing tool, not the drafter: it is expected, so do not report it. Rule 5 applies to the body after it.

${brief(c)}

The drafter was given these rules:
${RULES}

${CHECKLIST}`;
}

/** Mechanical checks that need no model: run before the verifying lane so it never spends a round on them. */
export function lintDraft(d:Draft,codes:string[]):Finding[] {
 const out:Finding[]=[];
 const dash=/[\u2013\u2014]/;
 const scan=(file:string,where:string,text:string)=>{if(dash.test(text)) out.push({file,where,problem:'contains an em or en dash',fix:'rewrite without U+2013 or U+2014'});};
 scan('topic.mdx','body',d.body);
 d.cards.forEach(c=>{scan('cards.json',c.id,c.front+c.back);if(/\$|\\[a-z]+/.test(c.front+c.back)) out.push({file:'cards.json',where:c.id,problem:'LaTeX or $ in a card',fix:'use Unicode math'});});
 d.questions.forEach(q=>{
  scan('questions',q.id,q.stem+q.choices.map(x=>x.text+x.explanation).join(''));
  if(/\$|\\[a-z]+/.test(q.stem+q.choices.map(x=>x.text).join(''))) out.push({file:'questions',where:q.id,problem:'LaTeX or $ in a question',fix:'use Unicode math'});
  const bad=q.codes.filter(x=>!codes.includes(x));
  if(bad.length) out.push({file:'questions',where:q.id,problem:`codes ${bad.join(', ')} are not this topic's`,fix:`use only ${codes.join(', ')}`});
  if(q.choices.map(x=>x.key).join('')!=='ABCD') out.push({file:'questions',where:q.id,problem:'choices are not A, B, C, D in order',fix:'key the four choices A to D in order'});
 });
 for(const k of ['A','B','C','D']) if(d.questions.filter(q=>q.answer===k).length<2) out.push({file:'questions',where:'set',problem:`${k} is the answer fewer than two times`,fix:'rebalance answer positions'});
 for(const [file,ids] of [['cards.json',d.cards.map(c=>c.id)],['questions',d.questions.map(q=>q.id)]] as const) if(new Set(ids).size!==ids.length) out.push({file,where:'ids',problem:'duplicate ids',fix:'make ids unique'});
 if(/^---/.test(d.body.trimStart())) out.push({file:'topic.mdx',where:'start',problem:'body has frontmatter',fix:'return the body only'});
 return out;
}
