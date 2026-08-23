
---

# Implementation Report: NDVI and LST Gateway Update

**Date:** 2026-08-23  
**Repository:** `BWDAS_2/pipeline`  
**Scope:** Gateway derivation and conversion fixes, with offline regression coverage

## 1. Request That Was Implemented

The last prompt refined the original implementation plan with these constraints:

- Fix `EarthEngineGateway.district_mean()` first.
- Use `FAO/GAUL/2015/level1` for Botswana district geometry.
- Match districts using `ADM1_NAME`.
- Derive Sentinel-2 NDVI from bands B8 and B4.
- Use `COPERNICUS/S2_SR_HARMONIZED`.
- Filter Sentinel-2 scenes by cloud percentage.
- Convert MODIS LST from scaled Kelvin to Celsius.
- Keep the PoC reduction scale at 5,000 metres.
- Do not run the quota-heavy 2017-2024 baseline loop yet.
- Do not change CDI scoring from cross-district min-max normalization to temporal anomalies in this patch.
- Use the active SMAP Level 4 Version 8 collection with the root-zone band.

## 2. Files Changed

### `pipeline/src/bwdas/agents/extract_agent.py`

`EarthEngineGateway.district_mean()` was changed from a generic `select(band)` implementation to dataset-aware collection processing.

#### District geometry

The old implementation used the Botswana boundary dataset and a regular expression against `system:index`:

```python
ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
   .filter(ee.Filter.eq("country_na", "Botswana"))
```

That was replaced with the GAUL Level 1 administrative dataset:

```python
districts = (
   ee.FeatureCollection("FAO/GAUL/2015/level1")
   .filter(ee.Filter.eq("ADM0_NAME", "Botswana"))
)
region = districts.filter(
   ee.Filter.eq("ADM1_NAME", district)
).geometry()
```

This makes the district lookup explicit and aligns it with the district names in `config.DISTRICTS`, including names such as `North-East` and `North-West`.

#### Shared collection filtering

All datasets now share the same initial collection setup:

```python
collection = (
   ee.ImageCollection(gee_id)
   .filterDate(start, end)
   .filterBounds(region)
)
```

The GEE end date remains exclusive, as required by Earth Engine's `filterDate` behavior.

#### Sentinel-2 NDVI derivation

For the Sentinel-2 Harmonized dataset, the gateway now:

1. Applies `CLOUDY_PIXEL_PERCENTAGE < 20`.
2. Computes NDVI for each image using B8 first and B4 second.
3. Renames the derived image to the requested output band.
4. Builds a median composite.

```python
collection = collection.filter(
   ee.Filter.lt(
      "CLOUDY_PIXEL_PERCENTAGE",
      config.S2_CLOUD_THRESHOLD,
   )
)
image = collection.map(
   lambda img: img.normalizedDifference(["B8", "B4"])
   .rename(band)
).median()
```

This fixes the original blocker where the gateway attempted to select a non-existent raw `NDVI` band from Sentinel-2.

#### MODIS LST conversion

For MODIS `LST_Day_1km`, the gateway now:

1. Selects the raw MODIS band.
2. Applies the MODIS scale factor `0.02`.
3. Converts Kelvin to Celsius by subtracting `273.15`.
4. Renames the result to the requested output band.
5. Builds a mean composite.

```python
image = collection.select("LST_Day_1km").map(
   lambda img: img.multiply(config.LST_SCALE_FACTOR)
   .subtract(config.KELVIN_TO_CELSIUS)
   .rename(band)
).mean()
```

The resulting conversion is:

$$LST_{Celsius} = (LST_{raw} \times 0.02) - 273.15$$

For example, a raw value of `15000` becomes `26.85` degrees Celsius.

#### Other datasets

Datasets that are not Sentinel-2 or MODIS continue through the generic path:

```python
image = collection.select(band).mean()
```

This preserves the existing CHIRPS and SMAP behavior.

#### Reduction behavior

The final reduction remains unchanged in intent:

```python
reduced = image.reduceRegion(
   reducer=ee.Reducer.mean(),
   geometry=region,
   scale=5000,
   maxPixels=1e13,
   bestEffort=True,
).getInfo()
```

The gateway still returns a single district mean or `None` when no value is available. `ExtractAgent` still isolates failures per district and variable.

### `pipeline/src/bwdas/config.py`

Three transformation settings were added:

```python
S2_CLOUD_THRESHOLD = float(
   os.getenv("BWDAS_S2_CLOUD_THRESHOLD", "20")
)
LST_SCALE_FACTOR = 0.02
KELVIN_TO_CELSIUS = 273.15
```

#### Why these settings exist

- `S2_CLOUD_THRESHOLD` can be adjusted without editing gateway logic.
- `LST_SCALE_FACTOR` documents the MODIS product metadata in one place.
- `KELVIN_TO_CELSIUS` makes the unit conversion explicit and testable.

The existing dataset definitions remain intact:

- NDVI source: `COPERNICUS/S2_SR_HARMONIZED`
- NDVI output unit: `index`
- LST source: `MODIS/061/MOD11A1`
- LST output unit: `celsius`
- SMAP source: `NASA/SMAP/SPL4SMGP/008`
- SMAP band: `sm_rootzone`
- CDI weights: unchanged at 40/20/20/20

The previous SMAP source, `NASA/SMAP/SPL3SMP_E/005` with
`soil_moisture_am`, returned no images for the 2026 analysis window. The
configuration now uses the Level 4 Version 8 root-zone product.

### GAUL district-name compatibility

