"""STANDARDIZE — turn raw readings into comparable 0-100 stress scores + CDI.

This agent is deliberately PURE: no I/O, no clock, no network. Given the same
raw readings it always returns the same CDIRecords, which is exactly what the
unit tests pin down.

Normalisation follows the PoC method in BWDAS.MD:
  * each variable is min-max scaled to 0-100 across the nine districts,
  * variables where a LOW value means stress (SPI, NDVI, soil moisture) are
    inverted so that, uniformly, 0 = no stress and 100 = maximum stress,
  * the fixed World Bank weights (40/20/20/20) combine them into the CDI.

A district missing any one variable is DROPPED with an explicit error rather
than imputed — imputation is a Phase-1 decision, not a silent default.
"""

from __future__ import annotations

from .. import config
from ..models import CDIRecord, RawDistrictReading, VariableScore
from .base import BaseAgent, PipelineContext, StageResult

# Variables where a LOW observed value indicates HIGH stress.
INVERTED = {"spi", "ndvi", "sm"}


def _normalise(values: list[float], invert: bool) -> list[float]:
    """Min-max scale to 0-100; optionally invert the direction of stress."""
    lo, hi = min(values), max(values)
    if hi == lo:
        return [50.0] * len(values)  # flat field -> neutral stress
    scores = [(v - lo) / (hi - lo) * 100.0 for v in values]
    return [100.0 - s for s in scores] if invert else scores


class StandardizeAgent(BaseAgent):
    name = "standardize"
    consumes = ("raw_readings",)
    produces = "cdi_records"

    def run(self, ctx: PipelineContext) -> StageResult:
        raw: list[RawDistrictReading] = ctx.artifacts["raw_readings"]
        errors: list[str] = []

        # Pivot to {district: {variable: value}}.
        by_district: dict[str, dict[str, RawDistrictReading]] = {}
        for reading in raw:
            by_district.setdefault(reading.district, {})[reading.variable] = reading

        # Only districts with ALL four variables are scored (no silent imputation).
        complete = {
            d: vars_
            for d, vars_ in by_district.items()
            if all(v in vars_ for v in config.VARIABLES)
        }
        for district, vars_ in by_district.items():
            if district not in complete:
                missing = sorted(set(config.VARIABLES) - set(vars_))
                errors.append(f"{district}: dropped (missing {missing})")

        districts = sorted(complete)
        if not districts:
            return StageResult(stage=self.name, ok=False,
                               errors=["no complete districts to score"],
                               records=0)

        # Normalise each variable across districts, then weight + sum.
        scores: dict[str, dict[str, float]] = {v: {} for v in config.VARIABLES}
        for variable in config.VARIABLES:
            ordered = [complete[d][variable].value for d in districts]
            for d, s in zip(districts, _normalise(ordered, variable in INVERTED)):
                scores[variable][d] = s

        records: list[CDIRecord] = []
        for district in districts:
            parts = {v: scores[v][district] for v in config.VARIABLES}
            cdi = sum(parts[v] * config.DATASETS[v]["weight"] for v in config.VARIABLES)
            cdi = round(min(100.0, max(0.0, cdi)), 1)

            def varscore(v: str) -> VariableScore:
                reading = complete[district][v]
                return VariableScore(raw=reading.value, anomaly=reading.value,
                                     score=round(parts[v], 1))

            records.append(CDIRecord(
                district=district, run_id=ctx.run_id,
                spi=varscore("spi"), ndvi=varscore("ndvi"),
                lst=varscore("lst"), sm=varscore("sm"),
                cdi=cdi, stress_level=config.stress_level(cdi),
            ))

        records.sort(key=lambda r: -r.cdi)  # hottest districts first
        return StageResult(stage=self.name, ok=True, records=len(records),
                           errors=errors, artifact=records)
