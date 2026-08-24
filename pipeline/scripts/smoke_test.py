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
    ndvi_result = gateway.district_mean_anomaly(
        gee_id=config.DATASETS["ndvi"]["gee_id"],
        band=config.DATASETS["ndvi"]["band"],
        start=config.ANALYSIS_START,
        end=config.ANALYSIS_END,
        district="Kweneng",
        baseline_start=config.DATASETS["ndvi"]["baseline"][0],
        baseline_end=config.DATASETS["ndvi"]["baseline"][1],
        use_anomaly=True,
    )
    print(f"  NDVI: current={ndvi_result[0]:.4f}, anomaly={ndvi_result[1]:.4f}")
    assert ndvi_result is not None, "NDVI returned None"
    assert -1 <= ndvi_result[0] <= 1, f"NDVI out of bounds: {ndvi_result[0]}"

    print("Testing LST - Kweneng...")
    lst_result = gateway.district_mean_anomaly(
        gee_id=config.DATASETS["lst"]["gee_id"],
        band=config.DATASETS["lst"]["band"],
        start=config.ANALYSIS_START,
        end=config.ANALYSIS_END,
        district="Kweneng",
        baseline_start=config.DATASETS["lst"]["baseline"][0],
        baseline_end=config.DATASETS["lst"]["baseline"][1],
        use_anomaly=True,
    )
    print(f"  LST: current={lst_result[0]:.2f}C, anomaly={lst_result[1]:.2f}C")
    assert lst_result is not None, "LST returned None"
    assert 10 <= lst_result[0] <= 55, f"LST implausible: {lst_result[0]}"

    print("Testing SPI - Kweneng...")
    spi_result = gateway.district_mean_anomaly(
        gee_id=config.DATASETS["spi"]["gee_id"],
        band=config.DATASETS["spi"]["band"],
        start=config.ANALYSIS_START,
        end=config.ANALYSIS_END,
        district="Kweneng",
        baseline_start=config.DATASETS["spi"]["baseline"][0],
        baseline_end=config.DATASETS["spi"]["baseline"][1],
        use_anomaly=False,
    )
    print(f"  SPI: {spi_result[0]:.2f} mm")
    assert spi_result is not None, "SPI returned None"
    assert spi_result[0] >= 0, f"Negative precipitation: {spi_result[0]}"

    print("Testing SM - Kweneng...")
    sm_result = gateway.district_mean_anomaly(
        gee_id=config.DATASETS["sm"]["gee_id"],
        band=config.DATASETS["sm"]["band"],
        start=config.ANALYSIS_START,
        end=config.ANALYSIS_END,
        district="Kweneng",
        baseline_start=config.DATASETS["sm"]["baseline"][0],
        baseline_end=config.DATASETS["sm"]["baseline"][1],
        use_anomaly=False,
    )
    print(f"  SM: {sm_result[0]:.4f} cm3/cm3")
    assert sm_result is not None, "SM returned None"
    assert 0 <= sm_result[0] <= 1, f"SM out of bounds: {sm_result[0]}"

    print("\nAll smoke tests passed.")


if __name__ == "__main__":
    main()