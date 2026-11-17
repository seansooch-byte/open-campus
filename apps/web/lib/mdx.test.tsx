import { describe, expect, it } from 'vitest';
import { compileMDX } from 'next-mdx-remote/rsc';
import { renderToStaticMarkup } from 'react-dom/server';
import { mdxOptions } from './mdx';

describe('MDX pipeline', () => {
  it('renders inline math and fractions with KaTeX', async () => {
    const { content } = await compileMDX({
      source: 'Energy is $E = mc^2$ here.\n\n$$\n\\frac{a}{b}\n$$\n',
      options: { mdxOptions },
    });
    const html = renderToStaticMarkup(content);
    expect(html).toContain('class="katex"');
    expect(html).toContain('application/x-tex">E = mc^2<');
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('mfrac');
  });
});
