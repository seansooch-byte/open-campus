'use client';
import { useEffect, useRef, useState } from 'react';
import type { CardDeck } from '@open-campus/schema';
import { IndexedDbProgressStore, MemoryProgressStore, RATINGS, newCardState, review, type ProgressStore, type Rating } from '@open-campus/core';
import { Badge } from './Badge';

export function Deck({ deck, store }: { deck: CardDeck; store?: ProgressStore }) {
  const storeRef = useRef<ProgressStore | undefined>(store);
  const lockRef = useRef(false);
  const focusRef = useRef<HTMLDivElement | null>(null);
  const advanced = useRef(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    storeRef.current ??= typeof indexedDB === 'undefined' ? new MemoryProgressStore() : new IndexedDbProgressStore();
  }, []);

  useEffect(() => {
    if (advanced.current) focusRef.current?.focus();
  }, [index]);

  const card = deck.cards[index];
  if (!card) return <div ref={focusRef} tabIndex={-1}><p role="status">Deck complete.</p></div>;
  const key = `${deck.topic_id}/${card.id}`;

  async function rate(rating: Rating) {
    if (lockRef.current) return;
    lockRef.current = true;
    setSaving(true);
    setError('');
    try {
      const s = storeRef.current;
      if (s) {
        const now = new Date();
        const prev = (await s.getCard(key)) ?? newCardState(now);
        const next = review(prev, rating, now);
        await s.putCard(key, next.state);
        setMessage(`Next review: ${next.due.toLocaleString()}`);
      }
      advanced.current = true;
      setFlipped(false);
      setIndex((i) => i + 1);
    } catch {
      setError('Could not save your review. Please try again.');
    } finally {
      lockRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div ref={focusRef} tabIndex={-1} className="space-y-3">
      <p className="text-sm text-zinc-500">Card {index + 1} of {deck.cards.length}</p>
      {card.clinical && card.sean_review !== 'approved' && <Badge tone="warn">Pending review</Badge>}
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="block min-h-24 w-full rounded border border-zinc-300 p-4 text-left dark:border-zinc-700"
      >
        {flipped ? card.back : card.front}
      </button>
      {flipped ? (
        <div className="flex gap-2">
          {RATINGS.map((r) => (
            <button key={r} type="button" disabled={saving} onClick={() => void rate(r)} className="rounded border border-zinc-400 px-3 py-1 capitalize disabled:opacity-40">{r}</button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Click the card to flip it.</p>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-zinc-500">{message}</p>}
    </div>
  );
}
