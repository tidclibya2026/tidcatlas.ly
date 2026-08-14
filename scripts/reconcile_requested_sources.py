import json, re, hashlib
from pathlib import Path

ROOT = Path('/home/ubuntu/libya-tourism-atlas-app')
SOURCE = ROOT / 'docs/source-imports/2026-08-14/user-requested'
CURRENT = ROOT / 'client/public/data'
OUT = ROOT / 'docs/reconciliation-requested-sources-2026-08-14.json'

def norm(value):
    value = (value or '').lower()
    value = re.sub(r'[\u064b-\u065f\u0670\u0640]', '', value)
    value = value.replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ى','ي').replace('ة','ه')
    return re.sub(r'[^\w\u0600-\u06ff]+', ' ', value).strip()

def tag(block, name):
    match = re.search(rf'<{name}(?:\s[^>]*)?>([\s\S]*?)</{name}>', block, re.I)
    return re.sub(r'<[^>]+>', ' ', match.group(1)).strip() if match else ''

def kml_rows(path):
    text = path.read_text(encoding='utf-8', errors='replace')
    rows = []
    for block in re.findall(r'<Placemark(?:\s[^>]*)?>([\s\S]*?)</Placemark>', text, re.I):
        name = tag(block, 'name')
        raw = tag(block, 'coordinates').split(',')
        if not name or len(raw) < 2: continue
        try: lon, lat = float(raw[0]), float(raw[1])
        except ValueError: continue
        metadata = {key: re.sub(r'<[^>]+>', ' ', value).strip() for key, value in re.findall(r'<Data\s+name=["\']([^"\']+)["\'][^>]*>[\s\S]*?<value>([\s\S]*?)</value>[\s\S]*?</Data>', block, re.I)}
        rows.append({'name': name, 'lat': lat, 'lon': lon, 'metadata': metadata, 'source': path.name})
    return rows

def geojson_rows(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    rows = []
    for feature in data.get('features', []):
        geom = feature.get('geometry') or {}; coords = geom.get('coordinates') or []
        props = feature.get('properties') or {}
        if geom.get('type') != 'Point' or len(coords) < 2: continue
        name = props.get('name') or props.get('Name') or props.get('title') or props.get('اسم') or ''
        if name: rows.append({'name': str(name), 'lat': float(coords[1]), 'lon': float(coords[0]), 'metadata': {str(k): str(v) for k, v in props.items() if v is not None}, 'source': path.name})
    return rows

def key(row): return f"{norm(row['name'])}|{row['lat']:.5f}|{row['lon']:.5f}"

new_rows = []
for path in sorted(SOURCE.iterdir()):
    if path.suffix.lower() == '.kml': new_rows.extend(kml_rows(path))
    elif path.suffix.lower() == '.geojson': new_rows.extend(geojson_rows(path))
current_rows = []
for path in sorted(CURRENT.iterdir()):
    if path.suffix.lower() == '.kml': current_rows.extend(kml_rows(path))
    elif path.suffix.lower() == '.geojson': current_rows.extend(geojson_rows(path))

new_counts = {}
for row in new_rows: new_counts[key(row)] = new_counts.get(key(row), 0) + 1
current_keys = {key(row) for row in current_rows}
new_unique = {key(row): row for row in new_rows}
duplicates = [{'key': k, 'count': c, 'sample': new_unique[k]} for k, c in new_counts.items() if c > 1]
existing_matches = [row for k, row in new_unique.items() if k in current_keys]
qa_path = SOURCE / 'hotels_visual_qa_decisions_ed829a811761.json'
qa = json.loads(qa_path.read_text(encoding='utf-8')) if qa_path.exists() else []
qa_by_runtime = {row.get('runtime_id'): row for row in qa if isinstance(row, dict)}
hotel_runtime_matches = []
queue_path = ROOT / 'docs/top-150-review-queue-2026-08-14.json'
queue = json.loads(queue_path.read_text(encoding='utf-8'))['rows'] if queue_path.exists() else []
top150_source_matches = []
for candidate in queue:
    tokens = {token for token in (norm(candidate.get('candidate')) + ' ' + norm(candidate.get('confirmedName'))).split() if len(token) >= 4}
    matches = []
    for row in new_rows:
        overlap = len(tokens & set(norm(row['name']).split()))
        if overlap >= 2 or (candidate.get('confirmedName') and norm(candidate['confirmedName']) in norm(row['name'])):
            matches.append({**row, 'overlap': overlap})
    matches.sort(key=lambda item: (-item['overlap'], item['source'], item['name']))
    if matches:
        top150_source_matches.append({'rank': candidate['rank'], 'candidate': candidate['candidate'], 'matches': matches[:8]})
for row in new_rows:
    runtime_id = row['metadata'].get('runtime_id') or row['metadata'].get('atlas_id') or row['metadata'].get('kml_cluster_id') or row['metadata'].get('id')
    if runtime_id in qa_by_runtime:
        hotel_runtime_matches.append({'runtimeId': runtime_id, 'name': row['name'], 'lat': row['lat'], 'lon': row['lon'], 'source': row['source'], 'qa': qa_by_runtime[runtime_id]})

report = {
  'reportVersion': '2026-08-14-requested-reconciliation-1',
  'policy': 'نتائج المطابقة والتكرار للعرض والمراجعة فقط؛ لا إدخال أو نشر تلقائي.',
  'newSourceRows': len(new_rows), 'currentSourceRows': len(current_rows), 'newUniqueKeys': len(new_unique),
  'duplicateGroupsInNewSources': len(duplicates), 'newRowsAlreadyInCurrentData': len(existing_matches),
  'hotelVisualQaDecisions': len(qa), 'hotelVisualQaRowsMatchedByRuntimeId': len(hotel_runtime_matches), 'top150CandidatesWithRequestedSourceMatches': len(top150_source_matches),
  'duplicates': duplicates[:500], 'existingMatches': existing_matches[:500], 'hotelVisualQaMatches': hotel_runtime_matches[:500], 'top150SourceMatches': top150_source_matches[:150],
}
OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: report[k] for k in ['newSourceRows','currentSourceRows','newUniqueKeys','duplicateGroupsInNewSources','newRowsAlreadyInCurrentData','hotelVisualQaDecisions','hotelVisualQaRowsMatchedByRuntimeId']}, ensure_ascii=False))
