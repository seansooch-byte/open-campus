import type {Course,UnitType} from '@open-campus/schema';

// The publish queue is derived, never stored: every topic a course plan lists that has no draft yet.
// Order: courses after their prerequisite courses; otherwise general education first, then by course code;
// inside a course, the plan's teaching order. A topic is held (not drafted) when the players cannot show one
// of its unit types yet, when it failed verification before, or when an earlier prerequisite is held.

/** Unit types a drafted topic can use today: the lesson (with KaTeX), the card deck and the question player. */
export const DRAFTABLE:ReadonlySet<UnitType>=new Set<UnitType>(['prose','cards','mcq','math']);

export type QueueEntry={course:string;code:string;topic:string;title:string;codes:string[];objectives:string[];prerequisites:string[]};
export type Held={course:string;topic:string;reason:string};

const blockRank:Record<Course['block'],number>={'general-education':0,'supporting':1,'major-core':2,'major-elective':3};

function courseOrder(courses:Course[]):Course[] {
 const byKey=[...courses].sort((a,b)=>blockRank[a.block]-blockRank[b.block]||a.code.localeCompare(b.code));
 const ids=new Set(courses.map(c=>c.id)), placed=new Set<string>(), out:Course[]=[];
 while(out.length<byKey.length) {
  // The first course (in key order) whose planned prerequisite courses are all placed; a cycle falls back to key order.
  const next=byKey.find(c=>!placed.has(c.id)&&c.prerequisites.every(p=>!ids.has(p)||placed.has(p)))??byKey.find(c=>!placed.has(c.id))!;
  placed.add(next.id);out.push(next);
 }
 return out;
}

/** drafted and held hold "course/topic" keys. */
export function deriveQueue(courses:Course[],drafted:ReadonlySet<string>,held:ReadonlySet<string>=new Set()):{ready:QueueEntry[];blocked:Held[]} {
 const ready:QueueEntry[]=[], blocked:Held[]=[];
 for(const c of courseOrder(courses)) {
  const heldHere=new Set<string>();
  for(const t of c.topics) {
   const key=`${c.id}/${t.id}`;
   if(drafted.has(key)) continue;
   const missing=t.requires.filter(u=>!DRAFTABLE.has(u));
   const heldPrereq=t.prerequisites.find(p=>heldHere.has(p));
   const reason=held.has(key)?'held after a failed verification'
    :missing.length?`needs unit type ${missing.join(', ')}`
    :heldPrereq?`prerequisite ${heldPrereq} is held`:undefined;
   if(reason) {heldHere.add(t.id);blocked.push({course:c.id,topic:t.id,reason});continue;}
   ready.push({course:c.id,code:c.code,topic:t.id,title:t.title,codes:t.codes,objectives:t.objectives??[],prerequisites:t.prerequisites});
  }
 }
 return {ready,blocked};
}

/** Drafts on the hand-off branch (as "course/topic") that main has not published and that are not held, in branch order. */
export function pendingToCarry(onBranch:string[],drafted:ReadonlySet<string>,held:ReadonlySet<string>):string[] {
 return onBranch.filter(k=>!drafted.has(k)&&!held.has(k));
}
