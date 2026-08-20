from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

PACKAGE = Path(__file__).resolve().parent.parent


def is_git_repo(path: Path) -> bool:
    proc = subprocess.run(['git', '-C', str(path), 'rev-parse', '--is-inside-work-tree'], capture_output=True, text=True)
    return proc.returncode == 0 and proc.stdout.strip() == 'true'


def main() -> int:
    parser = argparse.ArgumentParser(description='Install the Neuwave Codex kickstart package into a repository.')
    parser.add_argument('--target', required=True, help='Target repository root')
    parser.add_argument('--destination', default='docs/neuwave-rewrite')
    parser.add_argument('--force', action='store_true', help='Replace an existing destination only')
    args = parser.parse_args()

    target = Path(args.target).expanduser().resolve()
    destination = (target / args.destination).resolve()
    if not target.is_dir():
        raise SystemExit(f'Target does not exist: {target}')
    if not is_git_repo(target):
        raise SystemExit(f'Target is not a Git worktree: {target}')
    if target not in destination.parents:
        raise SystemExit('Destination must be inside the target repository.')

    if destination.exists():
        if not args.force:
            raise SystemExit(f'Destination exists: {destination}. Re-run with --force to replace only that folder.')
        shutil.rmtree(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(PACKAGE, destination, ignore=shutil.ignore_patterns('__pycache__', '*.pyc', 'CHECKSUMS.sha256'))

    start = target / 'CODEX_START_HERE.md'
    if not start.exists():
        start.write_text(
            '# Codex start here\n\nRead `docs/neuwave-rewrite/00-START-HERE.md`, then use '
            '`docs/neuwave-rewrite/CODEX-KICKSTART-PROMPT.md`.\n',
            encoding='utf-8'
        )

    root_agents = target / 'AGENTS.md'
    if not root_agents.exists():
        shutil.copy2(destination / 'AGENTS.md', root_agents)
        agent_message = f'Created {root_agents}'
    else:
        sidecar = target / 'AGENTS.neuwave-rewrite.md'
        if not sidecar.exists():
            shutil.copy2(destination / 'AGENTS.md', sidecar)
        agent_message = (
            f'Preserved existing {root_agents}. Created {sidecar}. '
            'Add a pointer to it in the existing AGENTS.md if you want its rules to govern the full repo.'
        )

    print(f'Installed package at: {destination}')
    print(agent_message)
    print('Next: replace path placeholders in CODEX-KICKSTART-PROMPT.md and paste it into Codex from the repo root.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
