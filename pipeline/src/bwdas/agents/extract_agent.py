"""EXTRACT — pull raw, district-reduced satellite observations from GEE.

Design notes (deliberate):
  * GEE is hidden behind the ``GEEGateway`` protocol. The real gateway imports
    ``ee`` lazily inside the call, so importing this module never requires
    Earth Engine to be installed or authenticated — which is what makes the
    test-suite runnable in CI with a fake gateway.
  * Extraction is per (district x variable). A single failed cell is logged
    and skipped, never fatal: one cloudy Sentinel-2 tile must not kill the
    whole national run. The missing cell is surfaced so Standardize can decide.
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

    def district_mean(
        self, gee_id: str, band: str, start: str, end: str, district: str
    ) -> float | None:
        """Reduce an image collection over a district; None if no data."""


class EarthEngineGateway:
    """Production gateway. ``ee`` is imported lazily on first use."""

    def __init__(self) -> None:
        self._ee = None

    def _ensure(self):
        if self._ee is None:
            import ee  # heavy / requires auth -> keep out of import path

            ee.Initialize()
            self._ee = ee
        return self._ee

    def district_mean(self, gee_id, band, start, end, district):
        ee = self._ensure()
        botswana = (
            ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
            .filter(ee.Filter.eq("country_na", "Botswana"))
        )
        region = botswana.filter(
            ee.Filter.regex("system:index", district.replace("-", " "))
        ).geometry()
        image = (
            ee.ImageCollection(gee_id)
            .filterDate(start, end)
            .filterBounds(region)
            .select(band)
            .mean()
        )
        reduced = image.reduceRegion(
            reducer=ee.Reducer.mean(), geometry=region, scale=5000,
            maxPixels=1e13, bestEffort=True,
        ).getInfo()
        value = reduced.get(band) if reduced else None
        return float(value) if value is not None else None


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
            for district in config.DISTRICTS:
                try:
                    value = self.gateway.district_mean(
                        gee_id=spec["gee_id"],
                        band=spec["band"],
                        start=config.ANALYSIS_START,
                        end=config.ANALYSIS_END,
                        district=district,
                    )
                except Exception as exc:  # noqa: BLE001 — per-cell isolation
                    errors.append(f"{variable}/{district}: {exc}")
                    continue
                if value is None:
                    errors.append(f"{variable}/{district}: no data in window")
                    continue
                readings.append(
                    RawDistrictReading(
                        district=district,
                        variable=variable,
                        date=config.ANALYSIS_END,
                        value=value,
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

        return StageResult(
            stage=self.name,
            ok=True,  # extraction degrades, it does not abort
            records=len(readings),
            errors=errors,
            artifact=str(artifact),
        )
