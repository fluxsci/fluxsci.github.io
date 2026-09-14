#!/usr/bin/env python3
"""Regenerate only the additional neuroscience plots, leaving compositions alone."""
from pathlib import Path
import subprocess
import sys


def main():
    scripts = Path(__file__).resolve().parent
    project = scripts.parents[1]
    for name in ('population.py', 'tuning.py', 'architecture.py'):
        subprocess.run([sys.executable, str(scripts / name), '--project', str(project)],
                       cwd=project, check=True)
    subprocess.run([sys.executable, str(scripts / 'preview.py')], cwd=project, check=True)


if __name__ == '__main__':
    main()
