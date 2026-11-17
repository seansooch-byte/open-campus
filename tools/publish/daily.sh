#!/bin/zsh
# The laptop half of the Open Campus publish pipeline, started by launchd (tools/publish/dev.seansooch.open-campus-publish.plist).
# The cloud drafting routine pushes unverified drafts to the claude/drafts branch; this run checks them with Codex
# (run.ts verify), then gates, commits the verified ones, pushes to main and ships.
# Runs in its own worktree (~/open-campus-publisher, branch publish/auto), never in a working checkout.
# Settings: ~/.config/open-campus/publish.env (OC_VERIFY_COUNT=40, OC_PAUSED=1 to skip runs).
set -euo pipefail
export PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
REPO=${0:A:h:h:h}
cd "$REPO"
PNPM=(npx --yes pnpm@10.33.4)
say() { print -r -- "[$(date -u +%FT%TZ)] $*"; }
notify() { osascript -e "display notification \"$1\" with title \"Open Campus publish\"" >/dev/null 2>&1 || true; }

if [[ -f ~/.config/open-campus/publish.env ]]; then set -a; source ~/.config/open-campus/publish.env; set +a; fi
if [[ "${OC_PAUSED:-0}" == 1 ]]; then say "paused (OC_PAUSED=1); nothing to do"; exit 0; fi

# One run at a time. mkdir is atomic; a lock left by a dead process is cleared.
LOCK="$HOME/Library/Caches/open-campus-publish.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  if kill -0 "$(cat "$LOCK/pid" 2>/dev/null)" 2>/dev/null; then say "another run holds the lock; exiting"; exit 0; fi
  rm -rf "$LOCK"; mkdir "$LOCK"
fi
print $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT
trap 'notify "Run failed; see ~/Library/Logs/open-campus-publish.log"' ERR

# The revising lane (Claude fixes what Codex finds) needs a Claude sign-in that works outside the desktop app: a long-lived token from
# `claude setup-token`, kept in the login Keychain. Its value never appears in files or logs.
# It is passed only to the verify step, not to npm, wrangler or anything else this script starts.
TOKEN=$(security find-generic-password -s open-campus-claude-token -w 2>/dev/null) || { say "no open-campus-claude-token in the Keychain"; exit 1; }

say "sync with origin/main"
git fetch -q origin
git reset -q --hard HEAD          # this worktree belongs to the publisher; a crashed run's partial files go
git clean -qfd content tools/publish
git rebase -q origin/main
"${PNPM[@]}" install --frozen-lockfile --silent

CLAUDE_CODE_OAUTH_TOKEN=$TOKEN "${PNPM[@]}" --silent drafts:verify
unset TOKEN

if [[ -z "$(git status --porcelain content tools/publish/log.jsonl)" ]]; then say "nothing new"; exit 0; fi

say "gate: course plans, tests"
"${PNPM[@]}" --silent course-plan
"${PNPM[@]}" --silent test

TOPICS=$(git status --porcelain --untracked-files=all content | sed -nE 's#^\?\? content/courses/([^/]+)/topics/([^/]+)/topic\.mdx#\1/\2#p' | paste -sd ',' - | sed 's/,/, /g')
git add content tools/publish/log.jsonl
git commit -q -m "Publish: ${TOPICS:-run log only}

Drafted by Claude in the cloud drafting routine and verified by Codex in the daily
publish run (tools/publish/daily.sh).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

say "push to main"
for attempt in 1 2 3; do
  git fetch -q origin && git rebase -q origin/main && git push -q origin HEAD:main && break
  [[ $attempt == 3 ]] && { say "push failed three times"; exit 1; }
  sleep 20
done

if [[ -z "$TOPICS" ]]; then say "only the log changed; no ship"; exit 0; fi
say "ship"
"${PNPM[@]}" ship
say "done: $TOPICS"
notify "Published: $TOPICS"
