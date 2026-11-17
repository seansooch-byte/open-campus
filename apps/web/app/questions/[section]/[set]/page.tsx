import { notFound } from 'next/navigation';
import { QuestionPlayer } from '@open-campus/ui';
import { loadSets } from '../../../../lib/content';
import { PLACEHOLDER, staticParamsOrPlaceholder } from '../../../../lib/courses';

type Params = { section: string; set: string };

export async function generateStaticParams(): Promise<Params[]> {
  return staticParamsOrPlaceholder((await loadSets()).map((s) => ({ section: s.section, set: s.slug })), { section: PLACEHOLDER, set: PLACEHOLDER });
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { section, set } = await params;
  const entry = (await loadSets()).find((s) => s.section === section && s.slug === set);
  if (!entry) notFound();
  return <div data-pagefind-body><QuestionPlayer set={entry.set} /></div>;
}
