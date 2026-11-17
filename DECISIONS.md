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
