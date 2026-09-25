#!/bin/bash
# Installs a macOS launchd job that runs scripts/run_scan.py every day at
# 8:00 local time, with auto-discovery (real LLM cost) added on Mondays only
# -- discovered profiles land as "pending review", so a weekly batch keeps
# that review queue manageable. If the Mac is asleep at 8:00, launchd runs
# the job once on the next wake instead of skipping the day.
#
# This is the interim schedule until the API is deployed; after that, point
# a cron at POST /scan/run instead (see app/routers/scan.py).
#
# Usage (from anywhere):   api/scripts/install_daily_scan.sh
# Uninstall:               api/scripts/install_daily_scan.sh --uninstall
# Log:                     ~/Library/Logs/biolens-scan.log

set -euo pipefail

LABEL="com.biolens.daily-scan"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
API_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$HOME/Library/Logs/biolens-scan.log"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -f "$PLIST"
  echo "Uninstalled $LABEL."
  exit 0
fi

# macOS privacy protection (TCC) blocks background jobs from reading
# ~/Downloads, ~/Desktop, and ~/Documents -- the job would install fine and
# then fail every morning with "Operation not permitted". Refuse up front.
case "$API_DIR" in
  "$HOME/Downloads"*|"$HOME/Desktop"*|"$HOME/Documents"*)
    echo "This repo is under a macOS-protected folder ($API_DIR), which launchd" >&2
    echo "jobs can't read. Move it (e.g. to ~/Developer/biolens) and rerun this." >&2
    exit 1
    ;;
esac

if [[ ! -x "$API_DIR/.venv/bin/python" ]]; then
  echo "No virtualenv at $API_DIR/.venv -- set up the API first (see README)." >&2
  exit 1
fi

mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>$API_DIR</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>if [ "\$(date +%u)" = 1 ]; then exec .venv/bin/python -m scripts.run_scan --discover; else exec .venv/bin/python -m scripts.run_scan; fi</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL: daily at 8:00 (discovery on Mondays). Log: $LOG"
