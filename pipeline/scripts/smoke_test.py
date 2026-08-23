"""Live Earth Engine smoke test for one Botswana district."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from bwdas import config
from bwdas.agents.extract_agent import EarthEngineGateway


def main() -> None:
    gateway = EarthEngineGateway()

    print("Testing NDVI - Kweneng...")
    ndvi = gateway.district_mean(
        gee_id=config.DATASETS["ndvi"]["gee_id"],
        band=config.DATASETS["ndvi"]["band"],
        start=config.ANALYSIS_START,
        end=config.ANALYSIS_END,
        district="Kweneng",
    )
    print(f"  NDVI: {ndvi}")
    assert ndvi is not None, "NDVI returned None"
    assert -1 <= ndvi <= 1, f"NDVI out of bounds: {ndvi}"

    print("Testing LST - Kweneng...")
    lst = gateway.district_mean(
        gee_id=config.DATASETS["lst"]["gee_id"],
        band=config.DATASETS["lst"]["band"],
        start=config.ANALYSIS_START,
        end=config.ANALYSIS_END,
        district="Kweneng",
    )
    print(f"  LST: {lst} C")
    assert lst is not None, "LST returned None"
    assert 10 <= lst <= 55, f"LST implausible for Botswana: {lst}"

    print("Testing SPI - Kweneng...")
    spi = gateway.district_mean(
        gee_id=config.DATASETS["spi"]["gee_id"],
        band=config.DATASETS["spi"]["band"],
        start=config.ANALYSIS_START,
        end=config.ANALYSIS_END,
        district="Kweneng",
    )
    print(f"  SPI (precipitation mm): {spi}")
    assert spi is not None, "SPI returned None"
    assert spi >= 0, f"Negative precipitation: {spi}"

    print("Testing SM - Kweneng...")
    sm = gateway.district_mean(
        gee_id=config.DATASETS["sm"]["gee_id"],
        band=config.DATASETS["sm"]["band"],
        start=config.ANALYSIS_START,
        end=config.ANALYSIS_END,
        district="Kweneng",
    )
    print(f"  SM: {sm} cm3/cm3")
    assert sm is not None, "SM returned None"
    assert 0 <= sm <= 1, f"SM out of bounds: {sm}"

    print("\nAll smoke tests passed. Gateway is producing valid readings.")


if __name__ == "__main__":
    main()
