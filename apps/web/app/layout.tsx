import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'Pre-Med Library' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-zinc-300 px-6 py-3 dark:border-zinc-700">
          <a href="/" className="font-semibold no-underline">Pre-Med Library</a>
        </nav>
        <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
