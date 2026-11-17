"""Build site/about/index.html from site/src/about.html.

The About page is hand-written HTML. The build only checks it: every citation (href="#rN") must
name a source (id="rN") and every source must be cited, and there must be no em or en dash and
no leftover {{ token. The page is written only when every check passes.

Run from the repo root:  python3 tools/site/build.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "site" / "src"


def check(page: str) -> str:
    cited = set(re.findall(r'href="#(r\d+)"', page))
    sources = set(re.findall(r'id="(r\d+)"', page))
    if cited - sources:
        raise SystemExit(f"citations with no source: {sorted(cited - sources)}")
    if sources - cited:
        raise SystemExit(f"sources nobody cites: {sorted(sources - cited)}")
    if "{{" in page:
        raise SystemExit("an unreplaced {{ token is left in the page")
    if "—" in page or "–" in page:
        raise SystemExit("the page contains an em or en dash")
    return page


if __name__ == "__main__":
    html = check((SRC / "about.html").read_text())
    out = ROOT / "site" / "about" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html)
    print(f"built site/about/index.html ({len(html):,} bytes)")
