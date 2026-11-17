#!/bin/sh
# Assembles dist/, the one directory the Worker in wrangler.jsonc serves: the library app's static
# export at the root, plus the hand-built pages from site/ (catalog, about, assets, data, 404 and
# _redirects). dist/ is generated and gitignored; rebuild it before every deploy (pnpm ship does).
set -eu
cd "$(dirname "$0")/../.."
python3 tools/site/build.py
python3 tools/site/build_catalog.py
npx --yes pnpm@10.33.4 build
rm -rf dist
cp -R apps/web/out dist
rm -rf dist/404 dist/404.html dist/index.txt
for part in about catalog assets data 404.html _redirects; do cp -R "site/$part" "dist/$part"; done
echo "staged $(find dist -name index.html | wc -l | tr -d ' ') pages in dist/"
