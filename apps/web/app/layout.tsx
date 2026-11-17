import type { ReactNode } from 'react';
import './globals.css';
import { href } from '../lib/paths';

export const metadata = { title: 'Open Campus library' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <nav className="masthead">
          <a href="/" className="mark">Open Campus</a>
          <a href={href('/')}>Library</a>
          <a href="/catalog/">Catalog</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
