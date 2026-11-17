import { describe, expect, it } from 'vitest';
import { newCardState, review } from './fsrs.js';
import { MemoryProgressStore, type AnswerRecord } from './progress.js';

describe('MemoryProgressStore', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  it('round-trips cards and answers', async () => {
    const s = new MemoryProgressStore();
    expect(await s.getCard('a')).toBeUndefined();
    const c = newCardState(now);
    await s.putCard('a', c);
    expect(await s.getCard('a')).toEqual(c);
    const rec: AnswerRecord = { choice: 'B', correct: true, at: now.toISOString() };
    await s.putAnswer('q', rec);
    expect(await s.getAnswer('q')).toEqual(rec);
  });
  it('lists only due cards', async () => {
    const s = new MemoryProgressStore();
    await s.putCard('due', newCardState(now));
    await s.putCard('later', review(newCardState(now), 'easy', now).state);
    expect(await s.listDue(now)).toEqual(['due']);
    expect(await s.listDue(new Date('2030-01-01T00:00:00Z'))).toEqual(['due', 'later']);
  });
});
