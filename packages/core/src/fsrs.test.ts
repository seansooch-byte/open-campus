import { describe, expect, it } from 'vitest';
import { newCardState, review, RATINGS } from './fsrs.js';

describe('fsrs wrapper', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  it('starts new cards due now', () => {
    expect(newCardState(now).due.getTime()).toBe(now.getTime());
  });
  it('schedules every rating at or after now', () => {
    for (const r of RATINGS) expect(review(newCardState(now), r, now).due.getTime()).toBeGreaterThanOrEqual(now.getTime());
  });
  it('easy is scheduled later than again', () => {
    const again = review(newCardState(now), 'again', now).due.getTime();
    const easy = review(newCardState(now), 'easy', now).due.getTime();
    expect(easy).toBeGreaterThan(again);
  });
  it('increments reps', () => {
    expect(review(newCardState(now), 'good', now).state.reps).toBe(1);
  });
});
