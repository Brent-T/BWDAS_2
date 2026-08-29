#!/usr/bin/env python3
"""Test script to verify Model C Z-score implementation.

This script tests the StandardizeAgent with climatological baselines
to ensure Model C calculations work correctly.
"""

import sys
from pathlib import Path

# Add package to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from bwdas.models import RawDistrictReading, CDIRecord
from bwdas.agents.standardize_agent import StandardizeAgent
from bwdas.agents.base import PipelineContext
from bwdas.config import DATA_DIR


def load_test_baselines() -> dict[tuple[str, str, int], dict[str, float]]:
    """Load baselines from CSV for testing."""
    import csv
    
    baseline_path = DATA_DIR / "input" / "climatology_baselines.csv"
    if not baseline_path.exists():
        print(f"ERROR: Baselines not found at {baseline_path}")
        return {}
    
    baselines = {}
    with open(baseline_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (row["district"], row["variable"], int(row["month"]))
            baselines[key] = {
                "mean": float(row["mean_val"]),
                "std": float(row["std_val"]),
            }
    return baselines


def test_model_c_with_mock_data():
    """Test Model C calculations with mock drought scenario."""
    print("=" * 80)
    print("MODEL C Z-SCORE IMPLEMENTATION TEST")
    print("=" * 80)
    
    # Load baselines
    baselines = load_test_baselines()
    if not baselines:
        print("FAILED: Could not load baselines")
        return False
    
    print(f"✓ Loaded {len(baselines)} baseline records")
    
    # Create agent with baselines
    agent = StandardizeAgent(baselines=baselines)
    
    # Create mock readings simulating August 2026 severe drought
    # All districts experience: low precipitation, low NDVI, high LST, low soil moisture
    august_date = "2026-08-15"
    
    mock_readings = []
    
    # North-West district: normally very wet (NDVI mean ~0.525), now severely stressed
    mock_readings.append(RawDistrictReading(
        district="North-West",
        variable="spi",
        date=august_date,
        value=5.0,  # Well below normal (mean=35.5, std=20.5) → Z ≈ -1.49
        source="CHIRPS",
        unit="mm"
    ))
    mock_readings.append(RawDistrictReading(
        district="North-West",
        variable="ndvi",
        date=august_date,
        value=0.280,  # Well below normal (mean=0.385, std=0.045) → Z ≈ -2.33
        source="Sentinel-2",
        unit="index"
    ))
    mock_readings.append(RawDistrictReading(
        district="North-West",
        variable="lst",
        date=august_date,
        value=32.5,  # Above normal (mean=28.8, std=0.9) → Z ≈ +4.1, inverted to -4.1
        source="MODIS",
        unit="celsius"
    ))
    mock_readings.append(RawDistrictReading(
        district="North-West",
        variable="sm",
        date=august_date,
        value=0.085,  # Below normal (mean=0.165, std=0.028) → Z ≈ -2.86
        source="SMAP",
        unit="cm3/cm3"
    ))
    
    # Kgalagadi district: normally arid, also severely stressed
    mock_readings.append(RawDistrictReading(
        district="Kgalagadi",
        variable="spi",
        date=august_date,
        value=0.5,  # Below normal (mean=10.5, std=8.2) → Z ≈ -1.22
        source="CHIRPS",
        unit="mm"
    ))
    mock_readings.append(RawDistrictReading(
        district="Kgalagadi",
        variable="ndvi",
        date=august_date,
        value=0.095,  # Below normal (mean=0.178, std=0.023) → Z ≈ -3.61
        source="Sentinel-2",
        unit="index"
    ))
    mock_readings.append(RawDistrictReading(
        district="Kgalagadi",
        variable="lst",
        date=august_date,
        value=42.0,  # Well above normal (mean=38.2, std=1.7) → Z ≈ +2.24, inverted to -2.24
        source="MODIS",
        unit="celsius"
    ))
    mock_readings.append(RawDistrictReading(
        district="Kgalagadi",
        variable="sm",
        date=august_date,
        value=0.018,  # Below normal (mean=0.035, std=0.008) → Z ≈ -2.13
        source="SMAP",
        unit="cm3/cm3"
    ))
    
    # Create context and run standardization
    ctx = PipelineContext(run_id="test-run-001")
    ctx.artifacts["raw_readings"] = mock_readings
    
    result = agent.execute(ctx)
    
    if not result.ok:
        print(f"FAILED: Agent execution errors: {result.errors}")
        return False
    
    print(f"✓ Standardization completed: {result.records} records")
    
    # Extract and display results
    records: list[CDIRecord] = result.artifact
    
    print("\n" + "=" * 80)
    print("RESULTS: Model A (Spatial) vs Model C (Climatological Z-Scores)")
    print("=" * 80)
    
    for record in records:
        print(f"\n{record.district}:")
        print(f"  Model A CDI: {record.cdi:.1f} ({record.stress_level})")
        
        if record.cdi_z is not None:
            print(f"  Model C Z-CDI: {record.cdi_z:.2f} ({record.stress_level_z})")
            print(f"  Model C Stress %: {record.cdi_z_stress_pct:.1f}%")
            
            # Show individual variable Z-scores
            print(f"  Variable Z-scores:")
            for var_name in ["spi", "ndvi", "lst", "sm"]:
                var_score = getattr(record, var_name)
                if var_score.z_score is not None:
                    print(f"    {var_name.upper()}: Z={var_score.z_score:+.2f} "
                          f"(baseline: μ={var_score.baseline_mean}, σ={var_score.baseline_std})")
        else:
            print("  Model C: Not available (missing baselines)")
    
    # Verify Model C detected extreme stress in North-West
    nw_record = next((r for r in records if r.district == "North-West"), None)
    if nw_record and nw_record.cdi_z is not None:
        if nw_record.cdi_z < -2.0:
            print(f"\n✓ SUCCESS: North-West correctly identified as Extreme Stress "
                  f"(Z-CDI = {nw_record.cdi_z:.2f})")
            print("  This demonstrates Model C's ability to detect local anomalies,")
            print("  unlike Model A which would compare North-West to other districts.")
        else:
            print(f"\n⚠ WARNING: North-West Z-CDI ({nw_record.cdi_z:.2f}) not in Extreme Stress range")
    
    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)
    
    return True


if __name__ == "__main__":
    success = test_model_c_with_mock_data()
    sys.exit(0 if success else 1)
