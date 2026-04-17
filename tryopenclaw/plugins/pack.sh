#!/usr/bin/env bash
set -euo pipefail

# Usage: ./pack.sh <plugin-name>
# Example: ./pack.sh auth-codex
#
# Packs the plugin into a .tgz file in the my-op-plugins/dist/ folder.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <plugin-name>"
  echo ""
  echo "Available plugins:"
  for d in "$SCRIPT_DIR"/*/; do
    [[ -f "$d/package.json" ]] && echo "  $(basename "$d")"
  done
  exit 1
fi

PLUGIN="$1"
PLUGIN_DIR="$SCRIPT_DIR/$PLUGIN"

if [[ ! -d "$PLUGIN_DIR" ]]; then
  echo "Error: plugin '$PLUGIN' not found at $PLUGIN_DIR"
  exit 1
fi

if [[ ! -f "$PLUGIN_DIR/package.json" ]]; then
  echo "Error: no package.json in $PLUGIN_DIR"
  exit 1
fi

DIST_DIR="$SCRIPT_DIR/build"
mkdir -p "$DIST_DIR"

echo "Packing $PLUGIN..."
TGZ=$(cd "$PLUGIN_DIR" && npm pack --pack-destination "$DIST_DIR" 2>/dev/null | tail -1)

echo ""
echo "Done: build/$TGZ"
echo ""
echo "Install with:"
echo "  openclaw plugins install $DIST_DIR/$TGZ"
echo ""
echo "If blocked by security scan (e.g. child_process usage), force with:"
echo "  openclaw plugins install --dangerously-force-unsafe-install $DIST_DIR/$TGZ"
