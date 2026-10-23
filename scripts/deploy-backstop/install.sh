#!/usr/bin/env bash
# Installs the deploy backstop (E403) as a launchd agent: backstop.sh at :47 every hour.
# A run missed while the Mac sleeps executes on wake. Existing gh login only; no credential is written here.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL=com.wildshard.deploy-backstop
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$HOME/.wildshard/deploy-backstop"
GH="$(command -v gh)"
NODE="$(command -v node)"
"$NODE" --version
"$GH" auth status
mkdir -p "$DIR" "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$ROOT/scripts/deploy-backstop/backstop.sh</string></array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$GH"):$(dirname "$NODE"):/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>StartCalendarInterval</key><dict><key>Minute</key><integer>47</integer></dict>
  <key>StandardOutPath</key><string>$DIR/launchd.log</string>
  <key>StandardErrorPath</key><string>$DIR/launchd.err.log</string>
</dict></plist>
PLIST
plutil -lint "$PLIST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL (:47 every hour; missed runs execute on wake)."
