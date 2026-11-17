"""Build site/catalog/index.html from site/data/catalog.json.

The catalog lists every program by college with its CIP code, the outside exams or standards it
is measured against, its ordered course sequence and its tier. Today every program is T0 Listed,
and the page says so. The 60 largest US majors are listed with their share of bachelor's degrees
and whether the catalog covers them yet.

Refuses: an em or en dash in the output, a program without courses (other than a partner link).
Run from the repo root: python3 tools/site/build_catalog.py
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS_V = "5"
JS_V = "1"


def esc(s) -> str:
    return html.escape(str(s), quote=True)


def first_course(s: str) -> str:
    for cut in (",", " anchored", " mapped", ". "):
        s = s.split(cut)[0]
    return s.strip()


def build() -> str:
    d = json.loads((ROOT / "site" / "data" / "catalog.json").read_text())
    colleges = d["colleges"]
    by_cip = {}
    for c in colleges:
        for p in c["programs"]:
            if p.get("cip"):
                by_cip.setdefault(p["cip"], (c, p))
    n_prog = sum(len(c["programs"]) for c in colleges)
    seed_share = sum(s["degrees"] for s in d["seed"]) / d["bachelors_total"] * 100
    covered = [s for s in d["seed"] if s["cip"] in by_cip]

    chips = "".join(f'<a class=chip href="#c-{esc(c["id"])}">{esc(c["name"])}</a>' for c in colleges)

    core_rows = "".join(
        f'<tr><td class=code>{esc(g["code"])}</td><td>{esc(g["name"])}</td><td class=meas>{esc(g["anchor"])}</td></tr>'
        for g in d["general_education"])

    sections = []
    for c in colleges:
        cards = []
        for p in c["programs"]:
            search = " ".join([p["name"], p.get("cip") or "", c["name"]] + p.get("anchors", []) + p.get("courses", [])).lower()
            if "partner" in p:
                cards.append(
                    f'<li class=prog data-search="{esc(search)}"><div class="prog-head partner"><span class=pname>{esc(p["name"])}</span>'
                    f'<span class=cip>{esc(p.get("cip") or "")}</span><span class="tier partner">Partner</span></div>'
                    f'<p class=partner-note>Offered by <a href="{esc(p["partner"]["url"])}">{esc(p["partner"]["name"])}</a>, a separate site, which builds the whole pre-medicine track. '
                    f'Open Campus offers the science courses other majors need but no pre-medicine path of its own.</p></li>')
                continue
            if not p.get("courses"):
                raise SystemExit(f"{p['name']}: no courses")
            anchors = "".join(f"<li>{esc(a)}</li>" for a in p["anchors"])
            courses = "".join(f"<li>{esc(x)}</li>" for x in p["courses"])
            cards.append(
                f'<li class=prog data-search="{esc(search)}"><details><summary class=prog-head>'
                f'<span class=pname>{esc(p["name"])}</span><span class=cip>{esc(p.get("cip") or "")}</span>'
                f'<span class=tier title="Listed: the program exists, with no content yet">T0 Listed</span></summary>'
                f'<div class=prog-body><div><h4>Measured against</h4><ul class=anchors>{anchors}</ul></div>'
                f'<div><h4>Course sequence ({len(p["courses"])} courses)</h4><ol class=courses>{courses}</ol></div></div></details></li>')
        sections.append(
            f'<section class=college id="c-{esc(c["id"])}" aria-labelledby="h-{esc(c["id"])}">'
            f'<div class=college-head><h2 id="h-{esc(c["id"])}">{esc(c["name"])}</h2>'
            f'<p class=firstc><span>First course</span> {esc(first_course(c["first_course"]))}</p></div>'
            f'<ul class=progs>{"".join(cards)}</ul></section>')

    max_deg = max(s["degrees"] for s in d["seed"])
    seed_rows = []
    for i, s in enumerate(d["seed"], 1):
        hit = by_cip.get(s["cip"])
        status = (f'<a href="#c-{esc(hit[0]["id"])}">{esc(hit[0]["name"])}</a>' if hit else '<span class=muted>Listed</span>')
        pct = s["degrees"] / d["bachelors_total"] * 100
        seed_rows.append(
            f'<tr><td class=rank>{i}</td><td>{esc(s["name"])}<span class=cip>{esc(s["cip"])}</span></td>'
            f'<td class=deg><span class=dbar style="width:{s["degrees"]/max_deg*100:.1f}%"></span><span class=dval>{s["degrees"]:,}</span><span class=dpct>{pct:.1f}%</span></td>'
            f'<td class=stat>{status}</td></tr>')

    out = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Catalog · Open Campus</title>
<meta name="description" content="The Open Campus catalog: {n_prog} programs across {len(colleges)} colleges, each with its course sequence and the outside exams it is measured against.">
<link rel="canonical" href="https://campus.seansooch.dev/catalog/">
<meta name="theme-color" content="#1F4D40">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%231F4D40'/%3E%3Ctext x='16' y='21' font-family='Menlo,monospace' font-size='13' font-weight='600' text-anchor='middle' fill='%23FAF8F3'%3EOC%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css?v={CSS_V}">
</head>
<body class=catalog-page>
<a class="skip" href="#main">Skip to the catalog</a>
<header class="bar"><div class="in">
  <a class="mark" href="/"><i>OC</i>Open Campus</a>
  <nav aria-label="Site">
    <a href="/">The case</a>
    <a href="/catalog/" class="keep" aria-current="page">Catalog</a>
    <a href="/library/" class="keep">Library</a>
    <a href="https://github.com/seansooch-byte/open-campus">Source</a>
  </nav>
</div></header>

<main id="main" class="page">
<section class="hero col">
  <div class="kicker">Open Campus &middot; Catalog</div>
  <h1>The catalog</h1>
  <p class="deck">Every program, with the courses it will teach and the outside exams it will be measured against. Nothing here is ready to study yet: every program is listed, and courses are being written one program at a time.</p>
  <div class="hero-figs four">
    <div><b>{len(d["seed"])}</b><span>largest US majors listed, {seed_share:.0f}% of bachelor's degrees</span></div>
    <div><b>{n_prog}</b><span>programs researched, across {len(colleges)} colleges</span></div>
    <div><b>{len(d["general_education"])}</b><span>general education courses shared by every program</span></div>
    <div><b>0</b><span>courses ready to study today</span></div>
  </div>
</section>

<section class="cat-tools col" aria-label="Find a program">
  <label class=search><span>Find a program or course</span><input type=search id=q placeholder="Try nursing, calculus, CPA, Python" autocomplete=off></label>
  <p class=count id=count aria-live=polite></p>
  <nav class=chips aria-label="Colleges">{chips}</nav>
</section>

<section class="core col" id=core aria-labelledby=h-core>
  <h2 id=h-core>General education core</h2>
  <p>Forty-two credit-equivalents that every program shares, each mapped to a credit-by-exam test a learner can sit. Credit-by-exam is not free: CLEP lists $97 per exam, and each college decides what it accepts.</p>
  <table class=coretable><thead><tr><th>Code</th><th>Course</th><th>Measured against</th></tr></thead><tbody>{core_rows}</tbody></table>
</section>

<div class="colleges col">{"".join(sections)}</div>
<p class="col empty" id=empty hidden>No program or course matches that search.</p>

<section class="seed col" id=majors aria-labelledby=h-majors>
  <h2 id=h-majors>The 60 largest majors</h2>
  <p>The catalog starts from the 60 majors that together award {seed_share:.1f}% of US bachelor's degrees. {len(covered)} of them already have a course sequence in a college above; the rest are listed and wait their turn. Every program is at T0 Listed until its courses are planned against their standard.</p>
  <div class=seedwrap><table class=seedtable><thead><tr><th>#</th><th>Major and CIP code</th><th>Bachelor's degrees, 2021-22</th><th>Course sequence</th></tr></thead><tbody>{"".join(seed_rows)}</tbody></table></div>
  <p class=source>{esc(d["source_note"])}</p>
</section>

<section class="col tiers-sec" aria-labelledby=h-tiers>
  <h2 id=h-tiers>How finished things are</h2>
  <div class="tiers">
    <div><b>T0 Listed</b><span>The program exists, with no content yet</span></div>
    <div><b>T1 Outlined</b><span>Every course has a plan mapped to its standard</span></div>
    <div><b>T2 Drafted</b><span>Written, not yet independently checked</span></div>
    <div><b>T3 Verified</b><span>Checked item by item by a second reviewer</span></div>
    <div><b>T4 Examined</b><span>Has practice exams and passes every check</span></div>
    <div><b>T5 Proven</b><span>Learners' results on the outside exam are published</span></div>
  </div>
  <p class=fine>Open Campus is not accredited, grants no degrees or credit, and is not affiliated with any testing or licensing body. Exam names describe what a course prepares for. Licensing exams have their own eligibility rules, such as accredited coursework or supervised hours.</p>
</section>
</main>

<footer><div class="page col">
  Open Campus by <a href="https://seansooch.dev/">Sean Sooch</a>. Code under Apache-2.0; content under CC BY 4.0. <a href="https://github.com/seansooch-byte/open-campus">Source on GitHub</a>. Catalog data: <a href="/data/catalog.json">catalog.json</a>.
</div></footer>
<script src="/assets/catalog.js?v={JS_V}" defer></script>
</body>
</html>
'''
    if "—" in out or "–" in out:
        raise SystemExit("the catalog page contains an em or en dash")
    return out


if __name__ == "__main__":
    page = build()
    target = ROOT / "site" / "catalog" / "index.html"
    target.parent.mkdir(exist_ok=True)
    target.write_text(page)
    print(f"built site/catalog/index.html ({len(page):,} bytes)")
