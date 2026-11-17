"""Build site/index.html from site/src/page.html and site/src/charts.json.

The page source holds the argument; each {{chart:<id>}} token is replaced with the figure
drawn by charts.py from the spec of that id. The build refuses: an unknown or unused chart id,
an em or en dash anywhere in the output, and a {{ token left unreplaced.

Run from the repo root:  python3 tools/site/build.py
"""
import json
import re
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
import charts  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "site" / "src"


def build() -> str:
    page = (SRC / "page.html").read_text()
    specs = {s["id"]: s for s in json.loads((SRC / "charts.json").read_text())["charts"]}
    used = set(re.findall(r"\{\{chart:([a-z0-9-]+)\}\}", page))
    missing = used - specs.keys()
    unused = specs.keys() - used
    if missing:
        raise SystemExit(f"page asks for unknown charts: {sorted(missing)}")
    if unused:
        raise SystemExit(f"charts defined but not placed: {sorted(unused)}")
    out = re.sub(r"\{\{chart:([a-z0-9-]+)\}\}", lambda m: charts.render(specs[m.group(1)]), page)
    if "{{" in out:
        raise SystemExit("an unreplaced {{ token is left in the page")
    if "—" in out or "–" in out:
        raise SystemExit("the page contains an em or en dash")
    return out


if __name__ == "__main__":
    html = build()
    (ROOT / "site" / "index.html").write_text(html)
    print(f"built site/index.html ({len(html):,} bytes)")
