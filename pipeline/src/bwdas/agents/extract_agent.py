"""EXTRACT — pull raw, district-reduced satellite observations from GEE.

Design notes (deliberate):
  * GEE is hidden behind the ``GEEGateway`` protocol. The real gateway imports
    ``ee`` lazily inside the call, so importing this module never requires
    Earth Engine to be installed or authenticated — which is what makes the
    test-suite runnable in CI with a fake gateway.
  * Extraction is per (district x variable). A single failed cell is logged
    and skipped, never fatal: one cloudy Sentinel-2 tile must not kill the
    whole national run. The missing cell is surfaced so Standardize can decide.
  * Historical baseline anomalies are computed ON GEE SERVERS to avoid local
    RAM constraints. Each variable compares current values against its own
    climatological baseline (e.g., NDVI 2017-2024, SPI 1981-2025) for the same
    calendar month, returning true anomalies rather than absolute values.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol, runtime_checkable

from .. import config
from ..models import RawDistrictReading
from .base import BaseAgent, PipelineContext, StageResult


@runtime_checkable
class GEEGateway(Protocol):
    """The ONLY surface through which the pipeline touches Google Earth Engine.

    Swap this for a fake in tests, or a cached/replay gateway for offline runs.
    """

    def district_mean_anomaly(
        self, gee_id: str, band: str, start: str, end: str, district: str,
        baseline_start: str, baseline_end: str, use_anomaly: bool
    ) -> tuple[float, float] | None:
        """Reduce an image collection over a district; returns (current_value, anomaly).
        
        If use_anomaly=False, returns (current_value, current_value) for backward compat.
        Returns None if no data available.
        """


class EarthEngineGateway:
    """Production gateway. ``ee`` is imported lazily on first use."""

    def __init__(self) -> None:
        self._ee = None

    def _ensure(self):
        if self._ee is None:
            import ee  # heavy / requires auth -> keep out of import path

            ee.Initialize(project=config.GEE_PROJECT)
            self._ee = ee
        return self._ee

    def district_mean_anomaly(self, gee_id, band, start, end, district,
                               baseline_start, baseline_end, use_anomaly):
        ee = self._ensure()
        districts = (
            ee.FeatureCollection("FAO/GAUL/2015/level1")
            .filter(ee.Filter.eq("ADM0_NAME", "Botswana"))
        )
        region = districts.filter(
            ee.Filter.eq(
                "ADM1_NAME",
                config.GEE_DISTRICT_NAMES.get(district, district),
            )
        ).geometry()

        # Parse target month from end date for baseline filtering
        target_date = end  # e.g., "2026-08-15"
        target_month = int(target_date.split("-")[1])

        # Fetch current period imagery
        current_collection = (
            ee.ImageCollection(gee_id)
            .filterDate(start, end)
            .filterBounds(region)
        )

        # Process based on variable type
        if gee_id == config.DATASETS["ndvi"]["gee_id"]:
            current_collection = current_collection.filter(
                ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", config.S2_CLOUD_THRESHOLD)
            )
            current_image = current_collection.map(
                lambda img: img.normalizedDifference(["B8", "B4"])
                .rename("NDVI")
            ).median()
            result_band = "NDVI"
        elif gee_id == config.DATASETS["lst"]["gee_id"]:
            current_image = current_collection.select("LST_Day_1km").map(
                lambda img: img.multiply(config.LST_SCALE_FACTOR)
                .subtract(config.KELVIN_TO_CELSIUS)
                .rename("LST_celsius")
            ).mean()
            result_band = "LST_celsius"
        else:
            current_image = current_collection.select(band).mean()
            result_band = band

        # Get current value
        current_reduced = current_image.reduceRegion(
            reducer=ee.Reducer.mean(), geometry=region, scale=5000,
            maxPixels=1e13, bestEffort=True,
        ).getInfo()
        current_value = current_reduced.get(result_band) if current_reduced else None
        
        if current_value is None:
            return None

        # If anomaly calculation disabled, return current value as both
        if not use_anomaly:
            return (float(current_value), float(current_value))

        # Fetch historical baseline for the SAME CALENDAR MONTH across baseline years
        baseline_collection = (
            ee.ImageCollection(gee_id)
            .filter(ee.Filter.calendarRange(target_month, target_month, 'month'))
            .filterDate(baseline_start, baseline_end)
            .filterBounds(region)
        )

        # Process baseline based on variable type
        if gee_id == config.DATASETS["ndvi"]["gee_id"]:
            baseline_collection = baseline_collection.filter(
                ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", config.S2_CLOUD_THRESHOLD)
            )
            baseline_image = baseline_collection.map(
                lambda img: img.normalizedDifference(["B8", "B4"])
                .rename("NDVI")
            ).mean()
            baseline_band = "NDVI"
        elif gee_id == config.DATASETS["lst"]["gee_id"]:
            baseline_image = baseline_collection.select("LST_Day_1km").map(
                lambda img: img.multiply(config.LST_SCALE_FACTOR)
                .subtract(config.KELVIN_TO_CELSIUS)
                .rename("LST_celsius")
            ).mean()
            baseline_band = "LST_celsius"
        else:
            baseline_image = baseline_collection.select(band).mean()
            baseline_band = band

        # Get baseline mean
        baseline_reduced = baseline_image.reduceRegion(
            reducer=ee.Reducer.mean(), geometry=region, scale=5000,
            maxPixels=1e13, bestEffort=True,
        ).getInfo()
        baseline_value = baseline_reduced.get(baseline_band) if baseline_reduced else None

        if baseline_value is None:
            return (float(current_value), float(current_value))

        # Compute anomaly: current - baseline
        anomaly = float(current_value) - float(baseline_value)
        return (float(current_value), anomaly)


class ExtractAgent(BaseAgent):
    name = "extract"
    consumes: tuple[str, ...] = ()
    produces = "raw_readings"

    def __init__(self, gateway: GEEGateway) -> None:
        self.gateway = gateway

    def run(self, ctx: PipelineContext) -> StageResult:
        readings: list[RawDistrictReading] = []
        errors: list[str] = []

        for variable in config.VARIABLES:
            spec = config.DATASETS[variable]
            baseline_start, baseline_end = spec["baseline"]
            
            # Enable anomaly calculation for NDVI and LST (variables with strong seasonal baselines)
            # SPI and SM use cross-sectional scaling due to their nature
            use_anomaly = variable in ("ndvi", "lst")
            
            for district in config.DISTRICTS:
                try:
                    result = self.gateway.district_mean_anomaly(
                        gee_id=spec["gee_id"],
                        band=spec["band"],
                        start=config.ANALYSIS_START,
                        end=config.ANALYSIS_END,
                        district=district,
                        baseline_start=baseline_start,
                        baseline_end=baseline_end,
                        use_anomaly=use_anomaly,
                    )
                except Exception as exc:  # noqa: BLE001 — per-cell isolation
                    errors.append(f"{variable}/{district}: {exc}")
                    continue
                    
                if result is None:
                    errors.append(f"{variable}/{district}: no data in window")
                    continue
                    
                current_value, anomaly = result
                
                # For anomaly-based variables, store the anomaly as the value for standardization
                # For non-anomaly variables, store the raw value
                value_for_scoring = anomaly if use_anomaly else current_value
                
                readings.append(
                    RawDistrictReading(
                        district=district,
                        variable=variable,
                        date=config.ANALYSIS_END,
                        value=value_for_scoring,
                        source=spec["gee_id"],
                        unit=spec["unit"],
                    )
                )

        # Persist the raw artifact for provenance & replay.
        config.RAW_DIR.mkdir(parents=True, exist_ok=True)
        artifact = config.RAW_DIR / f"raw_{ctx.run_id}.json"
        artifact.write_text(
            json.dumps([r.model_dump() for r in readings], indent=2)
        )
        ctx.artifacts["raw_readings"] = readings

        return StageResult(
            stage=self.name,
            ok=True,  # extraction degrades, it does not abort
            records=len(readings),
            errors=errors,
            artifact=str(artifact),
        )
