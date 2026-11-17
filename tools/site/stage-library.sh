#!/bin/sh
# Builds the library app and stages its static export at site/library/, where the Worker in
# wrangler.jsonc serves it next to the landing page. site/library/ is generated and gitignored.
set -eu
cd "$(dirname "$0")/../.."
npx --yes pnpm@10.33.4 build
rm -rf site/library
cp -R apps/web/out site/library
rm -rf site/library/404 site/library/404.html site/library/index.txt
echo "staged $(find site/library -name index.html | wc -l | tr -d ' ') pages at site/library/"
