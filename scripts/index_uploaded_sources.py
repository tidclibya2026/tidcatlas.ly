import json, shutil, hashlib, re
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path('/home/ubuntu/libya-tourism-atlas-app')
UPLOAD = Path('/home/ubuntu/upload')
DEST = ROOT / 'docs/source-imports/2026-08-14/user-uploaded'
DEST.mkdir(parents=True, exist_ok=True)

files = [p for p in sorted(UPLOAD.iterdir()) if p.is_file()]
manifest = []

def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def local_name(path):
    digest = sha256(path)[:12]
    safe = re.sub(r'[^\w\u0600-\u06ff.-]+', '_', path.name)
    return f'{safe.rsplit(".", 1)[0]}_{digest}.{safe.rsplit(".", 1)[-1]}' if '.' in safe else f'{safe}_{digest}'

def count_kml(path):
    try:
        root = ET.fromstring(path.read_text(encoding='utf-8', errors='replace'))
    except ET.ParseError:
        return {'records': 0, 'recordsWithCoordinates': 0, 'imageReferences': 0, 'parseError': True}
    records = 0; coords = 0; images = 0
    for pm in root.iter():
        if pm.tag.rsplit('}', 1)[-1] != 'Placemark': continue
        records += 1
        has_coord = any(n.tag.rsplit('}', 1)[-1] == 'coordinates' and (n.text or '').strip() for n in pm.iter())
        coords += int(has_coord)
        html = ' '.join((n.text or '') for n in pm.iter())
        images += len(re.findall(r'(?:https?://|data:image/)[^\s"\'<>]+', html, flags=re.I))
    return {'records': records, 'recordsWithCoordinates': coords, 'imageReferences': images, 'parseError': False}

def count_geojson(path):
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {'records': 0, 'recordsWithCoordinates': 0, 'imageReferences': 0, 'parseError': True}
    features = data.get('features', []) if isinstance(data, dict) else []
    coords = sum(1 for f in features if (f.get('geometry') or {}).get('type') == 'Point' and len((f.get('geometry') or {}).get('coordinates') or []) >= 2)
    image_keys = ('image', 'media', 'photo', 'picture', 'thumbnail', 'url')
    image_refs = 0
    for feature in features:
        props = feature.get('properties') or {}
        image_refs += sum(1 for key, value in props.items() if any(token in key.lower() for token in image_keys) and value)
    return {'records': len(features), 'recordsWithCoordinates': coords, 'imageReferences': image_refs, 'parseError': False}

def count_json(path):
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {'records': 0, 'recordsWithCoordinates': 0, 'imageReferences': 0, 'parseError': True}
    rows = data.get('rows') if isinstance(data, dict) else None
    return {'records': len(rows) if isinstance(rows, list) else 0, 'recordsWithCoordinates': 0, 'imageReferences': 0, 'parseError': False, 'topLevelKeys': sorted(data.keys()) if isinstance(data, dict) else []}

for path in files:
    copied = DEST / local_name(path)
    shutil.copy2(path, copied)
    if path.suffix.lower() == '.kml': stats = count_kml(path); kind = 'kml'
    elif path.suffix.lower() in ('.geojson', '.json'): stats = count_geojson(path) if path.suffix.lower() == '.geojson' else count_json(path); kind = path.suffix.lower().lstrip('.')
    else: stats = {'records': 0, 'recordsWithCoordinates': 0, 'imageReferences': 0, 'parseError': False}; kind = path.suffix.lower().lstrip('.')
    manifest.append({'originalFileName': path.name, 'storedFileName': copied.name, 'sourceKind': kind, 'sha256': sha256(path), 'sizeBytes': path.stat().st_size, **stats})

out = {'manifestVersion': '2026-08-14-user-uploaded-1', 'policy': 'نسخ المصدر محفوظة للمراجعة؛ لا إدخال أو نشر تلقائي قبل فحص التكرارات وحقوق الصور.', 'files': manifest}
(ROOT / 'docs/user-uploaded-sources-manifest-2026-08-14.json').write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'files': len(manifest), 'records': sum(row['records'] for row in manifest), 'coordinates': sum(row['recordsWithCoordinates'] for row in manifest), 'imageReferences': sum(row['imageReferences'] for row in manifest)}, ensure_ascii=False))
