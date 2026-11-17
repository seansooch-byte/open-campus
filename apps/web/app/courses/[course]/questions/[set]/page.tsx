import { notFound } from 'next/navigation';
import { QuestionPlayer } from '@open-campus/ui';
import { loadCourses } from '../../../../../lib/content';
import { PLACEHOLDER, staticParamsOrPlaceholder } from '../../../../../lib/courses';
import { href } from '../../../../../lib/paths';

type Params = { course: string; set: string };

export async function generateStaticParams(): Promise<Params[]> {
  const params = (await loadCourses()).flatMap((c) => c.sets.map((s) => ({ course: c.course.id, set: s.slug })));
  return staticParamsOrPlaceholder(params, { course: PLACEHOLDER, set: PLACEHOLDER });
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { course: id, set: slug } = await params;
  const entry = (await loadCourses()).find((c) => c.course.id === id);
  const set = entry?.sets.find((s) => s.slug === slug);
  if (!entry || !set) notFound();
  const topic = entry.course.topics.find((t) => t.id === set.set.topics[0]);
  return (
    <div data-pagefind-body className="practice">
      <p className="kicker">{entry.course.code} {entry.course.title} · Practice</p>
      <QuestionPlayer set={set.set} />
      <p className="note">{topic && <a href={href(`/courses/${entry.course.id}/${topic.id}/`)}>Back to {topic.title}</a>}</p>
    </div>
  );
}
