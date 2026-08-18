"""Unit tests for the Extract agent using a FAKE gateway.

The whole point of the GEEGateway seam: these tests exercise the real
ExtractAgent logic — per-cell isolation, provenance, artifact persistence —
without ever importing earthengine-api or needing credentials.
"""

import json

import pytest

from bwdas import config
from bwdas.agents.extract_agent import ExtractAgent
from bwdas.agents.base import PipelineContext


class FakeGateway:
    """Deterministic stand-in for Google Earth Engine."""

    def __init__(self, values=None, fail=None):
        self.values = values or {}
        self.fail = fail or set()
        self.calls = []

    def district_mean(self, gee_id, band, start, end, district):
        key = (gee_id, district)
        self.calls.append(key)
        if key in self.fail:
            raise RuntimeError("simulated GEE timeout")
        return self.values.get(key)


@pytest.fixture
def raw_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "RAW_DIR", tmp_path / "raw")
    return config.RAW_DIR


def test_full_matrix_produces_districts_x_variables_readings(raw_dir):
    values = {
        (config.DATASETS[v]["gee_id"], d): 1.0
        for v in config.VARIABLES
        for d in config.DISTRICTS
    }
    agent = ExtractAgent(FakeGateway(values=values))
    result = agent.execute(PipelineContext(run_id="t1"))
    assert result.ok
    assert result.records == len(config.DISTRICTS) * len(config.VARIABLES)
    assert result.errors == []


def test_missing_cell_is_skipped_not_fatal(raw_dir):
    gw = FakeGateway(values={
        (config.DATASETS["spi"]["gee_id"], "Kweneng"): 12.0,
    })
    result = ExtractAgent(gw).execute(PipelineContext(run_id="t2"))
    assert result.ok, "extraction must degrade, not abort"
    assert result.records == 1
    assert len(result.errors) == len(config.DISTRICTS) * len(config.VARIABLES) - 1


def test_gateway_exception_is_isolated_to_one_cell(raw_dir):
    values = {
        (config.DATASETS["spi"]["gee_id"], d): 5.0 for d in config.DISTRICTS
    }
    gw = FakeGateway(values=values,
                     fail={(config.DATASETS["spi"]["gee_id"], "Ghanzi")})
    result = ExtractAgent(gw).execute(PipelineContext(run_id="t3"))
    assert result.ok
    assert result.records == len(config.DISTRICTS) - 1
    assert any("Ghanzi" in e for e in result.errors)


def test_raw_artifact_is_valid_json_with_provenance(raw_dir):
    values = {(config.DATASETS["spi"]["gee_id"], "Kweneng"): 3.5}
    agent = ExtractAgent(FakeGateway(values=values))
    result = agent.execute(PipelineContext(run_id="t4"))
    payload = json.loads(open(result.artifact).read())
    assert payload[0]["district"] == "Kweneng"
    assert payload[0]["source"] == "UCSB-CHG/CHIRPS/DAILY"
    assert payload[0]["value"] == 3.5
