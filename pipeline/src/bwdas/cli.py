"""BWDAS pipeline orchestrator — the single entry point.

Windows Task Scheduler (PoC) and GitHub Actions (production) both call:

    python -m bwdas.cli run

The orchestrator owns ONLY sequencing and fail-fast policy; all domain logic
lives in the agents. A stage returning ``ok=False`` aborts the run with a
non-zero exit code so the scheduler surface the failure.

Model C Support: The StandardizeAgent can be initialized with climatological
baselines loaded from climatology_baselines.csv for Z-score calculations.
"""

from __future__ import annotations

import argparse
import csv
import sys
import uuid
from datetime import datetime
from pathlib import Path

from .agents.base import PipelineContext
from .agents.extract_agent import EarthEngineGateway, ExtractAgent
from .agents.feed_agent import FeedAgent
from .agents.load_agent import LoadAgent
from .agents.standardize_agent import StandardizeAgent
from .config import DATA_DIR


def _load_climatology_baselines(baseline_path: Path | None = None) -> dict[tuple[str, str, int], dict[str, float]]:
    """Load climatological baselines from CSV for Model C Z-score calculations.
    
    Args:
        baseline_path: Path to climatology_baselines.csv. If None, uses default location.
    
    Returns:
        Dict mapping (district, variable, month) → {"mean": float, "std": float}
    """
    if baseline_path is None:
        baseline_path = DATA_DIR / "input" / "climatology_baselines.csv"
    
    if not baseline_path.exists():
        print(f"  Note: No climatology baselines found at {baseline_path}")
        print("  Model C Z-scores will be unavailable. Run generate_baselines.py first.")
        return {}
    
    baselines = {}
    try:
        with open(baseline_path, newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                key = (row["district"], row["variable"], int(row["month"]))
                baselines[key] = {
                    "mean": float(row["mean_val"]),
                    "std": float(row["std_val"]),
                }
        print(f"  Loaded {len(baselines)} baseline records from {baseline_path}")
    except Exception as e:
        print(f"  Warning: Failed to load baselines: {e}")
        return {}
    
    return baselines


def run_pipeline(run_id: str | None = None, gateway=None, use_model_c: bool = True) -> int:
    run_id = run_id or datetime.utcnow().strftime("%Y%m%d") + "-" + uuid.uuid4().hex[:6]
    ctx = PipelineContext(run_id=run_id)

    # The gateway is injectable so tests/offline runs never need GEE auth.
    # Load climatology baselines for Model C if available
    baselines = _load_climatology_baselines() if use_model_c else {}
    
    agents = [
        ExtractAgent(gateway or EarthEngineGateway()),
        StandardizeAgent(baselines=baselines),
        LoadAgent(),
        FeedAgent(),
    ]

    for agent in agents:
        result = agent.execute(ctx)
        print(f"{'OK ' if result.ok else 'ERR'} {result.stage:<12} "
              f"records={result.records:<3} {result.duration_s}s")
        for error in result.errors:
            print(f"    ! {error}")
        if not result.ok:
            result.raise_if_failed()  # raises -> non-zero exit below

    print(f"\nDone. run_id={run_id}")
    for line in ctx.log:
        print("  " + line)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="bwdas", description="BWDAS drought-index ETL pipeline")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="run Extract -> Standardize -> Load -> Feed")
    run.add_argument("--run-id", default=None, help="stable id for idempotent re-runs")
    run.add_argument(
        "--no-model-c",
        action="store_true",
        help="disable Model C Z-score calculations (use Model A spatial only)"
    )
    args = parser.parse_args(argv)

    if args.command == "run":
        try:
            return run_pipeline(run_id=args.run_id, use_model_c=not args.no_model_c)
        except RuntimeError as exc:
            print(f"PIPELINE FAILED: {exc}", file=sys.stderr)
            return 1
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
