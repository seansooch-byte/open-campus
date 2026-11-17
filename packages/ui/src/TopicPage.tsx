import type { ReactNode } from 'react';
import type { TopicFrontmatter } from '@open-campus/schema';
import { Badge } from './Badge';
import { MermaidDiagram } from './MermaidDiagram';

export type TopicDiagram = {
  id: string;
  kind: 'svg' | 'mermaid' | 'smiles';
  alt: string;
  caption?: string;
  /** svg: data URI for <img>; smiles: prerendered inline SVG markup (trusted, build-time); mermaid: raw source. */
  content: string;
};

export function TopicPage({ topic, diagrams, children, deck }: {
  topic: TopicFrontmatter;
  diagrams: TopicDiagram[];
  /** Rendered MDX body. */
  children: ReactNode;
  /** Rendered Deck for the topic's cards, if any. */
  deck?: ReactNode;
}) {
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{topic.title}</h1>
        <div className="flex flex-wrap gap-2">
          {topic.example && <Badge tone="info">Example</Badge>}
          {topic.clinical && topic.sean_review !== 'approved' && <Badge tone="warn">Pending review</Badge>}
          <Badge>{topic.subject}</Badge>
          {topic.categories.map((c) => <Badge key={c}>{c}</Badge>)}
        </div>
      </header>
      <section>
        <h2 className="text-xl font-semibold">Learning objectives</h2>
        <ul className="list-disc pl-6">
          {topic.learning_objectives.map((o) => <li key={o}>{o}</li>)}
        </ul>
      </section>
      <section className="prose-block space-y-4">{children}</section>
      {diagrams.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Diagrams</h2>
          {diagrams.map((d) => (
            <figure key={d.id} className="space-y-2">
              {d.kind === 'svg' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.content} alt={d.alt} className="max-w-sm bg-white p-2" />
              ) : d.kind === 'smiles' ? (
                <div className="max-w-sm bg-white p-2" dangerouslySetInnerHTML={{ __html: d.content }} />
              ) : (
                <MermaidDiagram source={d.content} alt={d.alt} />
              )}
              {d.caption && <figcaption className="text-sm text-zinc-500">{d.caption}</figcaption>}
            </figure>
          ))}
        </section>
      )}
      {deck && <section className="space-y-2"><h2 className="text-xl font-semibold">Cards</h2>{deck}</section>}
    </article>
  );
}
