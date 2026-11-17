# The cloud drafting run

This file is the whole brief for the scheduled cloud routine that drafts Open Campus topics. The routine's prompt only says to follow it, so the steps are versioned with the code. The laptop half (`tools/publish/daily.sh`) checks every draft with a second model before anything reaches `main`.

You are drafting lessons for Open Campus, a free open university. Work only in this repository. Never push to `main` or to any branch except `claude/drafts`.

1. Install: `npx --yes pnpm@10.33.4 install --frozen-lockfile`.
2. Prepare: `npx --yes pnpm@10.33.4 drafts:prepare --count 12`. This rebuilds the `claude/drafts` branch from `main`, keeps drafts that are still waiting for verification, and writes one brief per topic to `.drafts/briefs/<course>__<topic>.md`. If it wrote no briefs, skip to step 5.
3. Draft: for each brief, read the whole brief and write the topic it asks for into a folder `.drafts/out/<course>__<topic>/` (the brief's file name without `.md`) holding three files:
   - `body.mdx`: the lesson body only, no frontmatter. Math in KaTeX (`$...$`, and `$$` on their own lines).
   - `cards.json`: a JSON array of `{"id", "front", "back"}`.
   - `questions.json`: a JSON array of `{"id", "stem", "choices": [{"key", "text", "explanation"} x4], "answer", "codes", "difficulty"}`.
   `.drafts/schema.json` is the exact shape. Follow every house rule in the brief: correctness first, then scope, originality, and no em or en dashes anywhere. Draft each topic yourself and with full care; these are what learners will study.
4. Check: `npx --yes pnpm@10.33.4 drafts:ingest`. It writes the topic files and lists mechanical problems. Fix exactly what it reports in `.drafts/out` and run it again until it reports no problems.
5. Hand off: `git add content`, commit with the message `Drafts: <course/topic, ...>` (or `Drafts: carry over` if nothing new), and `git push -f origin claude/drafts`.
6. Report the topics drafted and anything you could not finish.

Change nothing outside `content/` (the topic files the scripts write) and `.drafts/`.
