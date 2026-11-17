import { createEmptyCard, fsrs, Rating as FsrsRating, type Card as FsrsCard, type Grade } from 'ts-fsrs';

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export const RATINGS: readonly Rating[] = ['again', 'hard', 'good', 'easy'];
export type CardState = FsrsCard;

const grades: Record<Rating, Grade> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
};

const scheduler = fsrs();

export function newCardState(now: Date = new Date()): CardState {
  return createEmptyCard(now);
}

export function review(state: CardState, rating: Rating, now: Date = new Date()): { state: CardState; due: Date } {
  const { card } = scheduler.next(state, now, grades[rating]);
  return { state: card, due: card.due };
}
