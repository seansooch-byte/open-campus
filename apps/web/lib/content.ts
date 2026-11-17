import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import { CardDeckSchema, QuestionSetSchema, TopicFrontmatterSchema, type CardDeck, type QuestionSet, type TopicFrontmatter } from '@open-campus/schema';

// Build-time only. `next build` runs with cwd = apps/web.
const ROOT = process.env.CONTENT_DIR ?? resolve(process.cwd(), '../../content');

export type Topic = { subject: string; slug: string; frontmatter: TopicFrontmatter; body: string; deck?: CardDeck; dir: string };
export type SetEntry = { section: string; slug: string; set: QuestionSet };

async function dirs(path: string): Promise<string[]> {
  if (!existsSync(path)) return [];
  return (await readdir(path, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export async function loadTopics(): Promise<Topic[]> {
  const topics: Topic[] = [];
  for (const subject of await dirs(join(ROOT, 'subjects'))) {
    for (const slug of await dirs(join(ROOT, 'subjects', subject))) {
      const dir = join(ROOT, 'subjects', subject, slug);
      const file = join(dir, 'topic.mdx');
      if (!existsSync(file)) continue;
      const parsed = matter(await readFile(file, 'utf8'));
      const frontmatter = TopicFrontmatterSchema.parse(parsed.data);
      const cardsFile = join(dir, 'cards.json');
      const deck = existsSync(cardsFile) ? CardDeckSchema.parse(JSON.parse(await readFile(cardsFile, 'utf8'))) : undefined;
      topics.push({ subject, slug, frontmatter, body: parsed.content, deck, dir });
    }
  }
  return topics;
}

export async function loadSets(): Promise<SetEntry[]> {
  const sets: SetEntry[] = [];
  for (const section of await dirs(join(ROOT, 'questions'))) {
    const names = (await readdir(join(ROOT, 'questions', section))).filter((n) => n.endsWith('.json')).sort();
    for (const name of names) {
      const set = QuestionSetSchema.parse(JSON.parse(await readFile(join(ROOT, 'questions', section, name), 'utf8')));
      sets.push({ section, slug: name.replace(/\.json$/, ''), set });
    }
  }
  return sets;
}

export async function loadDiagramFile(topic: Topic, file: string): Promise<string> {
  return readFile(join(topic.dir, file), 'utf8');
}
