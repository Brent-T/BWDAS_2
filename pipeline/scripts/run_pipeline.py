"""Run the current four-stage BWDAS pipeline against Earth Engine."""

from __future__ import annotations

import datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from bwdas import config
from bwdas.agents.base import PipelineContext
from bwdas.agents.extract_agent import EarthEngineGateway, ExtractAgent
from bwdas.agents.feed_agent import FeedAgent
from bwdas.agents.load_agent import LoadAgent
from bwdas.agents.standardize_agent import StandardizeAgent


def main() -> int:
    run_id = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M")
    context = PipelineContext(run_id=run_id)
    stages = [
        ExtractAgent(EarthEngineGateway()),
        StandardizeAgent(),
        LoadAgent(),
        FeedAgent(),
    ]

    for stage in stages:
        print(f"\n--- Running {stage.name} ---")
        result = stage.execute(context)
        print(
            f"  ok={result.ok} records={result.records} "
            f"duration={result.duration_s}s"
        )
        if result.errors:
            print(f"  errors ({len(result.errors)}):")
            for error in result.errors[:5]:
                print(f"    {error}")
        if not result.ok:
            print(f"PIPELINE ABORTED at {stage.name}")
            return 1

    print(f"\n--- Pipeline complete. Run ID: {run_id} ---")
    print(f"Master CSV: {config.OUTPUT_DIR / 'master_district.csv'}")
    print(f"Alerts:     {config.OUTPUT_DIR / f'alerts_{run_id}.md'}")
    print("\nContext log:")
    for line in context.log:
        print(f"  {line}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
