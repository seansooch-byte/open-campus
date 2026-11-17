import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export const mdxOptions = { remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] };

/** Server component: renders an MDX string with math support (KaTeX CSS is bundled in globals.css). */
export function Mdx({ source }: { source: string }) {
  return <MDXRemote source={source} options={{ mdxOptions }} />;
}