The GAUL catalog uses `North East` and `Ngamiland`, while BWDAS's canonical
labels are `North-East` and `North-West`. `config.GEE_DISTRICT_NAMES` maps
those two output labels to the names used by GAUL, allowing all nine configured
districts to resolve without changing the BWDAS output schema.

### `pipeline/tests/test_extract_agent.py`

The existing fake-gateway tests were preserved. They continue to cover:

- A complete district-by-variable matrix.
- Missing readings being skipped rather than aborting extraction.
- Per-cell gateway exceptions.
- Raw artifact JSON and source provenance.

New lightweight fake Earth Engine classes were added so the production gateway can be tested without importing Earth Engine or authenticating an account.

#### New gateway coverage

The fake Earth Engine records fluent operations and verifies that the NDVI path:

- Uses `FAO/GAUL/2015/level1`.
- Calls `normalizedDifference(["B8", "B4"])`.
- Applies the configured cloud filter.
- Uses a median composite.

The LST path verifies that:

- The MODIS scale factor is applied.
- The Kelvin-to-Celsius offset is applied.
- Multiplication occurs before subtraction.
- The resulting value is returned through the normal reduction path.

#### New conversion coverage

The test suite includes a known-value check:

```python
raw_kelvin_scaled = 15000
celsius = (
   raw_kelvin_scaled * config.LST_SCALE_FACTOR
   - config.KELVIN_TO_CELSIUS
)
assert celsius == pytest.approx(26.85)
```

It also verifies that `EarthEngineGateway` remains lazy and does not require Earth Engine merely to import or instantiate the gateway.

## 3. Intentionally Not Changed

### Historical baseline retrieval

The 2017-2024 same-calendar-window baseline loop was not implemented. Running a large historical collection of district reductions before the September 15 milestone could create unnecessary Earth Engine quota and runtime pressure.

The current implementation therefore retrieves correctly transformed current-window values only.

### Temporal anomaly calculation

The pipeline does not yet calculate or persist real NDVI and LST anomalies. `StandardizeAgent` still receives the current raw readings and currently assigns the raw value to the `VariableScore.anomaly` field.

This is deliberate. Unit conversion and baseline/anomaly semantics are separate changes, and combining them would make it harder to verify whether a bad CDI value came from Earth Engine derivation or scoring logic.

### CDI scoring method

The existing cross-district min-max normalization was left unchanged. In particular:

- NDVI remains inverted because lower NDVI indicates more stress.
- LST remains non-inverted because higher LST indicates more stress.
- The 40/20/20/20 weights remain unchanged.
- The CDI score remains a relative comparison across the nine districts for the current run.

A future change can switch to temporal anomalies after the baseline source, anomaly definitions, and regression tests are agreed upon.

## 4. Validation Performed

### Passed: Python compilation

The modified source and test files compiled successfully with:

```text
python -m compileall -q src tests
```

### Passed: Editor diagnostics for changed files

No errors were reported in:

- `config.py`
- `test_extract_agent.py`

The `ee` import warning in `extract_agent.py` is the expected optional-dependency warning for the lazy Earth Engine import. Earth Engine is intentionally not required for ordinary imports or offline tests.

### Passed: Direct gateway smoke check

The following checks passed:

- `EarthEngineGateway` imports without Earth Engine authentication.
- The gateway remains lazy after construction.
- `15000 * 0.02 - 273.15` is approximately `26.85` degrees Celsius.

### Passed: focused pytest execution

After reinstalling pytest, the focused extraction and gateway suite passed:

```text
python -m pytest tests\test_extract_agent.py -v
10 passed in 0.22s
```

The earlier `No module named pytest` message was an environment package-path
issue and is no longer present.

### Passed: authenticated GEE smoke test

The live Kweneng smoke test passed for all four variables:

- NDVI: `0.2554734104927883`
- LST: `15.703277656847199 C`
- SPI precipitation: `0.0 mm`
- SMAP root-zone moisture: `0.03985666624803204 cm3/cm3`

All values passed their configured validation ranges.

### Passed: full live pipeline

The full pipeline passed after the SMAP migration and GAUL name mapping:

```text
Extract:     ok=True, records=36
Standardize: ok=True, records=9
Load:        ok=True, records=9
Feed:        ok=True, records=8 alerts
Run ID:      20260823_1822
```

The generated master CSV is:

```text
pipeline/data/output/master_district.csv
```

## 5. Recommended Next Validation Commands

From `BWDAS_2/pipeline`:

```powershell
python -m pytest tests\test_extract_agent.py
python -m pytest
```

The authenticated one-district smoke test should be treated as an integration
check and should not be required for ordinary CI.

## 6. Expected Current Behavior

The full extraction matrix now produces:

```text
9 districts x 4 variables = 36 raw readings
```

The raw artifact should contain:

- NDVI values as unitless index values, not a raw Sentinel-2 band.
- LST values in degrees Celsius, not MODIS scaled integer values.
- The original GEE dataset ID in each reading's `source` field.
- `2026-08-15` as the default analysis-window end date unless overridden by `BWDAS_ANALYSIS_END`.
- SMAP readings from `NASA/SMAP/SPL4SMGP/008` using `sm_rootzone`.

## 7. Follow-up Work After This Gateway Patch

The next isolated change should add a baseline/anomaly component with tests for:

1. NDVI anomaly percentage.
2. LST Celsius anomaly.
3. Missing baseline handling.
4. Zero NDVI baseline handling.
5. Preservation of raw values and units.

Only after those semantics are stable should CDI scoring be evaluated for a separate migration from cross-district min-max normalization to temporal anomaly scoring.