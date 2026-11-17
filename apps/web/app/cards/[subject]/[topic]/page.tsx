import { notFound } from 'next/navigation';
import { Badge, Deck } from '@open-campus/ui';
import { loadTopics } from '../../../../lib/content';
import { PLACEHOLDER, staticParamsOrPlaceholder } from '../../../../lib/courses';

type Params = { subject: string; topic: string };

export async function generateStaticParams(): Promise<Params[]> {
  return staticParamsOrPlaceholder((await loadTopics()).filter((t) => t.deck).map((t) => ({ subject: t.subject, topic: t.slug })), { subject: PLACEHOLDER, topic: PLACEHOLDER });
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { subject, topic: slug } = await params;
  const topic = (await loadTopics()).find((t) => t.subject === subject && t.slug === slug);
  if (!topic?.deck) notFound();
  return (
    <div data-pagefind-body className="space-y-4">
      <h1 className="text-3xl font-bold">Cards: {topic.frontmatter.title}</h1>
      {topic.deck.example && <Badge tone="info">Example</Badge>}
      <Deck deck={topic.deck} />
    </div>
  );
}
