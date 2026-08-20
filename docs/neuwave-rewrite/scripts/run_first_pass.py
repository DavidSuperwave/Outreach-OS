from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def run(args: list[str]) -> None:
    print('+', ' '.join(args))
    proc = subprocess.run(args)
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


def main() -> int:
    parser = argparse.ArgumentParser(description='Run read-only first-pass verification and inventory generation.')
    parser.add_argument('--repo', default='.')
    parser.add_argument('--neuwave', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    repo = Path(args.repo).expanduser().resolve()
    neuwave = Path(args.neuwave).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)

    api = repo / 'cloudflare-os' / 'packages' / 'workshop-shared' / 'src' / 'api.ts'
    if not api.is_file():
        raise SystemExit(f'Missing Cloudflare OS API file: {api}. Initialize the submodule first.')
    if not neuwave.is_dir():
        raise SystemExit(f'Missing Neuwave reference repo: {neuwave}')

    run([sys.executable, str(HERE / 'verify_repo_baseline.py'), '--repo', str(repo), '--neuwave', str(neuwave), '--output', str(output / 'baseline.json')])
    run([sys.executable, str(HERE / 'inventory_cf_os_rpc.py'), '--api', str(api), '--output', str(output / 'cf-os-rpc-mechanical.csv')])
    run([sys.executable, str(HERE / 'inventory_neuwave_hotkeys.py'), '--root', str(neuwave), '--output', str(output / 'neuwave-hotkeys-mechanical.csv')])
    print('\nFirst-pass mechanical outputs complete.')
    print('Codex must now review and enrich them according to WP-010 through WP-030.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
