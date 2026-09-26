#!/bin/bash
# Installs a macOS launchd job that runs scripts/run_scan.py on a schedule:
# every 6 hours by default (2:00, 8:00, 14:00, 20:00 local), or once a day at
# 8:00 with --daily. Each run finds new papers and SEC filings, has Claude
# make an impact call on each new paper, and updates earlier calls' stock
# outcomes. Claude is only called when there's a new paper, so running more
# often costs next to nothing extra. Auto-discovery (new companies, real LLM
# cost, lands as "pending review") runs at most once a week regardless of
# how often the scan fires -- see run_scan.py's --weekly-discovery.
#
# If the Mac is asleep at a scheduled time, launchd runs the job once on the
# next wake (missed runs are coalesced, not replayed).
#
# This is the interim schedule until the API is deployed; after that, point
# a cron at POST /scan/run instead (see app/routers/scan.py).
#
# Usage (from anywhere):   api/scripts/install_scan_schedule.sh [--daily]
# Uninstall:               api/scripts/install_scan_schedule.sh --uninstall
# Log:                     ~/Library/Logs/biolens-scan.log

set -euo pipefail

LABEL="com.biolens.scan"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
API_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$HOME/Library/Logs/biolens-scan.log"

# Also removes the job's earlier, daily-only name if it's still installed.
for old in "$LABEL" com.biolens.daily-scan; do
  launchctl bootout "gui/$(id -u)/$old" 2>/dev/null || true
  rm -f "$HOME/Library/LaunchAgents/$old.plist"
done

if [[ "${1:-}" == "--uninstall" ]]; then
  echo "Uninstalled $LABEL."
  exit 0
fi

HOURS="2 8 14 20"
DESCRIPTION="every 6 hours"
if [[ "${1:-}" == "--daily" ]]; then
  HOURS="8"
  DESCRIPTION="daily at 8:00"
fi

# macOS privacy protection (TCC) blocks background jobs from reading
# ~/Downloads, ~/Desktop, and ~/Documents -- the job would install fine and
# then fail every run with "Operation not permitted". Refuse up front.
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

CALENDAR=""
for hour in $HOURS; do
  CALENDAR+="    <dict><key>Hour</key><integer>$hour</integer><key>Minute</key><integer>0</integer></dict>"$'\n'
done

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
    <string>$API_DIR/.venv/bin/python</string>
    <string>-m</string>
    <string>scripts.run_scan</string>
    <string>--weekly-discovery</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
$CALENDAR  </array>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

plutil -lint "$PLIST" >/dev/null
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL: $DESCRIPTION (discovery at most weekly). Log: $LOG"
