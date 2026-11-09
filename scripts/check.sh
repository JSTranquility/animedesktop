#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$project_dir"
while IFS= read -r -d '' source_file; do node --check "$source_file"; done < <(find src scripts tests -name '*.js' -print0)
for script_file in scripts/*.sh; do bash -n "$script_file"; done
node tests/calendar-model.mjs
node tests/theme.mjs
node tests/preferences-model.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/audit-publication.py
