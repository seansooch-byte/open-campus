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
