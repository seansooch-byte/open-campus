import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import { CardDeckSchema, CourseSchema, QuestionSetSchema, StandardSchema, TopicFrontmatterSchema, type CardDeck, type Course, type QuestionSet, type Standard, type TopicFrontmatter } from '@open-campus/schema';

// Build-time only. `next build` runs with cwd = apps/web; tests run from the repo root.
const ROOT = process.env.CONTENT_DIR ?? (existsSync(resolve(process.cwd(), 'content')) ? resolve(process.cwd(), 'content') : resolve(process.cwd(), '../../content'));

export type Topic = { course: string; slug: string; frontmatter: TopicFrontmatter; body: string; deck?: CardDeck; dir: string };
export type SetEntry = { course: string; slug: string; set: QuestionSet };
export type CourseEntry = { course: Course; standards: Standard[]; topics: Topic[]; sets: SetEntry[] };

async function dirs(path: string): Promise<string[]> {
  if (!existsSync(path)) return [];
  return (await readdir(path, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}
async function jsonFiles(path: string): Promise<string[]> {
  if (!existsSync(path)) return [];
  return (await readdir(path)).filter((n) => n.endsWith('.json')).sort();
}
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));

async function loadTopics(course: string): Promise<Topic[]> {
  const topics: Topic[] = [];
  for (const slug of await dirs(join(ROOT, 'courses', course, 'topics'))) {
    const dir = join(ROOT, 'courses', course, 'topics', slug), file = join(dir, 'topic.mdx');
    if (!existsSync(file)) continue;
    const parsed = matter(await readFile(file, 'utf8'));
    const cardsFile = join(dir, 'cards.json');
    const deck = existsSync(cardsFile) ? CardDeckSchema.parse(await readJson(cardsFile)) : undefined;
    topics.push({ course, slug, frontmatter: TopicFrontmatterSchema.parse(parsed.data), body: parsed.content, deck, dir });
  }
  return topics;
}

async function loadSets(course: string): Promise<SetEntry[]> {
  const dir = join(ROOT, 'courses', course, 'questions');
  return Promise.all((await jsonFiles(dir)).map(async (n) => ({ course, slug: n.replace(/\.json$/, ''), set: QuestionSetSchema.parse(await readJson(join(dir, n))) })));
}

/** Every course with its anchored standards and its drafted topics and question sets. tools/ validate has checked the references. */
export async function loadCourses(): Promise<CourseEntry[]> {
  const standards = await Promise.all((await jsonFiles(join(ROOT, 'standards'))).map(async (n) => StandardSchema.parse(await readJson(join(ROOT, 'standards', n)))));
  const courses: CourseEntry[] = [];
  for (const id of await dirs(join(ROOT, 'courses'))) {
    const file = join(ROOT, 'courses', id, 'course.json');
    if (!existsSync(file)) continue;
    const course = CourseSchema.parse(await readJson(file));
    courses.push({ course, standards: standards.filter((s) => course.anchors.some((a) => a.standard === s.id)), topics: await loadTopics(id), sets: await loadSets(id) });
  }
  return courses;
}

export async function loadDiagramFile(topic: Topic, file: string): Promise<string> {
  return readFile(join(topic.dir, file), 'utf8');
}
