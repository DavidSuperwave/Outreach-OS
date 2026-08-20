from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REQUIRED = [
    'README.md', '00-START-HERE.md', '01-AUTHORITY-AND-SCOPE.md',
    'CODEX-INSTRUCTIONS.md', 'CODEX-KICKSTART-PROMPT.md', 'AGENTS.md',
    'manifest/source-pins.json', 'manifest/package-manifest.json',
    'work-packets/WP-000-GROUND-TRUTH.md',
    'work-packets/WP-030-ARCHITECTURE-AND-BUILD-GRAPH.md',
    'scripts/install_into_repo.py', 'scripts/run_first_pass.py',
]

missing = [p for p in REQUIRED if not (ROOT / p).is_file()]
symlinks = [str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_symlink()]
large = [str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.stat().st_size > 10 * 1024 * 1024]

result = {
    'root': str(ROOT),
    'required_missing': missing,
    'symlinks': symlinks,
    'files_over_10mb': large,
    'file_count': sum(1 for p in ROOT.rglob('*') if p.is_file()),
}
result['status'] = 'PASS' if not missing and not symlinks and not large else 'FAIL'
print(json.dumps(result, indent=2))
sys.exit(0 if result['status'] == 'PASS' else 1)
