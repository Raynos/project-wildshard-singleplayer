#!/usr/bin/env bash
# Installs the deploy backstop (E403) as a launchd agent: backstop.sh at :47 every second hour (00:47, 02:47 … 22:47).
# A run missed while the Mac sleeps executes on wake. Existing gh login only; no credential is written here.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL=com.wildshard.deploy-backstop
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$HOME/.wildshard/deploy-backstop"
GH="$(command -v gh)"
"$GH" auth status
mkdir -p "$DIR" "$HOME/Library/LaunchAgents"
hours=""
for h in $(seq 0 2 22); do
  hours+="<dict><key>Hour</key><integer>$h</integer><key>Minute</key><integer>47</integer></dict>"
done
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$ROOT/scripts/deploy-backstop/backstop.sh</string></array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$GH"):/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>StartCalendarInterval</key><array>$hours</array>
  <key>StandardOutPath</key><string>$DIR/launchd.log</string>
  <key>StandardErrorPath</key><string>$DIR/launchd.err.log</string>
</dict></plist>
PLIST
plutil -lint "$PLIST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL (:47 every second hour; missed runs execute on wake)."
