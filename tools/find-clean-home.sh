#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
while IFS= read -r commit; do
  if ! git show "$commit:client/src/pages/Home.tsx" 2>/dev/null | grep -qE '^(<<<<<<<|=======|>>>>>>>)'; then
    echo "$commit"
    git show -s --format='%h %s' "$commit"
    exit 0
  fi
done < <(git log --format='%H' --all -- client/src/pages/Home.tsx)
echo "No clean Home.tsx commit found" >&2
exit 1
