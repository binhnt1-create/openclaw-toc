#!/usr/bin/env bash
set -euo pipefail

# Usage: ./pack.sh <bundle-name>
# Example: ./pack.sh jira-agent-bundle
#
# Packs an agent bundle into a .tar.gz file for distribution.
# Excludes node_modules, .env, credentials, and session state.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <bundle-name>"
  echo ""
  echo "Available bundles:"
  for d in "$SCRIPT_DIR"/*/; do
    [[ -f "$d/bundle.json" ]] && echo "  $(basename "$d")"
  done
  exit 1
fi

BUNDLE="$1"
BUNDLE_DIR="$SCRIPT_DIR/$BUNDLE"

if [[ ! -d "$BUNDLE_DIR" ]]; then
  echo "Error: bundle '$BUNDLE' not found at $BUNDLE_DIR"
  exit 1
fi

if [[ ! -f "$BUNDLE_DIR/bundle.json" ]]; then
  echo "Error: no bundle.json in $BUNDLE_DIR"
  exit 1
fi

# Read bundle id from bundle.json
BUNDLE_ID=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['id'])" "$BUNDLE_DIR/bundle.json" 2>/dev/null || echo "$BUNDLE")

DIST_DIR="$SCRIPT_DIR/build"
mkdir -p "$DIST_DIR"

OUTPUT="$DIST_DIR/${BUNDLE_ID}.tar.gz"

echo "Packing bundle: $BUNDLE (id: $BUNDLE_ID)"

tar -czf "$OUTPUT" \
  -C "$SCRIPT_DIR" \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='auth-profiles.json' \
  --exclude='*.credentials' \
  --exclude='*.token' \
  --exclude='.DS_Store' \
  --exclude='USER.md' \
  --exclude='TOOLS.md' \
  --exclude='memory' \
  --exclude='MEMORY.md' \
  "$BUNDLE"

SIZE=$(du -h "$OUTPUT" | cut -f1)

echo ""
echo "Done: build/$(basename "$OUTPUT") ($SIZE)"
echo ""
echo "Send to client. They should:"
echo "  1. Extract:  tar -xzf $(basename "$OUTPUT") -C workspace/"
echo "  2. Rename:   mv workspace/$BUNDLE workspace/$BUNDLE_ID"
echo "  3. Install:  /agent-add $BUNDLE_ID"
