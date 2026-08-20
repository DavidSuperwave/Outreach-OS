from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any


def run(cwd: Path, *args: str) -> dict[str, Any]:
    proc = subprocess.run(list(args), cwd=cwd, text=True, capture_output=True)
    return {
        'command': list(args),
        'returncode': proc.returncode,
        'stdout': proc.stdout.strip(),
        'stderr': proc.stderr.strip(),
    }


def inspect_repo(path: Path) -> dict[str, Any]:
    return {
        'path': str(path),
        'is_dir': path.is_dir(),
        'head': run(path, 'git', 'rev-parse', 'HEAD') if path.is_dir() else None,
        'branch_status': run(path, 'git', 'status', '--short', '--branch') if path.is_dir() else None,
        'remotes': run(path, 'git', 'remote', '-v') if path.is_dir() else None,
        'submodules': run(path, 'git', 'submodule', 'status', '--recursive') if path.is_dir() else None,
        'cloudflare_os_gitlink': run(path, 'git', 'ls-tree', 'HEAD', 'cloudflare-os') if path.is_dir() else None,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', default='.')
    parser.add_argument('--neuwave')
    parser.add_argument('--output')
    args = parser.parse_args()

    repo = Path(args.repo).expanduser().resolve()
    result: dict[str, Any] = {'implementation_repo': inspect_repo(repo)}
    if args.neuwave:
        result['neuwave_reference'] = inspect_repo(Path(args.neuwave).expanduser().resolve())

    payload = json.dumps(result, indent=2)
    if args.output:
        out = Path(args.output).expanduser().resolve()
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(payload + '\n', encoding='utf-8')
    print(payload)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
