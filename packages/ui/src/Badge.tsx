import type { ReactNode } from 'react';

const tones = {
  neutral: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
} as const;

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
