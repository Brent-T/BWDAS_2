"""Unit tests for the Load agent — atomicity, schema and idempotency."""

import csv

import pytest

from bwdas import config
from bwdas.agents.base import PipelineContext
from bwdas.agents.load_agent import COLUMNS, LoadAgent
from bwdas.models import CDIRecord, VariableScore


def _record(district, cdi, run_id="t"):
    def vs(score):
        return VariableScore(raw=score, anomaly=score, score=score)
    return CDIRecord(
        district=district, run_id=run_id,
        spi=vs(cdi), ndvi=vs(cdi), lst=vs(cdi), sm=vs(cdi),
        cdi=cdi, stress_level=config.stress_level(cdi),
    )


@pytest.fixture
def dirs(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "OUTPUT_DIR", tmp_path / "out")
    monkeypatch.setattr(config, "STANDARD_DIR", tmp_path / "std")
    return tmp_path


def _ctx(records, run_id="t"):
    ctx = PipelineContext(run_id=run_id)
    ctx.artifacts["cdi_records"] = records
    return ctx


def test_load_writes_master_with_expected_columns(dirs):
    records = [_record("Kweneng", 74.0), _record("Central", 30.0)]
    result = LoadAgent().execute(_ctx(records))
    assert result.ok
    with open(result.artifact) as fh:
        rows = list(csv.DictReader(fh))
    assert [r["district"] for r in rows] == ["Kweneng", "Central"]
    assert list(rows[0].keys()) == COLUMNS


def test_load_also_writes_an_immutable_snapshot(dirs):
    result = LoadAgent().execute(_ctx([_record("Ghanzi", 55.0)], run_id="r42"))
    snapshot = config.STANDARD_DIR / "cdi_r42.csv"
    assert snapshot.exists(), "per-run snapshot is the ground-truth archive"
    assert result.artifact.endswith("master_district.csv")


def test_load_is_idempotent_for_same_run_id(dirs):
    records = [_record("Kweneng", 74.0)]
    first = LoadAgent().execute(_ctx(records, run_id="same"))
    second = LoadAgent().execute(_ctx(records, run_id="same"))
    assert first.artifact == second.artifact
    assert open(first.artifact).read() == open(second.artifact).read()


def test_load_with_no_records_fails_loudly(dirs):
    result = LoadAgent().execute(_ctx([]))
    assert not result.ok


def test_no_tmp_file_is_left_behind(dirs):
    LoadAgent().execute(_ctx([_record("Kweneng", 74.0)]))
    leftovers = list(config.OUTPUT_DIR.glob("*.tmp"))
    assert leftovers == [], "atomic write must not leak temp files"
