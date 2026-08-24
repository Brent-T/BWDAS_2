import ee
import geopandas as gpd
import json
import os

ee.Initialize(project='bwdas-gee')

# Pull Botswana districts from FAO GAUL
districts = (ee.FeatureCollection("FAO/GAUL/2015/level1")
    .filter(ee.Filter.eq("ADM0_NAME", "Botswana")))

geojson = districts.getInfo()

# Use absolute path — works regardless of where you run the script from
output_dir = r"C:\Users\mrtsh\OneDrive\Desktop\BWDAS_3\BWDAS_2\pipeline\data\boundaries"
os.makedirs(output_dir, exist_ok=True)  # creates folder if it doesn't exist

output_path = os.path.join(output_dir, "botswana_districts.geojson")
with open(output_path, 'w') as f:
    json.dump(geojson, f)

print(f"Saved to: {output_path}")

# Verify district names
gdf = gpd.GeoDataFrame.from_features(geojson['features'])
print("District names:", gdf['ADM1_NAME'].tolist())