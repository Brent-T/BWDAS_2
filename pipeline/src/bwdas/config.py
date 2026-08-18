"""BWDAS central configuration.

Every tunable for the drought-index pipeline lives here so that the four
ETL agents stay free of magic numbers. Values follow the World Bank / NDMC
Combined Drought Indicator (CDI) methodology validated for Botswana in 2018.

The CDI weights (40/20/20/20) are DELIBERATELY FIXED and non-negotiable.
Overriding them would undermine the credibility argument that BWDAS runs the
government's own endorsed approach. See BWDAS.MD -> "Key constraints #3".
"""

from __future__ import annotations

import os
from pathlib import Path

# --------------------------------------------------------------------------- #
# Project layout
# --------------------------------------------------------------------------- #
# pipeline/
#   src/bwdas/...      <- this package
#   data/              <- artifacts produced by the pipeline (git-ignored)
#   tests/...
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("BWDAS_DATA_DIR", PROJECT_ROOT / "data"))
RAW_DIR = DATA_DIR / "raw"
STANDARD_DIR = DATA_DIR / "standardized"
OUTPUT_DIR = DATA_DIR / "output"

# Canonical district table the PoC must cover (GADM Level 1, NAME_1).
DISTRICTS: tuple[str, ...] = (
    "Central",
    "Ghanzi",
    "Kgalagadi",
    "Kgatleng",
    "Kweneng",
    "North-East",
    "North-West",
    "South-East",
    "Southern",
)

# --------------------------------------------------------------------------- #
# Source datasets (all free, all served by Google Earth Engine)
# --------------------------------------------------------------------------- #
DATASETS = {
    # Standardised Precipitation Index driver — primary drought signal.
    "spi": {
        "gee_id": "UCSB-CHG/CHIRPS/DAILY",
        "band": "precipitation",
        "baseline": ("1981-01-01", "2025-12-31"),
        "weight": 0.40,
        "unit": "mm",
    },
    # Vegetation stress — crop & rangeland health.
    "ndvi": {
        "gee_id": "COPERNICUS/S2_SR_HARMONIZED",
        "band": "NDVI",
        "baseline": ("2017-01-01", "2024-12-31"),
        "weight": 0.20,
        "unit": "index",
    },
    # Land-surface temperature anomaly — heat stress on crops & livestock.
    "lst": {
        "gee_id": "MODIS/061/MOD11A1",
        "band": "LST_Day_1km",
        "baseline": ("2017-01-01", "2024-12-31"),
        "weight": 0.20,
        "unit": "celsius",
    },
    # Root-zone soil moisture — crop establishment capacity.
    "sm": {
        "gee_id": "NASA/SMAP/SPL3SMP_E/005",
        "band": "soil_moisture_am",
        "baseline": ("2015-01-01", "2024-12-31"),
        "weight": 0.20,
        "unit": "cm3/cm3",
    },
}

VARIABLES: tuple[str, ...] = ("spi", "ndvi", "lst", "sm")

# Sanity guard: the weights must always sum to 1.0.
assert abs(sum(DATASETS[v]["weight"] for v in VARIABLES) - 1.0) < 1e-9, (
    "CDI weights must sum to 1.0 — do not change the 40/20/20/20 split."
)

# --------------------------------------------------------------------------- #
# Analysis window (the current El Nino season is the priority)
# --------------------------------------------------------------------------- #
ANALYSIS_START = os.getenv("BWDAS_ANALYSIS_START", "2026-07-01")
ANALYSIS_END = os.getenv("BWDAS_ANALYSIS_END", "2026-08-15")

# --------------------------------------------------------------------------- #
# Classification & alerting
# --------------------------------------------------------------------------- #
# District stress classification (0-100 CDI scale).
STRESS_BANDS = (
    (0, 25, "Low"),
    (25, 50, "Moderate"),
    (50, 75, "High"),
    (75, 100, "Severe"),
)

# Thresholds at which the Feed agent raises an alert.
ALERT_THRESHOLDS = (
    (90, "EMERGENCY"),
    (75, "ACTION REQUIRED"),
    (50, "WATCH"),
)


def stress_level(cdi: float) -> str:
    """Map a 0-100 CDI score onto its classification band."""
    for low, high, label in STRESS_BANDS:
        if low <= cdi < high:
            return label
    return "Severe"  # cdi >= 100


def alert_level(cdi: float) -> str | None:
    """Return the alert tier for a CDI score, or None if no alert fires."""
    for threshold, label in ALERT_THRESHOLDS:
        if cdi >= threshold:
            return label
    return None
