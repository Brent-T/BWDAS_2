"""FEED — evaluate alert thresholds and hand intelligence to consumers.

The Feed agent is where the pipeline stops being a CSV and becomes an early
warning. It reads the final CDIRecords, applies the 50/75/90 alert tiers and
formats plain-language district advisories, then pushes them through a
``Notifier`` interface.

For the PoC the notifier writes an ``alerts_<run_id>.md`` artifact and prints
to stdout (the CallMeBot/WhatsApp wiring slots in as a second Notifier without
touching this agent — see BWDAS.MD Phase 3).
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol, runtime_checkable

from .. import config
from ..models import CDIRecord
from .base import BaseAgent, PipelineContext, StageResult


@runtime_checkable
class Notifier(Protocol):
    """Delivery surface for alerts. PoC = file/stdout. Prod = WhatsApp/SMS."""

    def deliver(self, district: str, level: str, message: str) -> None: ...


def format_advisory(record: CDIRecord, level: str) -> str:
    """Plain-language advisory in the Kweneng format from BWDAS.MD."""
    return (
        f"BWDAS Alert — {record.district} district\n"
        f"Level: {level} (CDI: {record.cdi:.0f}/100)\n"
        f"Rainfall (SPI-3):  score {record.spi.score:.0f}/100\n"
        f"Vegetation (NDVI): score {record.ndvi.score:.0f}/100\n"
        f"Heat (LST):        score {record.lst.score:.0f}/100\n"
        f"Soil moisture:     score {record.sm.score:.0f}/100\n"
        f"Stress class:      {record.stress_level}\n"
        f"— BWDAS · run {record.run_id}"
    )


class FileWriterNotifier:
    """PoC notifier: appends each advisory to a markdown artifact."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text("# BWDAS alert feed\n\n")

    def deliver(self, district: str, level: str, message: str) -> None:
        with open(self.path, "a") as fh:
            fh.write(f"## [{level}] {district}\n\n```\n{message}\n```\n\n")


class FeedAgent(BaseAgent):
    name = "feed"
    consumes = ("cdi_records",)
    produces = "alert_feed"

    def run(self, ctx: PipelineContext) -> StageResult:
        records: list[CDIRecord] = ctx.artifacts["cdi_records"]
        config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        artifact = config.OUTPUT_DIR / f"alerts_{ctx.run_id}.md"
        notifier: Notifier = FileWriterNotifier(artifact)

        fired = 0
        for record in records:  # already sorted hottest-first
            level = config.alert_level(record.cdi)
            if level is None:
                continue
            notifier.deliver(record.district, level,
                             format_advisory(record, level))
            ctx.say(f"ALERT [{level}] {record.district} CDI={record.cdi}")
            fired += 1

        return StageResult(stage=self.name, ok=True, records=fired,
                           artifact=str(artifact))
