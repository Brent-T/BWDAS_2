"""End-to-end test: wire all four agents with a FAKE gateway and assert the
full Extract -> Standardize -> Load -> Feed contract holds. This is the test
that earns the modular architecture its keep — stages compose through the
context without importing each other."""

import csv

from bwdas import config
from bwdas.agents.base import PipelineContext
from bwdas.agents.extract_agent import ExtractAgent
from bwdas.agents.feed_agent import FeedAgent
from bwdas.agents.load_agent import LoadAgent
from bwdas.agents.standardize_agent import StandardizeAgent


class SeededGateway:
    """Returns a deterministic per-(variable, district) value with anomaly support."""

    def district_mean_anomaly(
        self, gee_id, band, start, end, district,
        baseline_start, baseline_end, use_anomaly
    ):
        # A stable pseudo-reading derived from the names; never None here so
        # every district is complete.
        base_value = float((len(gee_id) + len(district)) % 17)
        
        if use_anomaly:
            # For anomaly-based variables (NDVI, LST), return a small anomaly
            # to ensure variation across districts for proper scaling
            anomaly = (float(len(district)) % 5) - 2.0  # Range: -2.0 to +2.0
            return (base_value, anomaly)
        else:
            # For non-anomaly variables (SPI, SM), return same value for both
            return (base_value, base_value)


def test_full_chain_produces_master_and_alerts(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "RAW_DIR", tmp_path / "raw")
    monkeypatch.setattr(config, "STANDARD_DIR", tmp_path / "std")
    monkeypatch.setattr(config, "OUTPUT_DIR", tmp_path / "out")

    ctx = PipelineContext(run_id="e2e")
    stages = [
        ExtractAgent(SeededGateway()),
        StandardizeAgent(),
        LoadAgent(),
        FeedAgent(),
    ]
    results = []
    for stage in stages:
        result = stage.execute(ctx)
        result.raise_if_failed()
        results.append(result)

    # Every district scored once, and artifacts chained correctly.
    assert results[0].records == len(config.DISTRICTS) * len(config.VARIABLES)
    assert results[1].records == len(config.DISTRICTS)
    assert results[2].records == len(config.DISTRICTS)

    master = tmp_path / "out" / "master_district.csv"
    rows = list(csv.DictReader(open(master)))
    assert len(rows) == len(config.DISTRICTS)
    assert all(0.0 <= float(r["cdi"]) <= 100.0 for r in rows)

    # Hand-off keys were published to the context by each producer.
    assert "raw_readings" in ctx.artifacts
    assert "cdi_records" in ctx.artifacts
    assert "master_csv" in ctx.artifacts
