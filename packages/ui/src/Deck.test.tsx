// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CardDeck } from '@open-campus/schema';
import { MemoryProgressStore, type CardState } from '@open-campus/core';
import { Deck } from './Deck';

const deck: CardDeck = {
  topic_id: 'demo',
  cards: [
    { id: 'c1', front: 'Front 1', back: 'Back 1', clinical: false },
    { id: 'c2', front: 'Front 2', back: 'Back 2', clinical: true, sean_review: 'pending' },
  ],
};

class SlowStore extends MemoryProgressStore {
  puts = 0;
  override async putCard(id: string, state: CardState) {
    this.puts++;
    await new Promise((r) => setTimeout(r, 20));
    return super.putCard(id, state);
  }
}

class FailingStore extends MemoryProgressStore {
  override async putCard(): Promise<void> { throw new Error('boom'); }
}

afterEach(cleanup);

describe('Deck', () => {
  it('reviews once and advances once on a double click, then focuses the next card', async () => {
    const store = new SlowStore();
    render(<Deck deck={deck} store={store} />);
    fireEvent.click(screen.getByText('Front 1'));
    const good = screen.getByRole('button', { name: 'good' });
    fireEvent.click(good);
    fireEvent.click(good);
    expect((screen.getByRole('button', { name: 'good' }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(screen.getByText('Card 2 of 2')).toBeTruthy());
    expect(store.puts).toBe(1);
    expect(screen.getByText('Pending review')).toBeTruthy();
    // Focus moves in a passive effect that can flush after the DOM commit waitFor saw above.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Card 2 of 2').parentElement));
  });

  it('shows an error and does not advance when persistence fails', async () => {
    render(<Deck deck={deck} store={new FailingStore()} />);
    fireEvent.click(screen.getByText('Front 1'));
    fireEvent.click(screen.getByRole('button', { name: 'good' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Card 1 of 2')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'good' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
