import { notFound } from 'next/navigation';
import { loadCourses } from '../../../lib/content';
import { courseView } from '../../../lib/courses';
import { href } from '../../../lib/paths';

type Params = { course: string };

const TIERS: Record<string, string> = { T0: 'Listed', T1: 'Outlined', T2: 'Drafted', T3: 'Verified', T4: 'Examined', T5: 'Proven' };

export async function generateStaticParams(): Promise<Params[]> {
  return (await loadCourses()).map((c) => ({ course: c.course.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { course: id } = await params;
  const entry = (await loadCourses()).find((c) => c.course.id === id);
  return { title: entry ? `${entry.course.code} ${entry.course.title} | Open Campus` : 'Open Campus' };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { course: id } = await params;
  const entry = (await loadCourses()).find((c) => c.course.id === id);
  if (!entry) notFound();
  const { course } = entry;
  const v = courseView(course, entry.standards, new Map(entry.topics.map((t) => [t.slug, t.frontmatter.verification])));
  const draftedCount = v.topics.filter((t) => t.drafted).length;
  const outlined = course.tier === 'T1';
  return (
    <article data-pagefind-body className="course">
      <header className="course-head">
        <p className="kicker">{course.code} · {course.credits} credits · {course.block.replace('-', ' ')}</p>
        <h1>{course.title}</h1>
        {course.summary && <p className="lede">{course.summary}</p>}
        <p className="tier"><span className="tier-badge">{course.tier} {TIERS[course.tier]}</span>
          {outlined && ` The plan is set and every outline code is covered. ${draftedCount} of ${v.topics.length} topics are drafted so far.`}</p>
      </header>

      <section>
        <h2>Measured against</h2>
        <ul className="plain">
          {v.anchors.map((a) => (
            <li key={a.id}><a href={a.source}>{a.title}</a>, published by {a.publisher}, retrieved {a.retrieved}.</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Topic plan</h2>
        <p className="note">In teaching order. Every prerequisite comes earlier.</p>
        <ol className="topics">
          {v.topics.map((t) => (
            <li key={t.id} id={t.id}>
              <div className="topic-line"><span className="num">{String(t.number).padStart(2, '0')}</span><span className="topic-title">{t.drafted ? <a href={href(`/courses/${course.id}/${t.id}/`)}>{t.title}</a> : t.title}<span className={t.drafted ? 'status drafted' : 'status'}>{t.status}</span></span><span className="codes">{t.codes.join(' ')}</span></div>
              {t.objectives.length > 0 && <ul className="objectives">{t.objectives.map((o) => <li key={o}>{o}</li>)}</ul>}
              {t.prerequisites.length > 0 && <p className="prereq">After: {t.prerequisites.join(', ')}</p>}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Coverage by code</h2>
        <p className="note">{v.covered} of {v.total} outline codes covered. Area weights are the publisher's.</p>
        {v.areas.map((a) => (
          <div key={a.code} className="area">
            <h3><span className="codes">{a.code}</span> {a.title}{a.weight !== undefined && <span className="weight">{a.weight}%</span>}</h3>
            <table>
              <thead><tr><th scope="col">Code</th><th scope="col">Outline topic</th><th scope="col">Taught in</th></tr></thead>
              <tbody>
                {a.rows.map((r) => (
                  <tr key={r.code}><td className="codes">{r.code}</td><td>{r.title}</td><td>{r.topics.length ? r.topics.join(', ') : <strong>Not covered</strong>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </article>
  );
}
