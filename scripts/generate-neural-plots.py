#!/usr/bin/env python3
"""Run the self-contained public neural-populations example plot generator."""
from pathlib import Path
import runpy

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().parents[1] / "examples" / "neural-populations" / "scripts" / "generate-plots.py"), run_name="__main__")
