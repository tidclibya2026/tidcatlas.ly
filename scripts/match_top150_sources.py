import json, re
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
queue = json.loads((ROOT / 'docs/top-150-review-queue-2026-08-14.json').read_text(encoding='utf-8'))['rows']
source_dir = ROOT / 'docs/source-imports/2026-08-14'


def norm(value):
    value = (value or '').lower()
    value = re.sub(r'[\u064b-\u065f\u0670\u0640]', '', value)
    value = value.replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ى','ي').replace('ة','ه')
    return re.sub(r'[^\w\u0600-\u06ff]+', ' ', value).strip()

records = []
for path in sorted(source_dir.iterdir()):
    if path.suffix.lower() == '.geojson':
        data = json.loads(path.read_text(encoding='utf-8'))
        for feature in data.get('features', []):
            props = feature.get('properties') or {}
            geom = feature.get('geometry') or {}
            coords = geom.get('coordinates') or []
            if geom.get('type') == 'Point' and len(coords) >= 2:
                records.append({'source': path.name, 'name': props.get('name') or props.get('Name') or props.get('title') or '', 'lat': coords[1], 'lon': coords[0]})
    elif path.suffix.lower() == '.kml':
        try:
            root = ET.fromstring(path.read_text(encoding='utf-8'))
        except ET.ParseError:
            continue
        for pm in root.iter():
            if pm.tag.rsplit('}', 1)[-1] != 'Placemark':
                continue
            name_node = next((n for n in pm.iter() if n.tag.rsplit('}', 1)[-1] == 'name'), None)
            coord_node = next((n for n in pm.iter() if n.tag.rsplit('}', 1)[-1] == 'coordinates'), None)
            if name_node is None or coord_node is None or not (name_node.text and coord_node.text):
                continue
            raw = coord_node.text.strip().split(',')
            if len(raw) >= 2:
                try:
                    records.append({'source': path.name, 'name': name_node.text.strip(), 'lat': float(raw[1]), 'lon': float(raw[0])})
                except ValueError:
                    pass

out = []
for row in queue:
    candidate = norm(row.get('candidate'))
    confirmed = norm(row.get('confirmedName'))
    tokens = {token for token in (candidate + ' ' + confirmed).split() if len(token) >= 4}
    matches = []
    for record in records:
        name = norm(record['name'])
        overlap = len(tokens & set(name.split()))
        if overlap >= 2 or (confirmed and confirmed in name) or (name and name in candidate):
            matches.append({**record, 'overlap': overlap})
    matches.sort(key=lambda item: (-item['overlap'], item['source'], item['name']))
    if matches:
        out.append({'rank': row['rank'], 'candidate': row['candidate'], 'matches': matches[:5]})

result = {'queueVersion': '2026-08-14', 'sourceRecords': len(records), 'matchedCandidates': len(out), 'rows': out}
output = ROOT / 'docs/top-150-source-match-candidates-2026-08-14.json'
output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'sourceRecords': len(records), 'matchedCandidates': len(out), 'output': str(output)}, ensure_ascii=False))
