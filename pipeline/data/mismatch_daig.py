import geopandas as gpd
import pandas as pd
import folium

cdi = pd.read_csv(r'C:\Users\mrtsh\OneDrive\Desktop\BWDAS_3\BWDAS_2\pipeline\data\output\master_district_fixed.csv')
gdf = gpd.read_file(r'C:\Users\mrtsh\OneDrive\Desktop\BWDAS_3\BWDAS_2\pipeline\data\boundaries\botswana_districts.geojson')
gdf = gdf.rename(columns={'ADM1_NAME': 'district'})

from shapely.geometry import MultiPolygon, GeometryCollection

def force_multipolygon(geom):
    if isinstance(geom, GeometryCollection):
        # Extract only polygon parts, wrap as MultiPolygon
        polys = [g for g in geom.geoms 
                 if g.geom_type in ('Polygon', 'MultiPolygon')]
        if not polys:
            return geom
        # Flatten any nested MultiPolygons
        all_polys = []
        for p in polys:
            if p.geom_type == 'Polygon':
                all_polys.append(p)
            else:
                all_polys.extend(p.geoms)
        return MultiPolygon(all_polys)
    return geom

gdf['geometry'] = gdf['geometry'].apply(force_multipolygon)

gdf = gdf.merge(cdi, on='district', how='left')

# Debug — print exactly what the merge produced for all districts
print("Merged result:")
print(gdf[['district','cdi','stress_level','spi_score',
           'ndvi_score','lst_score','sm_score']].to_string(index=False))
print()

# Fill any NaN so tooltip renders correctly
gdf['cdi'] = gdf['cdi'].fillna(0).round(1)
gdf['stress_level'] = gdf['stress_level'].fillna('No data')
gdf['spi_score'] = gdf['spi_score'].fillna(0).round(1)
gdf['ndvi_score'] = gdf['ndvi_score'].fillna(0).round(1)
gdf['lst_score'] = gdf['lst_score'].fillna(0).round(1)
gdf['sm_score'] = gdf['sm_score'].fillna(0).round(1)

colour_map = {
    'Low':      '#C0DD97',
    'Moderate': '#EF9F27',
    'High':     '#D85A30',
    'Severe':   '#A32D2D',
    'No data':  '#888888'
}

m = folium.Map(
    location=[-22.3, 24.7],
    zoom_start=6,
    tiles='CartoDB positron'
)

# Convert to GeoJSON dict explicitly — avoids property loss
geo_dict = gdf.to_crs(epsg=4326).__geo_interface__

folium.GeoJson(
    geo_dict,
    style_function=lambda f: {
        'fillColor': colour_map.get(
            f['properties'].get('stress_level', 'No data'), '#888888'
        ),
        'color': 'white',
        'weight': 1.5,
        'fillOpacity': 0.85
    },
    tooltip=folium.GeoJsonTooltip(
        fields=['district', 'cdi', 'stress_level',
                'spi_score', 'ndvi_score', 'lst_score', 'sm_score'],
        aliases=['District', 'CDI Score', 'Stress Level',
                 'Rainfall', 'Vegetation', 'Temperature', 'Soil Moisture'],
        style="font-family: Calibri; font-size: 13px;"
    )
).add_to(m)

legend_html = """
<div style="position: fixed; bottom: 40px; left: 40px; z-index: 1000;
     background: white; padding: 16px 20px; border-radius: 8px;
     border: 1px solid #ccc; font-family: Calibri;
     box-shadow: 2px 2px 6px rgba(0,0,0,0.2)">
  <div style="font-weight:600; font-size:14px; margin-bottom:10px;
       color:#1A1A1A">CDI Stress Level — August 2026</div>
  <div style="display:flex; align-items:center; margin-bottom:6px">
    <div style="width:18px;height:18px;background:#C0DD97;
         border-radius:3px;margin-right:8px"></div>
    <span style="color:#444;font-size:13px">Low (0–25)</span>
  </div>
  <div style="display:flex; align-items:center; margin-bottom:6px">
    <div style="width:18px;height:18px;background:#EF9F27;
         border-radius:3px;margin-right:8px"></div>
    <span style="color:#444;font-size:13px">Moderate (25–50)</span>
  </div>
  <div style="display:flex; align-items:center; margin-bottom:6px">
    <div style="width:18px;height:18px;background:#D85A30;
         border-radius:3px;margin-right:8px"></div>
    <span style="color:#444;font-size:13px">High (50–75)</span>
  </div>
  <div style="display:flex; align-items:center; margin-bottom:6px">
    <div style="width:18px;height:18px;background:#A32D2D;
         border-radius:3px;margin-right:8px"></div>
    <span style="color:#444;font-size:13px">Severe (75–100)</span>
  </div>
  <div style="margin-top:10px; padding-top:8px; border-top:1px solid #eee;
       font-size:11px; color:#888">
    Source: BWDAS · CHIRPS · NASA SMAP · Sentinel-2 · MODIS
  </div>
</div>
"""
m.get_root().html.add_child(folium.Element(legend_html))

m.save(r'C:\Users\mrtsh\OneDrive\Desktop\BWDAS_3\BWDAS_2\pipeline\data\output/bwdas_cdi_map.html')
print("Map saved.")