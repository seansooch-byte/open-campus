// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => { throw new Error('no layout engine in jsdom'); }),
  },
}));

import { MermaidDiagram } from './MermaidDiagram';

afterEach(cleanup);

describe('MermaidDiagram', () => {
  const source = 'flowchart LR\n  A --> B';

  it('renders an accessible container and the source fallback', () => {
    const { container } = render(<MermaidDiagram source={source} alt="A flows to B" />);
    const box = container.querySelector('[data-mermaid-container]');
    expect(box?.getAttribute('role')).toBe('img');
    expect(box?.getAttribute('aria-label')).toBe('A flows to B');
    const details = container.querySelector('details');
    expect(details?.querySelector('pre')?.textContent).toBe(source);
  });

  it('keeps the fallback and reports an error when rendering fails', async () => {
    const { findByRole, container } = render(<MermaidDiagram source={source} alt="A flows to B" />);
    expect((await findByRole('status')).textContent).toMatch(/could not be rendered/);
    expect(container.querySelector('details pre')).not.toBeNull();
    expect(container.querySelector('[data-mermaid-container]')?.innerHTML).toBe('');
  });

  it('inserts the rendered svg into the labelled container', async () => {
    const mermaid = (await import('mermaid')).default;
    vi.mocked(mermaid.render).mockResolvedValueOnce({ svg: '<svg data-testid="rendered"><title>ok</title></svg>' } as never);
    const { container } = render(<MermaidDiagram source={source} alt="A flows to B" />);
    const box = container.querySelector('[data-mermaid-container]')!;
    await waitFor(() => expect(box.querySelector('svg[data-testid="rendered"]')).not.toBeNull());
    expect(box.getAttribute('aria-label')).toBe('A flows to B');
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('details pre')?.textContent).toBe(source);
  });

  it('initializes mermaid with error rendering suppressed', async () => {
    const mermaid = (await import('mermaid')).default;
    const { findByRole } = render(<MermaidDiagram source={source} alt="x" />);
    await findByRole('status');
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ suppressErrorRendering: true }));
  });
});
