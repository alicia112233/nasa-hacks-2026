"""Download NASA Environmental Data App (EDA) telemetry and radiation for one ISS mission
and write a compact, provenance-stamped extract to public/data/nasa-eda-<mission>.json.

    python -I scripts/fetch-nasa-eda.py [MISSION] [REPO_ROOT]

Default mission RR-3 (Rodent Research-3, ISS, April-May 2016). Source: NASA OSDR EDA,
https://visualization.osdr.nasa.gov/eda/ . Temperature, relative humidity and CO2 are
five-minute habitat sensor readings (ISS flight unit and ground control). Radiation is
daily absorbed dose in mGy/day (GCR, SAA, total, accumulated) from ISS instruments,
analysed by NASA JSC's Space Radiation Analysis Group. Transformations: telemetry is
reduced to hourly medians; habitat summaries start at the animals' transfer to the ISS
(earlier hours are pre-installation); radiation is kept daily as published.
"""
import datetime as dt
import hashlib
import json
import os
import re
import statistics
import sys
import urllib.request

mission = sys.argv[1] if len(sys.argv) > 1 else 'RR-3'
root = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
url = f'https://visualization.osdr.nasa.gov/eda/dashboard_{mission}'
request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (research data extract)'})
raw = urllib.request.urlopen(request, timeout=120).read()
page = raw.decode('utf8')
match = re.search(r'<script id="data" type="application/json">(.*?)</script>', page, re.S)
if not match:
    sys.exit('EDA data block not found')
data = json.loads(match.group(1))
telemetry = json.loads(data['telemetry_data'])
radiation = json.loads(data['radiation_data'])

hourly = {}
for i, stamp in enumerate(telemetry['time']):
    hour = stamp[:13] + ':00'
    bucket = hourly.setdefault(hour, {k: [] for k in ('temperature_iss', 'temperature_ground', 'rh_iss', 'rh_ground', 'co2_iss', 'co2_ground')})
    for key in bucket:
        value = telemetry[key][i]
        if isinstance(value, (int, float)):
            bucket[key].append(value)

def med(values):
    return round(statistics.median(values), 1) if values else None

hours = sorted(hourly)
series = {key: [med(hourly[h][key]) for h in hours] for key in ('temperature_iss', 'temperature_ground', 'rh_iss', 'rh_ground', 'co2_iss', 'co2_ground')}

milestones = telemetry.get('milestones') or radiation.get('milestones') or {}
transfer = (milestones.get('Animal transfer to ISS') or hours[0])[:13]
onboard = [i for i, h in enumerate(hours) if h[:13] >= transfer]


def onboard_only(values):
    return [values[i] for i in onboard]


def summary(values, digits=1):
    vals = [v for v in values if v is not None]
    return {'min': round(min(vals), digits), 'median': round(statistics.median(vals), digits), 'max': round(max(vals), digits)}

out = {
    'schemaVersion': 1,
    'mission': mission,
    'title': f'NASA Environmental Data App · {mission} · ISS habitat environment and radiation',
    'source': {
        'publisher': 'NASA Open Science Data Repository (OSDR), Environmental Data App',
        'url': url,
        'portal': 'https://visualization.osdr.nasa.gov/eda/',
        'radiationAnalysis': 'NASA JSC Space Radiation Analysis Group (SRAG); doses in water converted from silicon; preliminary analysis; launch-vehicle dose approximated from US Lab averages.',
        'radiationReference': 'https://genelab.nasa.gov/environmental/radiation/iss/rodentresearch',
        'retrievedAt': dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        'sha256': hashlib.sha256(raw).hexdigest(),
        'bytes': len(raw),
    },
    'transformations': 'Five-minute telemetry reduced to hourly medians; habitat summaries start at transfer to the ISS; radiation kept as published daily values.',
    'limitations': 'Habitat sensors in an ISS rodent research unit and its ground control, not crew cabin air or personal dosimetry. Archived mission context, not current readings.',
    'units': {'temperature': '°C', 'rh': '%', 'co2': 'ppm', 'dose': 'mGy/day', 'accumulated': 'mGy'},
    'milestones': telemetry.get('milestones') or radiation.get('milestones') or {},
    'telemetry': {'time': hours, **series},
    'radiation': {k: radiation[k] if k == 'time' else [round(v, 4) for v in radiation[k]] for k in ('time', 'gcr', 'saa', 'total', 'accumulated')},
    'summary': {
        'samples': len(telemetry['time']),
        'telemetryFrom': transfer + ':00',
        'co2_iss': summary(onboard_only(series['co2_iss'])), 'co2_ground': summary(onboard_only(series['co2_ground'])),
        'temperature_iss': summary(onboard_only(series['temperature_iss'])), 'rh_iss': summary(onboard_only(series['rh_iss'])),
        'dose_total': summary(radiation['total'], 3), 'dose_accumulated': round(radiation['accumulated'][-1], 3),
        'days': len(radiation['time']),
    },
}
target = os.path.join(root, 'public', 'data', f'nasa-eda-{mission.lower()}.json')
os.makedirs(os.path.dirname(target), exist_ok=True)
with open(target, 'w', encoding='utf8') as handle:
    json.dump(out, handle, ensure_ascii=False, separators=(',', ':'))
print(target, os.path.getsize(target), json.dumps(out['summary']))
