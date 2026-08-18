"""LOAD — persist the standardized CDIRecords to the master district table.

Design notes (deliberate):
  * Writes are ATOMIC: the table is written to a temp file and renamed into
    place, so a half-written master_district.csv can never be read by a
    consumer mid-run.
  * Every run ALSO drops an immutable snapshot (``cdi_<run_id>.csv``) so the
    weekly series accumulates ground truth — that archive is the long-term
    data moat described in BWDAS.MD, and it makes every run auditable.
  * Re-running the same run_id overwrites deterministically (idempotent).
"""

from __future__ import annotations

import csv
import os

from .. import config
from ..models import CDIRecord
from .base import BaseAgent, PipelineContext, StageResult

COLUMNS = [
    "district", "spi_raw", "spi_score", "ndvi_raw", "ndvi_score",
    "lst_raw", "lst_score", "sm_raw", "sm_score", "cdi", "stress_level",
    "run_id", "generated_at",
]


def _row(record: CDIRecord) -> dict:
    return {
        "district": record.district,
        "spi_raw": round(record.spi.raw, 3),
        "spi_score": record.spi.score,
        "ndvi_raw": round(record.ndvi.raw, 4),
        "ndvi_score": record.ndvi.score,
        "lst_raw": round(record.lst.raw, 2),
        "lst_score": record.lst.score,
        "sm_raw": round(record.sm.raw, 4),
        "sm_score": record.sm.score,
        "cdi": record.cdi,
        "stress_level": record.stress_level,
        "run_id": record.run_id,
        "generated_at": record.generated_at.isoformat(),
    }


def _write_atomic(path, records) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        for record in records:
            writer.writerow(_row(record))
    os.replace(tmp, path)  # atomic on POSIX and Windows


class LoadAgent(BaseAgent):
    name = "load"
    consumes = ("cdi_records",)
    produces = "master_csv"

    def run(self, ctx: PipelineContext) -> StageResult:
        records: list[CDIRecord] = ctx.artifacts["cdi_records"]
        if not records:
            return StageResult(stage=self.name, ok=False,
                               errors=["no CDIRecords to persist"])

        config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        master = config.OUTPUT_DIR / "master_district.csv"
        snapshot = config.STANDARD_DIR / f"cdi_{ctx.run_id}.csv"
        config.STANDARD_DIR.mkdir(parents=True, exist_ok=True)

        _write_atomic(master, records)
        _write_atomic(snapshot, records)  # immutable per-run archive

        return StageResult(stage=self.name, ok=True, records=len(records),
                           artifact=str(master))
