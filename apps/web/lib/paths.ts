// The library is served under a base path (next.config.mjs). Plain <a> tags and runtime asset URLs
// do not get Next's basePath applied, so every internal link goes through href().
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const href = (path: string) => `${BASE}${path}`;
