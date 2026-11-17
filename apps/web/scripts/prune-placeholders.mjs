// Removes the placeholder pages that empty dynamic routes render (see lib/courses.ts) so they never ship.
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
const PLACEHOLDER = '__none__';
let removed = 0;
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const path = join(dir, e.name);
    if (e.name === PLACEHOLDER) { rmSync(path, { recursive: true }); removed++; } else walk(path);
  }
};
walk('out');
console.log(`pruned ${removed} placeholder route(s)`);
