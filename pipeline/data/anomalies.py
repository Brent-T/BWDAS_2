
import sys
sys.path.insert(0, 'src')
import glob, json, os

# Find latest raw extraction file
raw_files = glob.glob(r'C:\Users\mrtsh\OneDrive\Desktop\BWDAS_3\BWDAS_2\pipeline\data\raw/raw_*.json')
if not raw_files:
    raw_files = glob.glob(r'C:\Users\mrtsh\OneDrive\Desktop\BWDAS_3\BWDAS_2\pipeline\data\raw/raw_*.json')
latest = max(raw_files, key=os.path.getmtime)
print('Raw file:', latest)

with open(latest) as f:
    raw = json.load(f)

readings = raw.get('readings', []) if isinstance(raw, dict) else raw

# Check North East and Kgatleng readings
problem_districts = ['North East', 'North-East', 'Kgatleng']
problem_vars = ['ndvi', 'sm', 'lst']

for reading in readings:
    d = reading.get('district', '')
    v = reading.get('variable', '')
    if any(p in d for p in problem_districts) and v in problem_vars:
        print(f"{d} | {v} | raw={reading.get('value')} | anomaly={reading.get('anomaly')}")