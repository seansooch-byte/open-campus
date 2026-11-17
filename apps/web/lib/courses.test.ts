import { describe, expect, it } from 'vitest';
import { CourseSchema, StandardSchema } from '@open-campus/schema';
import { courseView, staticParamsOrPlaceholder, PLACEHOLDER } from './courses';
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
