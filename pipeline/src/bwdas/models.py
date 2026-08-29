"""Pydantic data models — the single source of truth for row shapes.

These models ARE the standardisation contract. Every agent produces and/or
consumes one of these, so a malformed row fails loudly at the boundary
instead of silently corrupting the master district table.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class RawDistrictReading(BaseModel):
    """One satellite observation reduced to a single district value.

    Produced by the Extract agent. Deliberately thin: it carries no
    interpretation, only what the source said, when, for which district.
    """

    district: str
    variable: str  # one of config.VARIABLES
    date: str  # ISO date of the observation window end
    value: float
    source: str  # GEE dataset id, for provenance
    unit: str

    @field_validator("value")
    @classmethod
    def _value_finite(cls, v: float) -> float:
        if v != v or v in (float("inf"), float("-inf")):  # NaN / inf guard
            raise ValueError("satellite value must be finite")
        return v


class VariableScore(BaseModel):
    """A single variable's anomaly plus its 0-100 normalised stress score."""

    raw: float  # observed value
    anomaly: float  # deviation from the climatological baseline (Z-score for Model C)
    anomaly_pct: Optional[float] = None  # percent form where meaningful
    score: float = Field(ge=0, le=100)  # 0 = no stress, 100 = max stress (Model A spatial)
    z_score: Optional[float] = None  # Model C: standardized anomaly (unitless)
    baseline_mean: Optional[float] = None  # Model C: historical mean for this period
    baseline_std: Optional[float] = None  # Model C: historical std dev for this period


class CDIRecord(BaseModel):
    """The fully standardised, weighted drought record for one district.

    Produced by the Standardize agent, persisted by the Load agent and
    evaluated by the Feed agent. This is the atomic unit of the pipeline.
    
    Contains BOTH Model A (spatial min-max) and Model C (climatological Z-score)
    metrics for dual-purpose reporting: regional ranking AND scientific early-warning.
    """

    district: str
    run_id: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    spi: VariableScore
    ndvi: VariableScore
    lst: VariableScore
    sm: VariableScore
    cdi: float = Field(ge=0, le=100)  # Model A: spatial min-max CDI (0-100)
    cdi_z: Optional[float] = None  # Model C: climatological Z-score CDI (typically -4 to +4)
    cdi_z_stress_pct: Optional[float] = None  # Model C: mapped to 0-100% stress scale
    stress_level: str  # Model A classification
    stress_level_z: Optional[str] = None  # Model C classification based on Z-CDI

    @field_validator("district")
    @classmethod
    def _district_known(cls, v: str) -> str:
        # Late import avoids a circular dependency with config at import time.
        from .config import DISTRICTS

        if v not in DISTRICTS:
            raise ValueError(f"unknown district {v!r}; expected one of {DISTRICTS}")
        return v
