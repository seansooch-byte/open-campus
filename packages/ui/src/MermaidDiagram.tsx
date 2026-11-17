'use client';
import { useEffect, useId, useRef, useState } from 'react';

/** Renders Mermaid source client-side (mermaid is lazy-loaded). The source stays available in a <details> fallback. */
export function MermaidDiagram({ source, alt }: { source: string; alt: string }) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true });
        const { svg } = await mermaid.render(`mermaid-${reactId}`, source);
        if (!cancelled && container.current) container.current.innerHTML = svg;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [source, reactId]);

  return (
    <div>
      <div
        ref={container}
        data-mermaid-container
        role="img"
        aria-label={alt}
        className="max-w-full overflow-x-auto bg-white p-2"
      />
      {failed && <p role="status" className="text-sm text-zinc-500">The diagram could not be rendered; see the source below.</p>}
      <details className="text-sm">
        <summary className="cursor-pointer">Diagram source</summary>
        <pre className="overflow-x-auto rounded bg-zinc-100 p-3 dark:bg-zinc-800">{source}</pre>
      </details>
    </div>
  );
}
