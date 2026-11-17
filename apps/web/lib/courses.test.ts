import { describe, expect, it } from 'vitest';
import { CourseSchema, StandardSchema } from '@open-campus/schema';
import { courseView, staticParamsOrPlaceholder, topicStatus, PLACEHOLDER } from './courses';
import { loadCourses } from './content';

const std = StandardSchema.parse({ id: 'demo-exam', title: 'Demo Exam', publisher: 'Board', source: 'https://example.org', retrieved: '2026-11-17', version: 'v1', note: 'n', levels: [{ id: 'area', title: 'Area' }, { id: 'topic', title: 'Topic' }], nodes: [{ code: 'D-1', level: 'area', title: 'Ops', weight: 70 }, { code: 'D-1.1', level: 'topic', parent: 'D-1', title: 'Exponents' }, { code: 'D-2', level: 'area', title: 'Graphs', weight: 30 }, { code: 'D-2.1', level: 'topic', parent: 'D-2', title: 'Shifts' }] });
const course = CourseSchema.parse({ id: 'ge-901', code: 'GE-901', title: 'Demo', credits: 3, block: 'general-education', tier: 'T1', anchors: [{ standard: 'demo-exam' }], topics: [{ id: 'powers', title: 'Powers', codes: ['D-1.1'], requires: ['math'] }, { id: 'moves', title: 'Moves', codes: ['D-2.1'], requires: ['math'], prerequisites: ['powers'] }] });

describe('courseView', () => {
  it('groups coverage rows under their weighted areas and names topics by title', () => {
    const v = courseView(course, [std]);
    expect(v.covered).toBe(2);
    expect(v.total).toBe(2);
    expect(v.areas.map((a) => [a.code, a.title, a.weight, a.rows.map((r) => [r.code, r.title, r.topics])])).toEqual([
      ['D-1', 'Ops', 70, [['D-1.1', 'Exponents', ['Powers']]]],
      ['D-2', 'Graphs', 30, [['D-2.1', 'Shifts', ['Moves']]]],
    ]);
    expect(v.anchors).toEqual([{ id: 'demo-exam', title: 'Demo Exam', publisher: 'Board', source: 'https://example.org', retrieved: '2026-11-17' }]);
  });
  it('lists prerequisite titles for each topic in order', () => {
    expect(courseView(course, [std]).topics.map((t) => [t.number, t.title, t.prerequisites])).toEqual([[1, 'Powers', []], [2, 'Moves', ['Powers']]]);
  });
});

describe('topicStatus', () => {
  const v = { drafted_by: 'claude', verified_by: 'codex', model: 'm', date: '2026-11-17', result: 'pass' } as const;
  it('names planned, drafted and second-lane checked topics; a disputed check does not count', () => {
    expect(topicStatus(false)).toBe('Planned');
    expect(topicStatus(true)).toBe('Drafted, not yet checked');
    expect(topicStatus(true, v)).toBe('Drafted and checked by a second model');
    expect(topicStatus(true, { ...v, result: 'disputed' })).toBe('Drafted, not yet checked');
  });
  it('courseView marks drafted topics', () => {
    expect(courseView(course, [std], new Map([['powers', undefined]])).topics.map((t) => [t.id, t.drafted])).toEqual([['powers', true], ['moves', false]]);
  });
});

describe('staticParamsOrPlaceholder', () => {
  it('passes real params through and stands in one placeholder for an empty list', () => {
    expect(staticParamsOrPlaceholder([{ a: 'x' }], { a: PLACEHOLDER })).toEqual([{ a: 'x' }]);
    expect(staticParamsOrPlaceholder([], { a: PLACEHOLDER })).toEqual([{ a: PLACEHOLDER }]);
  });
});

it('loads GE-111 from content with every code covered', async () => {
  const courses = await loadCourses();
  const ge = courses.find((c) => c.course.id === 'ge-111')!;
  expect(ge.course.topics).toHaveLength(19);
  const v = courseView(ge.course, ge.standards);
  expect([v.covered, v.total]).toEqual([19, 19]);
  expect(v.areas.map((a) => a.weight)).toEqual([25, 25, 30, 20]);
});
