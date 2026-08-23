"""Unit tests for the Standardize agent — the CDI math is the core IP, so it is
pinned down hard here: normalisation direction, weights, classification and
the missing-data policy."""

import pytest

from bwdas import config
from bwdas.agents.base import PipelineContext
from bwdas.agents.standardize_agent import StandardizeAgent, _normalise
from bwdas.models import RawDistrictReading


def _reading(district, variable, value):
    return RawDistrictReading(
        district=district, variable=variable, date="2026-08-15",
        value=value, source="test", unit="x",
    )


def _ctx(readings):
    ctx = PipelineContext(run_id="test-run")
    ctx.artifacts["raw_readings"] = readings
    return ctx


def test_normalise_maps_min_to_0_max_to_100():
    assert _normalise([1.0, 2.0, 3.0], invert=False) == [0.0, 50.0, 100.0]


def test_normalise_inverts_for_low_means_stress():
    # For SPI/NDVI/SM a LOW value is stressed, so the min should score 100.
    assert _normalise([1.0, 2.0, 3.0], invert=True) == [100.0, 50.0, 0.0]


def test_normalise_flat_field_is_neutral():
    assert _normalise([5.0, 5.0, 5.0], invert=False) == [50.0, 50.0, 50.0]


def test_weights_are_the_world_bank_40_20_20_20():
    w = {v: config.DATASETS[v]["weight"] for v in config.VARIABLES}
    assert w == {"spi": 0.40, "ndvi": 0.20, "lst": 0.20, "sm": 0.20}
    assert abs(sum(w.values()) - 1.0) < 1e-9


def test_uniform_stress_yields_cdi_50():
    # If every district is identical on every variable, every normalised
    # score is 50, so CDI must be exactly 50 regardless of the weights.
    districts = ["Kweneng", "Central", "Ghanzi"]
    readings = [
        _reading(d, v, 1.0)
        for d in districts
        for v in config.VARIABLES
    ]
    result = StandardizeAgent().execute(_ctx(readings))
    assert result.ok
    records = result.artifact
    assert len(records) == 3
    assert all(r.cdi == 50.0 for r in records)
    assert all(r.stress_level == "Moderate" for r in records)


def test_district_missing_a_variable_is_dropped_not_imputed():
    readings = [_reading("Kweneng", v, 1.0) for v in config.VARIABLES]
    readings += [_reading("Central", "spi", 1.0)]  # Central is incomplete
    result = StandardizeAgent().execute(_ctx(readings))
    assert result.ok
    assert [r.district for r in result.artifact] == ["Kweneng"]
    assert any("Central" in e and "dropped" in e for e in result.errors)


def test_no_complete_districts_fails_the_stage():
    readings = [_reading("Kweneng", "spi", 1.0)]
    result = StandardizeAgent().execute(_ctx(readings))
    assert not result.ok
    assert result.records == 0


def test_highest_cdi_district_sorted_first_and_classified_severe():
    districts = config.DISTRICTS
    readings = []
    for i, d in enumerate(districts):
        # Kweneng (index 4) gets the most stressed profile.
        stressed = d == "Kweneng"
        readings += [
            _reading(d, "spi", 0.0 if stressed else 10.0 + i),   # low rain = stress
            _reading(d, "ndvi", 0.1 if stressed else 0.8 - i * 0.01),
            _reading(d, "lst", 45.0 if stressed else 25.0 + i),  # high temp = stress
            _reading(d, "sm", 0.05 if stressed else 0.3 - i * 0.01),
        ]
    result = StandardizeAgent().execute(_ctx(readings))
    assert result.ok
    records = result.artifact
    assert records[0].district == "Kweneng"
    assert records[0].cdi == max(r.cdi for r in records)
    assert records[0].stress_level == config.stress_level(records[0].cdi)


def test_cdi_is_clamped_to_0_100():
    districts = ["Kweneng", "Central", "Ghanzi"]
    readings = [_reading(d, v, float(i)) for i, d in enumerate(districts)
                for v in config.VARIABLES]
    result = StandardizeAgent().execute(_ctx(readings))
    assert all(0.0 <= r.cdi <= 100.0 for r in result.artifact)
