#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$script_dir/../logs"
exec python3 "$script_dir/lifecycle.py" session >> "$script_dir/../logs/session.log" 2>&1
