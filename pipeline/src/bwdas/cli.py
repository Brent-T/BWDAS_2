"""BWDAS pipeline orchestrator — the single entry point.

Windows Task Scheduler (PoC) and GitHub Actions (production) both call:

    python -m bwdas.cli run

The orchestrator owns ONLY sequencing and fail-fast policy; all domain logic
lives in the agents. A stage returning ``ok=False`` aborts the run with a
non-zero exit code so the scheduler surface the failure.
"""

from __future__ import annotations

import argparse
import sys
import uuid
from datetime import datetime

from .agents.base import PipelineContext
from .agents.extract_agent import EarthEngineGateway, ExtractAgent
from .agents.feed_agent import FeedAgent
from .agents.load_agent import LoadAgent
from .agents.standardize_agent import StandardizeAgent


def run_pipeline(run_id: str | None = None, gateway=None) -> int:
    run_id = run_id or datetime.utcnow().strftime("%Y%m%d") + "-" + uuid.uuid4().hex[:6]
    ctx = PipelineContext(run_id=run_id)

    # The gateway is injectable so tests/offline runs never need GEE auth.
    agents = [
        ExtractAgent(gateway or EarthEngineGateway()),
        StandardizeAgent(),
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
    args = parser.parse_args(argv)

    if args.command == "run":
        try:
            return run_pipeline(run_id=args.run_id)
        except RuntimeError as exc:
            print(f"PIPELINE FAILED: {exc}", file=sys.stderr)
            return 1
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
