// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { QuestionSet } from '@open-campus/schema';
import { QuestionPlayer } from './QuestionPlayer';

const set: QuestionSet = {
  id: 'demo',
  title: 'Demo',
  topics: ['demo-topic'],
  passage: null,
  questions: [{
    id: 'q1',
    stem: 'Pick B.',
    choices: [
      { key: 'A', text: 'Alpha', explanation: 'Explains A.' },
      { key: 'B', text: 'Beta', explanation: 'Explains B.' },
      { key: 'C', text: 'Gamma', explanation: 'Explains C.' },
      { key: 'D', text: 'Delta', explanation: 'Explains D.' },
    ],
    answer: 'B',
    codes: ['CA-4.1'],
    difficulty: 1,
    clinical: false,
  }],
};

afterEach(cleanup);

describe('QuestionPlayer', () => {
  it('hides explanations until submit, then reveals answer and all explanations', () => {
    render(<QuestionPlayer set={set} />);
    expect(screen.queryByText(/Explains/)).toBeNull();
    const submit = screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/Gamma/));
    fireEvent.click(submit);
    for (const k of ['A', 'B', 'C', 'D']) expect(screen.getByText(`Explains ${k}.`)).toBeTruthy();
    expect(screen.getByText('Correct answer.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('The answer is B');
  });

  it('focuses the feedback region after submit', () => {
    render(<QuestionPlayer set={set} />);
    fireEvent.click(screen.getByLabelText(/Gamma/));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(document.activeElement).toBe(screen.getByTestId('feedback-q1'));
  });

  it('shows Pending review for clinical questions not yet approved', () => {
    const base = set.questions[0]!;
    const pending: QuestionSet = { ...set, questions: [{ ...base, clinical: true, sean_review: 'pending' }] };
    const { unmount } = render(<QuestionPlayer set={pending} />);
    expect(screen.getByText('Pending review')).toBeTruthy();
    unmount();
    const approved: QuestionSet = { ...set, questions: [{ ...base, clinical: true, sean_review: 'approved' }] };
    render(<QuestionPlayer set={approved} />);
    expect(screen.queryByText('Pending review')).toBeNull();
  });
});
