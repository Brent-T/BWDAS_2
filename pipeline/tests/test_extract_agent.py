"""Unit tests for the Extract agent using a FAKE gateway.

The whole point of the GEEGateway seam: these tests exercise the real
ExtractAgent logic — per-cell isolation, provenance, artifact persistence —
without ever importing earthengine-api or needing credentials.
"""

import json

import pytest

from bwdas import config
from bwdas.agents.extract_agent import ExtractAgent, EarthEngineGateway
from bwdas.agents.base import PipelineContext


class FakeGateway:
    """Deterministic stand-in for Google Earth Engine."""

    def __init__(self, values=None, fail=None):
        self.values = values or {}
        self.fail = fail or set()
        self.calls = []

    def district_mean_anomaly(self, gee_id, band, start, end, district,
                               baseline_start, baseline_end, use_anomaly):
        key = (gee_id, district)
        self.calls.append(key)
        if key in self.fail:
            raise RuntimeError("simulated GEE timeout")
        value = self.values.get(key)
        if value is None:
            return None
        # Return (current_value, anomaly) tuple
        if use_anomaly:
            # For anomaly mode, return a simulated anomaly (e.g., 10% of value)
            return (value, value * 0.1)
        return (value, value)


class FakeImage:
    def __init__(self, calls):
        self.calls = calls

    def normalizedDifference(self, bands):
        self.calls.append(("normalizedDifference", bands))
        return self

    def multiply(self, factor):
        self.calls.append(("multiply", factor))
        return self

    def subtract(self, value):
        self.calls.append(("subtract", value))
        return self

    def rename(self, band):
        self.calls.append(("rename", band))
        return self

    def reduceRegion(self, **kwargs):
        self.calls.append(("reduceRegion", kwargs))
        return self

    def getInfo(self):
        return {"NDVI": 0.2, "LST_celsius": 26.85}


class FakeCollection:
    def __init__(self, calls):
        self.calls = calls
        self.image = FakeImage(calls)

    def filterDate(self, start, end):
        self.calls.append(("filterDate", start, end))
        return self

    def filterBounds(self, region):
        self.calls.append(("filterBounds", region))
        return self

    def geometry(self):
        self.calls.append(("geometry",))
        return self

    def filter(self, expression):
        self.calls.append(("filter", expression))
        return self

    def select(self, band):
        self.calls.append(("select", band))
        return self

    def map(self, callback):
        callback(self.image)
        self.calls.append(("map",))
        return self

    def median(self):
        self.calls.append(("median",))
        return self.image

    def mean(self):
        self.calls.append(("mean",))
        return self.image


class FakeEarthEngine:
    class Filter:
        @staticmethod
        def eq(field, value):
            return ("eq", field, value)

        @staticmethod
        def lt(field, value):
            return ("lt", field, value)

        @staticmethod
        def calendarRange(start, end, unit):
            return ("calendarRange", start, end, unit)

    class Reducer:
        @staticmethod
        def mean():
            return "mean-reducer"

    def __init__(self):
        self.calls = []
        self.collection = FakeCollection(self.calls)

    def FeatureCollection(self, dataset):
        self.calls.append(("FeatureCollection", dataset))
        return self.collection

    def ImageCollection(self, dataset):
        self.calls.append(("ImageCollection", dataset))
        return self.collection


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


def test_smap_uses_current_level_four_rootzone_product():
    assert config.DATASETS["sm"]["gee_id"] == "NASA/SMAP/SPL4SMGP/008"
    assert config.DATASETS["sm"]["band"] == "sm_rootzone"


def test_legacy_bwdas_district_labels_map_to_gaul_names():
    assert config.GEE_DISTRICT_NAMES == {
        "North-East": "North East",
        "North-West": "Ngamiland",
    }


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


def test_lst_scale_conversion_matches_modis_metadata():
    raw_kelvin_scaled = 15000
    celsius = raw_kelvin_scaled * config.LST_SCALE_FACTOR - config.KELVIN_TO_CELSIUS
    assert celsius == pytest.approx(26.85)


def test_gateway_keeps_earth_engine_lazy():
    gateway = EarthEngineGateway()
    assert gateway._ee is None


def test_gateway_derives_ndvi_with_gaul_geometry_and_cloud_filter():
    ee = FakeEarthEngine()
    gateway = EarthEngineGateway()
    gateway._ee = ee

    result = gateway.district_mean_anomaly(
        config.DATASETS["ndvi"]["gee_id"], "NDVI", "2026-07-01", "2026-08-15", "Kweneng",
        "2017-01-01", "2024-12-31", use_anomaly=True
    )

    assert result is not None
    current_value, anomaly = result
    assert current_value == pytest.approx(0.2)
    assert ("FeatureCollection", "FAO/GAUL/2015/level1") in ee.calls
    assert ("normalizedDifference", ["B8", "B4"]) in ee.calls
    assert ("filter", ("lt", "CLOUDY_PIXEL_PERCENTAGE", config.S2_CLOUD_THRESHOLD)) in ee.calls
    assert ("median",) in ee.calls


def test_gateway_converts_lst_before_reduction():
    ee = FakeEarthEngine()
    gateway = EarthEngineGateway()
    gateway._ee = ee

    result = gateway.district_mean_anomaly(
        config.DATASETS["lst"]["gee_id"], "LST_celsius", "2026-07-01", "2026-08-15", "Kweneng",
        "2017-01-01", "2024-12-31", use_anomaly=False
    )

    assert result is not None
    current_value, _ = result
    assert current_value == pytest.approx(26.85)
    assert ("multiply", config.LST_SCALE_FACTOR) in ee.calls
    assert ("subtract", config.KELVIN_TO_CELSIUS) in ee.calls
    assert ee.calls.index(("multiply", config.LST_SCALE_FACTOR)) < ee.calls.index(
        ("subtract", config.KELVIN_TO_CELSIUS)
    )
