import { notFound } from 'next/navigation';
import { renderSmilesToSvg } from '@open-campus/tools/diagrams';
import { Deck, TopicPage, type TopicDiagram } from '@open-campus/ui';
import { loadCourses, loadDiagramFile } from '../../../../lib/content';
import { PLACEHOLDER, staticParamsOrPlaceholder, topicStatus } from '../../../../lib/courses';
import { Mdx } from '../../../../lib/mdx';

type Params = { course: string; topic: string };

export async function generateStaticParams(): Promise<Params[]> {
  const params = (await loadCourses()).flatMap((c) => c.topics.map((t) => ({ course: c.course.id, topic: t.slug })));
  return staticParamsOrPlaceholder(params, { course: PLACEHOLDER, topic: PLACEHOLDER });
}

async function find(params: Promise<Params>) {
  const { course: id, topic: slug } = await params;
  const entry = (await loadCourses()).find((c) => c.course.id === id);
  const topic = entry?.topics.find((t) => t.slug === slug);
  const plan = entry?.course.topics.find((t) => t.id === slug);
  return entry && topic && plan ? { entry, topic, plan } : undefined;
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const found = await find(params);
  return { title: found ? `${found.plan.title} | ${found.entry.course.code} | Open Campus` : 'Open Campus' };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const found = await find(params);
  if (!found) notFound();
  const { entry, topic, plan } = found;
  const titles = new Map(entry.standards.flatMap((s) => s.nodes.map((n) => [n.code, n.title] as const)));
  const number = entry.course.topics.findIndex((t) => t.id === plan.id) + 1;
  const diagrams: TopicDiagram[] = await Promise.all(topic.frontmatter.diagrams.map(async (d) => {
    const raw = await loadDiagramFile(topic, d.file);
    let content = raw;
    if (d.kind === 'svg') content = `data:image/svg+xml;base64,${Buffer.from(raw).toString('base64')}`;
    else if (d.kind === 'smiles') content = renderSmilesToSvg(raw, { label: d.alt, id: `${topic.frontmatter.id}-${d.id}`, file: `content/courses/${topic.course}/topics/${topic.slug}/${d.file}` });
    return { id: d.id, kind: d.kind, alt: d.alt, caption: d.caption, content };
  }));
  const sets = entry.sets.filter((s) => s.set.topics[0] === plan.id);
  const next = entry.course.topics.slice(number).find((t) => entry.topics.some((d) => d.slug === t.id));
  return (
    <div data-pagefind-body>
      <TopicPage
        topic={{
          title: plan.title,
          kicker: `${entry.course.code} ${entry.course.title} · Topic ${number} of ${entry.course.topics.length}`,
          codes: plan.codes.map((code) => ({ code, title: titles.get(code) ?? code })),
          objectives: plan.objectives ?? [],
          status: topicStatus(true, topic.frontmatter.verification),
          example: topic.frontmatter.example,
        }}
        diagrams={diagrams}
        deck={topic.deck && <Deck deck={topic.deck} />}
        after={
          <nav className="topic-foot">
            {sets.length > 0 && (
              <section>
                <h2>Practice</h2>
                <ul className="plain">{sets.map((s) => <li key={s.slug}><a href={`/courses/${entry.course.id}/questions/${s.slug}/`}>{s.set.title}</a> <span className="note">{s.set.questions.length} questions</span></li>)}</ul>
              </section>
            )}
            <p className="note"><a href={`/courses/${entry.course.id}/`}>Back to {entry.course.code} {entry.course.title}</a>{next && <> · Next: <a href={`/courses/${entry.course.id}/${next.id}/`}>{next.title}</a></>}</p>
          </nav>
        }
      >
        <Mdx source={topic.body} />
      </TopicPage>
    </div>
  );
}
