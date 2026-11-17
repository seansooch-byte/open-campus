import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// GFM for tables, which every topic uses to classify and compare; math via KaTeX.
export const mdxOptions = { remarkPlugins: [remarkGfm, remarkMath], rehypePlugins: [rehypeKatex] };

/** Server component: renders an MDX string with math support (KaTeX CSS is bundled in globals.css). */
export function Mdx({ source }: { source: string }) {
  return <MDXRemote source={source} options={{ mdxOptions }} />;
}
