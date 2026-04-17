#!/usr/bin/env bash
set -euo pipefail

# Usage: ./pack.sh <skill-name>
# Example: ./pack.sh openai-codex-oauth
#
# Packs the skill into a .tar.gz file in the skills/build/ folder.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <skill-name>"
  echo ""
  echo "Available skills:"
  for d in "$SCRIPT_DIR"/*/; do
    [[ -f "$d/SKILL.md" ]] && echo "  $(basename "$d")"
  done
  exit 1
fi

SKILL="$1"
SKILL_DIR="$SCRIPT_DIR/$SKILL"

if [[ ! -d "$SKILL_DIR" ]]; then
  echo "Error: skill '$SKILL' not found at $SKILL_DIR"
  exit 1
fi

if [[ ! -f "$SKILL_DIR/SKILL.md" ]]; then
  echo "Error: no SKILL.md in $SKILL_DIR"
  exit 1
fi

BUILD_DIR="$SCRIPT_DIR/build"
mkdir -p "$BUILD_DIR"

TARBALL="$SKILL.tar.gz"

echo "Packing $SKILL..."
tar czf "$BUILD_DIR/$TARBALL" -C "$SCRIPT_DIR" "$SKILL"

echo ""
echo "Done: build/$TARBALL"
echo ""
echo "Install with:"
echo "  tar xzf $TARBALL -C <workspace>/skills/"
