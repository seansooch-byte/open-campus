import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Open Campus: a free, open library of university courses',
  description: 'Free university courses written as open data, each planned against an outside exam by code and checked item by item.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="bar">
          <div className="in">
            <a href="/" className="mark"><i>OC</i>Open Campus</a>
            <nav aria-label="Site">
              <a href="/">Library</a>
              <a href="/catalog/">Catalog</a>
              <a href="/about/">About</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
