"""Write site/data/catalog.json from the catalog research (CATALOG research run, 2026-11-17).

The research file is the raw output of the 13-agent catalog study. This script keeps only what a
learner needs and what is public: each program's name, its CIP code, the outside exams or
standards it is measured against, and its ordered course sequence. Internal notes (capability
levels, human gates, sourcing notes) stay out. Pre-medicine is replaced by a partner link,
because pre-medicine is offered by AdmissionsAcademy (SPEC.md 5.8).

Usage: python3 tools/site/make_catalog.py <path to the research result JSON>
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

COLLEGES = {
    "business": "Business",
    "law": "Law and Public Service",
    "computing": "Computing",
    "engineering": "Engineering",
    "health": "Health Professions",
    "natural-sciences": "Natural Sciences",
    "math-stats": "Mathematics and Statistics",
    "social-sciences": "Social Sciences",
    "humanities": "Humanities and Communication",
    "education": "Education",
    "arts-design": "Arts, Design and Architecture",
}
AA_URL = "https://admissionsacademy.org/"
RENAME = {  # research names that read as notes, given plain catalog names
    "World Languages: Spanish, the template for French, German, Chinese, Japanese and others": "World Languages (Spanish first)",
    "Educational/Instructional Technology and Instructional Design (MEd, MS, graduate certificate)": "Instructional Design and Educational Technology",
    "Early Childhood Education and Teaching (AA, BS; birth to age 8)": "Early Childhood Education (birth to age 8)",
    "Philosophy, with Religious Studies as a sibling track": "Philosophy and Religious Studies",
    "Public Administration (BPA, MPA core) and Public Policy": "Public Administration and Public Policy",
}


def clean(s: str) -> str:
    s = s.replace("—", ", ").replace("–", "-").replace("&amp;", "&")
    s = re.sub(r"\s*\((existing Stage 2|later track, Stage 5)\)", "", s)
    s = re.sub(r"\s*\(shared with MCAT[^)]*\)", "", s)
    s = re.sub(r"^\s*\d+\.\s*", "", s)
    return re.sub(r"\s+", " ", s).strip()


def short_anchor(s: str) -> str:
    s = clean(s)
    s = re.split(r"\s\(|;|:\s", s)[0].strip()
    return s[:90]


def program_name(name: str) -> str:
    name = clean(name)
    name = re.sub(r"\s*\((includes|BS|BA|BFA|BS/BSPH|BA/BS|BA/BFA|BSW|BID/BFA/BS|BFA/BS)[^)]*\)", "", name)
    name = re.sub(r"\s*\([^)]{31,}\)", "", name)  # long parenthetical lists belong in the course sequence, not the name
    name = name.strip()
    return RENAME.get(name, name)


def seed_list(cross):
    text = next(r for r in cross[0]["recommendations"] if r["topic"].startswith("The 60"))["spec_text"]
    body = text.split(":", 1)[1]
    out = []
    for m in re.finditer(r"(\d{2}\.\d{4}) ([^;]+?) ([\d,]+)(?: \(|;|\.|$)", body):
        out.append({"cip": m.group(1), "name": m.group(2).strip(), "degrees": int(m.group(3).replace(",", ""))})
    return out


def main(path: str):
    raw = json.loads(Path(path).read_text())
    res = raw.get("result", raw)
    seeds = seed_list(res["cross"])
    total = 2015035
    seed_codes = {s["cip"]: s for s in seeds}
    colleges = []
    for c in res["colleges"]:
        progs = []
        for p in c["programs"]:
            codes = re.findall(r"\d{2}\.\d{4}", p.get("cip_code", ""))
            cip = codes[0] if codes else None
            name = program_name(p["name"])
            if cip == "51.1102":  # pre-medicine is AdmissionsAcademy's
                progs.append({"name": "Pre-Medicine", "cip": cip, "partner": {"name": "AdmissionsAcademy", "url": AA_URL}})
                continue
            progs.append({
                "name": name,
                "cip": cip,
                "listed_in_seed": cip in seed_codes,
                "anchors": [a for a in (short_anchor(x) for x in p["external_anchors"])
                            if "MCAT" not in a and "unconfirmed" not in a.lower() and len(a) > 4][:5],
                "courses": [clean(x) for x in p["course_spine"]],
                "tier": "T0",
            })
        first = clean(c["first_course_to_ship"]).split(". ")[0].split("\n")[0]
        colleges.append({"id": c["key"], "name": COLLEGES[c["key"]], "first_course": first, "programs": progs})
    ge = next(r for r in res["cross"][0]["recommendations"] if r["topic"].startswith("General education"))["spec_text"]
    core = []
    for m in re.finditer(r"(GE-\d{3}) ([^:]+): ([^.]+)\.", ge):
        core.append({"code": m.group(1), "name": m.group(2).strip(), "anchor": clean(m.group(3)).split("; alt")[0]})
    out = {
        "as_of": "2026-11-17",
        "source_note": "Majors and degree counts: NCES Digest of Education Statistics Table 318.30 (2021-22). Course sequences: Open Campus catalog research, 2026-11-17.",
        "bachelors_total": total,
        "seed": seeds,
        "general_education": core,
        "colleges": colleges,
    }
    text = json.dumps(out, indent=1, ensure_ascii=False) + "\n"
    if "—" in text or "–" in text:
        raise SystemExit("dash left in catalog data")
    (ROOT / "site" / "data" / "catalog.json").write_text(text)
    n = sum(len(c["programs"]) for c in colleges)
    print(f"wrote catalog: {len(colleges)} colleges, {n} programs, {len(seeds)} seed majors, {len(core)} core courses")


if __name__ == "__main__":
    main(sys.argv[1])
