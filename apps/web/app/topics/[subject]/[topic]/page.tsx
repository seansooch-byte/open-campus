import { notFound } from 'next/navigation';
import { renderSmilesToSvg } from '@open-campus/tools/diagrams';
import { Deck, TopicPage, type TopicDiagram } from '@open-campus/ui';
import { loadDiagramFile, loadTopics } from '../../../../lib/content';
import { Mdx } from '../../../../lib/mdx';

type Params = { subject: string; topic: string };

export async function generateStaticParams(): Promise<Params[]> {
  return (await loadTopics()).map((t) => ({ subject: t.subject, topic: t.slug }));
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { subject, topic: slug } = await params;
  const topic = (await loadTopics()).find((t) => t.subject === subject && t.slug === slug);
  if (!topic) notFound();
  const diagrams: TopicDiagram[] = await Promise.all(topic.frontmatter.diagrams.map(async (d) => {
    const raw = await loadDiagramFile(topic, d.file);
    let content = raw;
    if (d.kind === 'svg') content = `data:image/svg+xml;base64,${Buffer.from(raw).toString('base64')}`;
    else if (d.kind === 'smiles') {
      content = renderSmilesToSvg(raw, {
        label: d.alt,
        id: `${topic.frontmatter.id}-${d.id}`,
        file: `content/subjects/${topic.subject}/${topic.slug}/${d.file}`,
      });
    }
    return { id: d.id, kind: d.kind, alt: d.alt, caption: d.caption, content };
  }));
  return (
    <div data-pagefind-body>
      <TopicPage topic={topic.frontmatter} diagrams={diagrams} deck={topic.deck && <Deck deck={topic.deck} />}>
        <Mdx source={topic.body} />
      </TopicPage>
    </div>
  );
}
