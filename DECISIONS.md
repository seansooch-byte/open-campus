# Decisions

Append-only. A later entry supersedes an earlier one; earlier entries are never edited.

## 2026-11-17: founding decisions

- **Name:** Open Campus. One live OPEN CAMPUS trademark exists for school attendance-tracking software; a trademark attorney's view is needed before the public launch. Alternatives considered: "Commons Curriculum", "Every Major".
- **Licenses:** code Apache-2.0, content CC BY 4.0, so anyone, including paid products, may reuse the content with attribution. CC BY-SA 4.0 was considered. Neither allows importing NonCommercial or ShareAlike material such as current OpenStax, MIT OCW or Khan Academy content; those are linked and cited.
- **Address:** https://campus.seansooch.dev, a Cloudflare Worker with static assets deployed from this repo, so the project ships without touching the main seansooch.dev site. A path inside the main site was considered.
- **Code:** the schemas, validators, originality checks, FSRS scheduler and static app were reused from a private pre-med library under Apache-2.0, as code only, with no content or history.
- **Pre-medicine:** offered by AdmissionsAcademy and only linked from Open Campus (SPEC.md 5.8). The science courses other majors need stay here.
- **First program:** Accounting (CIP 52.0301), anchored to the CPA blueprints and CLEP Financial Accounting. Computer science was the alternative. The first course is GE-111 College Algebra; the `ledger` unit type is built second, after `math`.
- **Build capacity:** built on subscriptions through headless runners (Claude Code, plus Codex or Grok as a second family), never a paid API. Runs are paced into usage windows and resumable; release cards record capacity used instead of dollars.

## 2026-11-17: the landing page argues the case, with charts drawn at build time

- **What:** the landing page became a long-form argument (the curve, the bill, who is left, what was tried, the answer) with nine figures, every number from a research file in `site/data` that names its source and retrieval date.
- **Charts:** drawn as static SVG by a small Python generator, not a chart library, so the page stays static and loads no framework. Each figure has a wide and a narrow plot (phones get the narrow one; scaling one SVG made text about 6 px), a data table, and a hover and keyboard readout.
- **Colour:** taken from a validated reference palette (orange for cost, blue and aqua for comparison, grey for context). A green and red pairing was tested and failed colour-blind separation.
- **Honesty rules in the argument:** the page states that net price after grants fell at public colleges and that real tuition has eased since 2019, that a degree still pays, and that AI tutoring evidence is mixed. The claim of near-zero cost is limited to delivery.
- **Design:** a new editorial design written from a blank page (Newsreader, IBM Plex Sans and Mono, paper and a brand green), replacing the first catalog-style landing page.

## 2026-11-17: the catalog page

- **What:** `/catalog/` lists 70 programs in 11 colleges, each with its CIP code, the outside exams or standards it is measured against, and its course sequence, plus the 42-credit general education core and the 60 largest US majors with their share of bachelor's degrees.
- **Honesty:** every program shows T0 Listed and the page says no course is ready to study. Majors with a researched course sequence are not called "outlined", because Outlined is the T1 tier.
- **Public data only:** capability levels, human-review gates and sourcing notes from the research stay out; MCAT anchors are removed; pre-medicine is a partner link to AdmissionsAcademy.
- **CIP codes:** the 60 seed majors' codes were checked against the NCES CIP 2020 file; other program codes come from the research and are not yet checked against that file.

## 2026-11-17: standards and courses as data, driven by GE-111

- **What:** a generic `StandardSchema` (levels, nodes with explicit parents, optional weights that must total 100 among siblings, optional dimensions such as routine versus non-routine) and a `CourseSchema` (anchors to standards, optionally to a slice of codes; topics in teaching order with codes, required unit types and earlier-only prerequisites; a tier). Coverage is computed over leaf codes only, so naming an area never counts as covering its topics.
- **Codes we assign:** College Board publishes the CLEP College Algebra outline without numbers, so Open Campus assigns CA codes in page order and says so in the standard's `note`. Titles are our paraphrases, not the publisher's wording.
- **Incremental, not a rewrite:** the imported MCAT enums on topics, cards and questions stay until the first topic is drafted, because only then is the right shape for a coded topic known. The MCAT taxonomy is now required only while such content exists. Alternative considered: replace every enum now (Track A step 2 in one go), rejected because nothing would exercise the new shapes yet.
- **Generated plan:** each course's README (topic plan and per-code coverage table) is rendered from `course.json` and checked for staleness, so the T1 table cannot drift from the data.
- **GE-111 at T1:** 19 topics cover all 19 leaf codes. The T1 gate also asks for human sampling of the Planner's output; that review is Sean's.
