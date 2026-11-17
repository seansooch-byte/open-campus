'use client';
import { useEffect, useRef } from 'react';

declare global {
  interface Window { PagefindUI?: new (opts: { element: HTMLElement; showSubResults?: boolean }) => unknown }
}

/** Loads the Pagefind UI generated at build time; client-side only. */
export function Search() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/pagefind/pagefind-ui.css';
    const script = document.createElement('script');
    script.src = '/pagefind/pagefind-ui.js';
    script.onload = () => {
      if (ref.current && window.PagefindUI) new window.PagefindUI({ element: ref.current, showSubResults: true });
    };
    document.head.append(css, script);
    return () => { css.remove(); script.remove(); };
  }, []);
  return <div ref={ref} aria-label="Search the library" />;
}
