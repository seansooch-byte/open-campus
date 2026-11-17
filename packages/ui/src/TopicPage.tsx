import type { ReactNode } from 'react';
import { MermaidDiagram } from './MermaidDiagram';

export type TopicDiagram = {
  id: string;
  kind: 'svg' | 'mermaid' | 'smiles';
  alt: string;
  caption?: string;
  /** svg: data URI for <img>; smiles: prerendered inline SVG markup (trusted, build-time); mermaid: raw source. */
  content: string;
};

/** What the page states about a topic: its plan entry (title, codes, objectives) and its review state. */
export type TopicHeader = {
  title: string;
  kicker: string;
  codes: { code: string; title: string }[];
  objectives: string[];
  status: string;
  example?: boolean;
};

export function TopicPage({ topic, diagrams, children, deck, after }: {
  topic: TopicHeader;
  diagrams: TopicDiagram[];
  /** Rendered MDX body. */
  children: ReactNode;
  /** Rendered Deck for the topic's cards, if any. */
  deck?: ReactNode;
  /** Anything that follows the cards, such as links to practice questions. */
  after?: ReactNode;
}) {
  return (
    <article className="topic">
      <header className="course-head">
        <p className="kicker">{topic.kicker}</p>
        <h1>{topic.title}</h1>
        <p className="tier"><span className="tier-badge">{topic.example ? 'Example' : topic.status}</span></p>
        <ul className="outline-codes">
          {topic.codes.map((c) => <li key={c.code}><span className="codes">{c.code}</span> {c.title}</li>)}
        </ul>
      </header>
      {topic.objectives.length > 0 && (
        <section>
          <h2>You will be able to</h2>
          <ul className="objectives-list">{topic.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
        </section>
      )}
      <section className="prose">{children}</section>
      {diagrams.length > 0 && (
        <section>
          <h2>Diagrams</h2>
          {diagrams.map((d) => (
            <figure key={d.id}>
              {d.kind === 'svg' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.content} alt={d.alt} />
              ) : d.kind === 'smiles' ? (
                <div dangerouslySetInnerHTML={{ __html: d.content }} />
              ) : (
                <MermaidDiagram source={d.content} alt={d.alt} />
              )}
              {d.caption && <figcaption>{d.caption}</figcaption>}
            </figure>
          ))}
        </section>
      )}
      {deck && <section><h2>Cards</h2>{deck}</section>}
      {after}
    </article>
  );
}
