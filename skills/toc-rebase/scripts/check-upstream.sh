#!/bin/bash
# Check for new upstream versions vs latest rebase branch.
# Usage: bash dev-docs/scripts/check-upstream.sh

set -euo pipefail

# Fetch latest tags silently
git fetch upstream --tags -q 2>/dev/null || {
  echo "❌ upstream remote chưa được thêm. Chạy:"
  echo "   git remote add upstream git@github.com:openclaw/openclaw.git"
  exit 1
}

# Latest stable upstream tag
LATEST=$(git tag | grep -E '^v2026\.' | grep -v beta | sort -V | tail -1)

# Latest rebase branch
LATEST_REBASE=$(git branch --list 'rebase-vs-*' | sed 's/^[* ]*//' | sort -V | tail -1)
REBASE_VERSION=${LATEST_REBASE#rebase-vs-}

if [ "$LATEST" = "$REBASE_VERSION" ]; then
  echo "✅ Up to date — $LATEST"
else
  echo "🔔 New version: $LATEST (rebase hiện tại: $REBASE_VERSION)"
  echo ""
  echo "Tiếp theo:"
  echo "  1. gh release view $LATEST --repo openclaw/openclaw"
  echo "  2. Tạo dev-docs/rebase/$LATEST.md"
  echo "  3. git checkout -b rebase-vs-$LATEST rebase-vs-$REBASE_VERSION"
  echo "  4. git rebase --onto $LATEST $REBASE_VERSION"
fi
