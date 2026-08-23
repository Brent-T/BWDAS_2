"""Unit tests for the Feed agent — threshold tiers and advisory formatting."""

import pytest

from bwdas import config
from bwdas.agents.base import PipelineContext
from bwdas.agents.feed_agent import FeedAgent, format_advisory
from bwdas.models import CDIRecord, VariableScore


def _record(district, cdi):
    def vs(score):
        return VariableScore(raw=score, anomaly=score, score=score)
    return CDIRecord(
        district=district, run_id="t",
        spi=vs(cdi), ndvi=vs(cdi), lst=vs(cdi), sm=vs(cdi),
        cdi=cdi, stress_level=config.stress_level(cdi),
    )


@pytest.fixture
def out_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "OUTPUT_DIR", tmp_path / "out")
    return config.OUTPUT_DIR


def _ctx(records):
    ctx = PipelineContext(run_id="t")
    ctx.artifacts["cdi_records"] = records
    return ctx


def test_alert_tiers_match_spec():
    assert config.alert_level(95) == "EMERGENCY"
    assert config.alert_level(90) == "EMERGENCY"
    assert config.alert_level(80) == "ACTION REQUIRED"
    assert config.alert_level(75) == "ACTION REQUIRED"
    assert config.alert_level(60) == "WATCH"
    assert config.alert_level(50) == "WATCH"
    assert config.alert_level(49.9) is None


def test_only_districts_at_or_above_50_fire(out_dir):
    records = [_record("Kweneng", 91), _record("Central", 76),
               _record("Ghanzi", 55), _record("Southern", 30)]
    result = FeedAgent().execute(_ctx(records))
    assert result.ok
    assert result.records == 3, "Southern (30) must not alert"


def test_feed_writes_every_alert_to_the_artifact(out_dir):
    records = [_record("Kweneng", 91), _record("Ghanzi", 55)]
    result = FeedAgent().execute(_ctx(records))
    text = open(result.artifact).read()
    assert "[EMERGENCY] Kweneng" in text
    assert "[WATCH] Ghanzi" in text


def test_advisory_uses_plain_language_kweneng_format():
    message = format_advisory(_record("Kweneng", 74), "WATCH")
    assert "Kweneng district" in message
    assert "CDI: 74/100" in message
    assert "BWDAS" in message


def test_no_alerts_still_produces_empty_feed(out_dir):
    result = FeedAgent().execute(_ctx([_record("Southern", 10)]))
    assert result.ok
    assert result.records == 0
