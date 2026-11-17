import { Badge } from '@open-campus/ui';
import { loadSets, loadTopics } from '../lib/content';
import { Search } from './search';

export default async function Home() {
  const [topics, sets] = await Promise.all([loadTopics(), loadSets()]);
  const subjects = [...new Set(topics.map((t) => t.subject))];
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Pre-Med Library</h1>
      <Search />
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Topics</h2>
        {subjects.map((subject) => (
          <div key={subject}>
            <h3 className="font-semibold capitalize">{subject.replace(/-/g, ' ')}</h3>
            <ul className="list-disc pl-6">
              {topics.filter((t) => t.subject === subject).map((t) => (
                <li key={t.slug}>
                  <a href={`/topics/${t.subject}/${t.slug}/`}>{t.frontmatter.title}</a>{' '}
                  {t.frontmatter.example && <Badge tone="info">Example</Badge>}{' '}
                  {t.deck && <a href={`/cards/${t.subject}/${t.slug}/`} className="text-sm">cards</a>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <section>
        <h2 className="text-2xl font-semibold">Question sets</h2>
        <ul className="list-disc pl-6">
          {sets.map((s) => (
            <li key={`${s.section}/${s.slug}`}>
              <a href={`/questions/${s.section}/${s.slug}/`}>{s.set.title}</a> <Badge>{s.section.toUpperCase()}</Badge>{' '}
              {s.set.example && <Badge tone="info">Example</Badge>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
