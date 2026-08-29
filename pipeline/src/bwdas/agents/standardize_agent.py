"""STANDARDIZE — turn raw readings into comparable 0-100 stress scores + CDI.

This agent is deliberately PURE: no I/O, no clock, no network. Given the same
raw readings it always returns the same CDIRecords, which is exactly what the
unit tests pin down.

DUAL-MODEL APPROACH:
  * Model A (spatial min-max): retained for regional ranking dashboards
  * Model C (climatological Z-scores): PRIMARY scientific early-warning system
  
Model C converts all variables to unitless Z-scores based on local historical
baselines, enabling statistically valid weighted combination (40/20/20/20).

A district missing any one variable is DROPPED with an explicit error rather
than imputed — imputation is a Phase-1 decision, not a silent default.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from .. import config
from ..models import CDIRecord, RawDistrictReading, VariableScore
from .base import BaseAgent, PipelineContext, StageResult

# Variables where a LOW observed value indicates HIGH stress.
INVERTED = {"spi", "ndvi", "sm"}

# LST is the only variable where HIGH value = HIGH stress (so we subtract its Z-score)
LST_INVERT_SIGN = -1.0


def _normalise_spatial(values: list[float], invert: bool) -> list[float]:
    """Min-max scale to 0-100; optionally invert the direction of stress (Model A)."""
    lo, hi = min(values), max(values)
    
    # Use a small epsilon threshold to catch near-identical values and micro-traces
    EPSILON = 1e-4
    if (hi - lo) < EPSILON:
        # If inverted (SPI, NDVI, SM), lower value means higher stress.
        # For a dead-dry winter field where all values are ~0, stress should be 100.0, not 50.0.
        return [100.0] * len(values) if invert else [0.0] * len(values)
        
    scores = [(v - lo) / (hi - lo) * 100.0 for v in values]
    return [100.0 - s for s in scores] if invert else scores


def _compute_z_score(value: float, mean: float, std: float) -> float:
    """Compute Z-score: (X - μ) / σ. Returns 0.0 if std is zero/near-zero."""
    if std < 1e-9:
        return 0.0
    return (value - mean) / std


def _z_to_stress_pct(z: float) -> float:
    """Map Z-score to 0-100% stress scale.
    
    Z <= -2.0 → 100% (Extreme Stress)
    Z >= 0.0  → 0% (No Stress / Above Normal)
    Linear interpolation between.
    """
    if z >= 0:
        return 0.0
    elif z <= -2.0:
        return 100.0
    else:
        return (z / -2.0) * 100.0


def _stress_level_z(z_cdi: float) -> str:
    """Map composite Z-CDI to categorical stress level (Model C)."""
    if z_cdi <= -2.0:
        return "Extreme Stress"
    elif z_cdi <= -1.5:
        return "Severe Stress"
    elif z_cdi <= -1.0:
        return "Watch"
    else:
        return "Normal"


class StandardizeAgent(BaseAgent):
    name = "standardize"
    consumes = ("raw_readings",)
    produces = "cdi_records"

    def __init__(self, baselines: dict[tuple[str, str, int], dict[str, float]] | None = None):
        """Initialize with optional climatological baselines for Model C.
        
        Args:
            baselines: Dict mapping (district, variable, month) → {mean, std}
                       Loaded from climatology_baselines.csv by the pipeline runner.
        """
        self.baselines = baselines or {}

    def _get_baseline(self, district: str, variable: str, date_str: str) -> dict[str, float] | None:
        """Retrieve baseline mean/std for a district, variable, and date.
        
        Uses calendar month from the date string (ISO format YYYY-MM-DD).
        """
        try:
            dt = datetime.fromisoformat(date_str)
            month = dt.month
        except (ValueError, TypeError):
            return None
        
        key = (district, variable, month)
        return self.baselines.get(key)

    def _compute_model_c_scores(
        self,
        district: str,
        variable: str,
        value: float,
        date_str: str,
    ) -> tuple[float | None, float | None, float | None, float | None]:
        """Compute Model C Z-score metrics for a single observation.
        
        Returns:
            (z_score, baseline_mean, baseline_std, stress_pct) or (None, None, None, None) if no baseline
        """
        baseline = self._get_baseline(district, variable, date_str)
        if baseline is None:
            return None, None, None, None
        
        mean = baseline["mean"]
        std = baseline["std"]
        z = _compute_z_score(value, mean, std)
        
        # For LST, positive Z means hotter than normal = stress, so invert sign
        if variable == "lst":
            z = -z
        
        stress_pct = _z_to_stress_pct(z)
        return z, mean, std, stress_pct

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

        # ========== MODEL A: Spatial Min-Max (retained for comparison) ==========
        spatial_scores: dict[str, dict[str, float]] = {v: {} for v in config.VARIABLES}
        for variable in config.VARIABLES:
            ordered = [complete[d][variable].value for d in districts]
            for d, s in zip(districts, _normalise_spatial(ordered, variable in INVERTED)):
                spatial_scores[variable][d] = s

        # ========== MODEL C: Climatological Z-Scores (PRIMARY) ==========
        # Compute Z-scores for each district/variable if baselines available
        z_scores: dict[str, dict[str, float | None]] = {v: {} for v in config.VARIABLES}
        baseline_means: dict[str, dict[str, float | None]] = {v: {} for v in config.VARIABLES}
        baseline_stds: dict[str, dict[str, float | None]] = {v: {} for v in config.VARIABLES}
        z_stress_pcts: dict[str, dict[str, float | None]] = {v: {} for v in config.VARIABLES}
        
        for district in districts:
            for variable in config.VARIABLES:
                reading = complete[district][variable]
                z, mean, std, stress_pct = self._compute_model_c_scores(
                    district, variable, reading.value, reading.date
                )
                z_scores[variable][district] = z
                baseline_means[variable][district] = mean
                baseline_stds[variable][district] = std
                z_stress_pcts[variable][district] = stress_pct

        # ========== BUILD RECORDS WITH BOTH MODELS ==========
        records: list[CDIRecord] = []
        for district in districts:
            # Model A: spatial CDI
            spatial_parts = {v: spatial_scores[v][district] for v in config.VARIABLES}
            cdi_spatial = sum(
                spatial_parts[v] * config.DATASETS[v]["weight"] for v in config.VARIABLES
            )
            cdi_spatial = round(min(100.0, max(0.0, cdi_spatial)), 1)

            # Model C: climatological Z-CDI (only if all baselines available)
            z_parts = [z_scores[v][district] for v in config.VARIABLES]
            if all(z is not None for z in z_parts):
                # Composite Z-CDI: 0.40*SPI + 0.20*NDVI - 0.20*LST + 0.20*SM
                # Note: LST Z-score was already inverted in _compute_model_c_scores
                cdi_z = (
                    0.40 * z_parts[0] +  # SPI
                    0.20 * z_parts[1] +  # NDVI
                    0.20 * z_parts[2] +  # LST (already inverted)
                    0.20 * z_parts[3]    # SM
                )
                cdi_z_stress_pct = _z_to_stress_pct(cdi_z)
                stress_level_z = _stress_level_z(cdi_z)
            else:
                cdi_z = None
                cdi_z_stress_pct = None
                stress_level_z = None

            def varscore(v: str) -> VariableScore:
                reading = complete[district][v]
                z = z_scores[v][district]
                mean = baseline_means[v][district]
                std = baseline_stds[v][district]
                stress_pct = z_stress_pcts[v][district]
                
                return VariableScore(
                    raw=reading.value,
                    anomaly=z if z is not None else reading.value,  # Use Z if available, else raw
                    score=round(spatial_scores[v][district], 1),  # Model A spatial score
                    z_score=round(z, 3) if z is not None else None,
                    baseline_mean=round(mean, 4) if mean is not None else None,
                    baseline_std=round(std, 4) if std is not None else None,
                )

            records.append(CDIRecord(
                district=district,
                run_id=ctx.run_id,
                spi=varscore("spi"),
                ndvi=varscore("ndvi"),
                lst=varscore("lst"),
                sm=varscore("sm"),
                cdi=cdi_spatial,
                cdi_z=round(cdi_z, 3) if cdi_z is not None else None,
                cdi_z_stress_pct=round(cdi_z_stress_pct, 1) if cdi_z_stress_pct is not None else None,
                stress_level=config.stress_level(cdi_spatial),
                stress_level_z=stress_level_z,
            ))

        records.sort(key=lambda r: -r.cdi)  # hottest districts first (Model A)
        return StageResult(stage=self.name, ok=True, records=len(records),
                           errors=errors, artifact=records)
