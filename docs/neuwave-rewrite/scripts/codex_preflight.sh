#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/Neuwave [output-dir]" >&2
  exit 2
fi

NEUWAVE="$1"
OUTPUT="${2:-docs/neuwave-rewrite/reports/generated}"
python docs/neuwave-rewrite/scripts/run_first_pass.py --repo . --neuwave "$NEUWAVE" --output "$OUTPUT"
