import { courseCoverage, type Course, type Standard, type Verification } from '@open-campus/schema';

// Next's static export rejects a dynamic route whose generateStaticParams is empty, so a route with
// no content yet renders one placeholder page that calls notFound().
export const PLACEHOLDER = '__none__';
export function staticParamsOrPlaceholder<P extends Record<string, string>>(params: P[], placeholder: P): P[] {
  return params.length ? params : [placeholder];
}

export type CourseView = ReturnType<typeof courseView>;
/** A topic's state in words: planned, drafted, or checked by a second lane (SPEC tiers T1 to T3). */
export function topicStatus(drafted: boolean, verification?: Verification): string {
  if (!drafted) return 'Planned';
  return verification && verification.result !== 'disputed' ? 'Drafted and checked by a second model' : 'Drafted, not yet checked';
}

/** What a course page shows: anchors, the topic plan in order, and coverage grouped by weighted area. */
export function courseView(course: Course, standards: Standard[], drafted: Map<string, Verification | undefined> = new Map()) {
  const cov = courseCoverage(course, standards);
  const nodes = new Map(standards.flatMap((s) => s.nodes.map((n) => [n.code, n] as const)));
  const topicTitle = new Map(course.topics.map((t) => [t.id, t.title]));
  const areas: { code: string; title: string; weight?: number; rows: { code: string; title: string; topics: string[] }[] }[] = [];
  for (const r of cov.rows) {
    const parent = nodes.get(nodes.get(r.code)?.parent ?? '');
    const key = parent?.code ?? '';
    let area = areas.find((a) => a.code === key);
    if (!area) areas.push((area = { code: key, title: parent?.title ?? 'Other', weight: parent?.weight, rows: [] }));
    area.rows.push({ code: r.code, title: nodes.get(r.code)?.title ?? r.code, topics: r.topics.map((id) => topicTitle.get(id) ?? id) });
  }
  return {
    anchors: course.anchors.flatMap((a) => {
      const s = standards.find((x) => x.id === a.standard);
      return s ? [{ id: s.id, title: s.title, publisher: s.publisher, source: s.source, retrieved: s.retrieved }] : [];
    }),
    topics: course.topics.map((t, i) => ({ number: i + 1, id: t.id, drafted: drafted.has(t.id), status: topicStatus(drafted.has(t.id), drafted.get(t.id)), title: t.title, codes: t.codes, requires: t.requires, objectives: t.objectives ?? [], prerequisites: t.prerequisites.map((p) => topicTitle.get(p) ?? p) })),
    areas,
    covered: cov.rows.length - cov.missing.length,
    total: cov.rows.length,
  };
}
