#!/bin/zsh
# Installs (or reinstalls) the daily publish job for this worktree. Uninstall:
#   launchctl bootout gui/$(id -u)/dev.seansooch.open-campus-publish
set -euo pipefail
REPO=${0:A:h:h:h}
PLIST=~/Library/LaunchAgents/dev.seansooch.open-campus-publish.plist
sed -e "s#__REPO__#$REPO#g" -e "s#__HOME__#$HOME#g" "$REPO/tools/publish/dev.seansooch.open-campus-publish.plist" > "$PLIST"
launchctl bootout gui/$(id -u)/dev.seansooch.open-campus-publish 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$PLIST"
print "installed: daily at 05:30 from $REPO; log ~/Library/Logs/open-campus-publish.log"
