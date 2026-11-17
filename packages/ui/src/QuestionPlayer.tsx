'use client';
import { useEffect, useRef, useState } from 'react';
import type { QuestionSet } from '@open-campus/schema';
import { Badge } from './Badge';

type Key = 'A' | 'B' | 'C' | 'D';

/** Tutor mode only: reveal the answer and every explanation after submit. */
export function QuestionPlayer({ set }: { set: QuestionSet }) {
  const [selected, setSelected] = useState<Record<string, Key | undefined>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const feedbackRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastSubmitted = useRef<string | undefined>(undefined);

  useEffect(() => {
    const id = lastSubmitted.current;
    if (id) feedbackRefs.current[id]?.focus();
  }, [submitted]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{set.title}</h1>
        {set.example && <Badge tone="info">Example</Badge>}
      </header>
      {set.passage && (
        <section className="space-y-2 rounded border border-zinc-300 p-4 dark:border-zinc-700">
          {set.passage.title && <h2 className="font-semibold">{set.passage.title}</h2>}
          <p className="whitespace-pre-line">{set.passage.body}</p>
        </section>
      )}
      {set.questions.map((q, i) => {
        const done = submitted[q.id] === true;
        const pick = selected[q.id];
        return (
          <fieldset key={q.id} className="space-y-3" data-testid={`question-${q.id}`}>
            <legend className="font-medium">{i + 1}. {q.stem}</legend>
            {q.clinical && q.sean_review !== 'approved' && <Badge tone="warn">Pending review</Badge>}
            {q.choices.map((c) => {
              const correct = done && c.key === q.answer;
              const wrong = done && c.key === pick && c.key !== q.answer;
              return (
                <div key={c.key} className={`rounded border p-2 ${correct ? 'border-green-600' : wrong ? 'border-red-600' : 'border-zinc-300 dark:border-zinc-700'}`}>
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name={q.id}
                      value={c.key}
                      checked={pick === c.key}
                      disabled={done}
                      onChange={() => setSelected((s) => ({ ...s, [q.id]: c.key }))}
                    />
                    <span>{c.key}. {c.text}</span>
                  </label>
                  {done && (
                    <p className="mt-1 pl-6 text-sm text-zinc-600 dark:text-zinc-400">
                      <strong>{correct ? 'Correct answer. ' : wrong ? 'Your choice. ' : ''}</strong>
                      {c.explanation}
                    </p>
                  )}
                </div>
              );
            })}
            {!done && (
              <button
                type="button"
                disabled={!pick}
                onClick={() => { lastSubmitted.current = q.id; setSubmitted((s) => ({ ...s, [q.id]: true })); }}
                className="rounded bg-zinc-900 px-3 py-1 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Submit
              </button>
            )}
            {done && (
              <div ref={(el) => { feedbackRefs.current[q.id] = el; }} tabIndex={-1} data-testid={`feedback-${q.id}`}>
                <p role="status" className="font-medium">{pick === q.answer ? 'Correct' : `Incorrect. The answer is ${q.answer}`}</p>
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
