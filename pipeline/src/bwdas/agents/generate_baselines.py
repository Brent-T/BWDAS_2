#!/usr/bin/env python3
"""Generate climatological baselines for Model C (Z-score standardization).

This script computes historical means and standard deviations for each district,
variable, and calendar month from Google Earth Engine data. The output is a static
CSV file that the StandardizeAgent loads to compute Z-scores for current observations.

Usage:
    python -m bwdas.agents.generate_baselines --years 2017-2025 --output pipeline/data/input/climatology_baselines.csv
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import ee

from ..config import DISTRICTS, VARIABLES, DATASETS, GEE_DISTRICT_NAMES


def initialize_ee() -> None:
    """Initialize Google Earth Engine."""
    try:
        ee.Initialize()
    except Exception as e:
        print(f"Error initializing Earth Engine: {e}")
        raise


def get_district_boundaries() -> dict[str, ee.Geometry]:
    """Load district boundaries from GADM or use predefined geometries."""
    # For now, we'll use GADM Level 1 boundaries
    gadm = ee.FeatureCollection("FAO/GADM/2015/Level1").filter(
        ee.Filter.eq("ADM0_NAME", "Botswana")
    )
    
    boundaries = {}
    for district in DISTRICTS:
        gee_name = GEE_DISTRICT_NAMES.get(district, district)
        feature = gadm.filter(ee.Filter.eq("NAME_1", gee_name)).first()
        boundaries[district] = feature.geometry()
    
    return boundaries


def extract_historical_data(
    variable: str,
    district: str,
    geometry: ee.Geometry,
    start_year: int,
    end_year: int,
) -> list[dict[str, Any]]:
    """Extract historical monthly data for a single variable and district.
    
    Args:
        variable: Variable name (spi, ndvi, lst, sm)
        district: District name
        geometry: District geometry
        start_year: Start year of baseline period
        end_year: End year of baseline period
    
    Returns:
        List of dicts with month, mean, std for each calendar month
    """
    dataset_config = DATASETS[variable]
    gee_id = dataset_config["gee_id"]
    band = dataset_config["band"]
    
    # Create date range for historical baseline
    start_date = f"{start_year}-01-01"
    end_date = f"{end_year}-12-31"
    
    # Load collection
    collection = ee.ImageCollection(gee_id).filterDate(start_date, end_date)
    
    # Apply variable-specific preprocessing
    if variable == "ndvi":
        # Compute NDVI from S2 bands if not pre-computed
        def compute_ndvi(img: ee.Image) -> ee.Image:
            ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
            return img.addBands(ndvi)
        
        collection = collection.map(compute_ndvi)
        band = "NDVI"
    
    elif variable == "lst":
        # Convert LST from Kelvin to Celsius
        def to_celsius(img: ee.Image) -> ee.Image:
            lst_c = img.select("LST_Day_1km").multiply(0.02).subtract(273.15).rename("LST_C")
            qa = img.select("QA_Day_1km")
            # Simple cloud mask: keep pixels with QA < 100
            mask = qa.lt(100)
            return lst_c.updateMask(mask)
        
        collection = collection.map(to_celsius)
        band = "LST_C"
    
    elif variable == "sm":
        band = "sm_rootzone"
    
    elif variable == "spi":
        # For SPI baseline, we store raw precipitation statistics
        # SPI calculation will be done separately using climate_indices library
        # Here we compute mean/std of monthly precipitation totals
        band = "precipitation"
    
    # Compute monthly climatology
    monthly_stats = []
    for month in range(1, 13):
        # Filter to this calendar month across all years
        monthly_collection = collection.filter(
            ee.Filter.calendarRange(month, month, "month")
        )
        
        # Compute mean and std across all images for this month
        mean_img = monthly_collection.mean().select(band)
        std_img = monthly_collection.reduce(ee.Reducer.stdDev()).select(band)
        
        # Reduce over district geometry
        try:
            mean_val = mean_img.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=geometry,
                scale=1000,  # 1km resolution
                maxPixels=1e9
            ).get(band)
            
            std_val = std_img.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=geometry,
                scale=1000,
                maxPixels=1e9
            ).get(band)
            
            # Execute the computation
            mean_result = ee.Number(mean_val).getInfo()
            std_result = ee.Number(std_val).getInfo()
            
            if mean_result is not None and std_result is not None:
                monthly_stats.append({
                    "district": district,
                    "variable": variable,
                    "month": month,
                    "mean_val": round(mean_result, 6),
                    "std_val": round(std_result, 6),
                })
        
        except Exception as e:
            print(f"Warning: Could not compute stats for {district}/{variable}/month {month}: {e}")
            # Use placeholder values if computation fails
            monthly_stats.append({
                "district": district,
                "variable": variable,
                "month": month,
                "mean_val": 0.0,
                "std_val": 1.0,  # Default to unit variance
            })
    
    return monthly_stats


def generate_baselines(
    start_year: int = 2017,
    end_year: int = 2025,
    output_path: Path | None = None,
) -> list[dict[str, Any]]:
    """Generate complete climatological baseline for all districts and variables.
    
    Args:
        start_year: Start year of baseline period
        end_year: End year of baseline period
        output_path: Path to save CSV output (optional)
    
    Returns:
        List of baseline records
    """
    print(f"Generating climatological baselines for {start_year}-{end_year}...")
    
    initialize_ee()
    boundaries = get_district_boundaries()
    
    all_baselines = []
    total_tasks = len(DISTRICTS) * len(VARIABLES)
    completed = 0
    
    for district in DISTRICTS:
        geometry = boundaries[district]
        print(f"\nProcessing district: {district}")
        
        for variable in VARIABLES:
            print(f"  Extracting {variable}...")
            try:
                stats = extract_historical_data(
                    variable=variable,
                    district=district,
                    geometry=geometry,
                    start_year=start_year,
                    end_year=end_year,
                )
                all_baselines.extend(stats)
                completed += 1
                print(f"    ✓ Completed ({completed}/{total_tasks})")
            
            except Exception as e:
                print(f"    ✗ Error: {e}")
                # Add placeholder baselines to avoid breaking the pipeline
                for month in range(1, 13):
                    all_baselines.append({
                        "district": district,
                        "variable": variable,
                        "month": month,
                        "mean_val": 0.0,
                        "std_val": 1.0,
                    })
    
    # Save to CSV if path provided
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["district", "variable", "month", "mean_val", "std_val"])
            writer.writeheader()
            writer.writerows(all_baselines)
        print(f"\n✓ Baselines saved to: {output_path}")
    
    return all_baselines


def main() -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Generate climatological baselines for Z-score standardization"
    )
    parser.add_argument(
        "--start-year",
        type=int,
        default=2017,
        help="Start year of baseline period (default: 2017)"
    )
    parser.add_argument(
        "--end-year",
        type=int,
        default=2025,
        help="End year of baseline period (default: 2025)"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output CSV file path"
    )
    
    args = parser.parse_args()
    
    if args.output is None:
        # Default output location
        from ..config import DATA_DIR
        args.output = DATA_DIR / "input" / "climatology_baselines.csv"
    
    generate_baselines(
        start_year=args.start_year,
        end_year=args.end_year,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
