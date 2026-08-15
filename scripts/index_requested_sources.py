import json, shutil, hashlib, re
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path('/home/ubuntu/libya-tourism-atlas-app')
UPLOAD = Path('/home/ubuntu/upload')
DEST = ROOT / 'docs/source-imports/2026-08-14/user-requested'
DEST.mkdir(parents=True, exist_ok=True)
NAMES = [
    'atlasnatrual.geojson', 'atlasnatrual-with-media.geojson', 'hotels_visual_qa_decisions.json',
    'أطلس_ليبيا_السياحي_2026_الفنادق_KML2025_مرجعي_DRAFT.kml', 'اكاكوس.kml', 'الفنادق_LY.kml',
    'القرى_والمنتجعاتالسياحية_LY.kml', 'المدينةالقديمة_طرابلس.kml', 'المشاريعوفرصالاستثمارالسياحي.kml',
    'المطاعمفيطرابلس.kml', 'المقاهي_طرابلس.kml', 'فنادقفيطرابلس.kml', 'مواقعالتراثالعالميالخمسة_LY.kml'
]

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()

def safe_name(name): return re.sub(r'[^\w\u0600-\u06ff.-]+', '_', name)

def kml_stats(path):
    try: root = ET.fromstring(path.read_text(encoding='utf-8', errors='replace'))
    except ET.ParseError:
        text = path.read_text(encoding='utf-8', errors='replace')
        placemarks = re.findall(r'<Placemark(?:\s[^>]*)?>([\s\S]*?)</Placemark>', text, re.I)
        coordinates = sum(1 for block in placemarks if re.search(r'<coordinates(?:\s[^>]*)?>[\s\S]*?</coordinates>', block, re.I))
        images = sum(len(re.findall(r"(?:https?://|data:image/)[^\s\"'<>]+", block, re.I)) for block in placemarks)
        return {'records': len(placemarks), 'coordinates': coordinates, 'imageReferences': images, 'parseError': True, 'parseMode': 'regex-fallback'}
    records = coordinates = images = 0
    for pm in root.iter():
        if pm.tag.rsplit('}', 1)[-1] != 'Placemark': continue
        records += 1
        coordinates += int(any(n.tag.rsplit('}', 1)[-1] == 'coordinates' and (n.text or '').strip() for n in pm.iter()))
        text = ' '.join((n.text or '') for n in pm.iter())
        images += len(re.findall(r'(?:https?://|data:image/)[^\s"\'<>]+', text, re.I))
    return {'records': records, 'coordinates': coordinates, 'imageReferences': images, 'parseError': False}

def geojson_stats(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    features = data.get('features', [])
    coords = sum(1 for f in features if (f.get('geometry') or {}).get('type') == 'Point' and len((f.get('geometry') or {}).get('coordinates') or []) >= 2)
    image_keys = ('image', 'media', 'photo', 'picture', 'thumbnail')
    images = sum(1 for f in features for k, v in (f.get('properties') or {}).items() if v and any(token in k.lower() for token in image_keys))
    return {'records': len(features), 'coordinates': coords, 'imageReferences': images, 'parseError': False}

def json_stats(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    rows = data if isinstance(data, list) else data.get('rows', [])
    statuses = {}
    for row in rows:
        status = row.get('review_status', row.get('status', 'unknown')) if isinstance(row, dict) else 'unknown'
        statuses[status] = statuses.get(status, 0) + 1
    return {'records': len(rows), 'coordinates': 0, 'imageReferences': 0, 'parseError': False, 'statuses': statuses}

manifest = []
for name in NAMES:
    path = UPLOAD / name
    if not path.exists(): raise FileNotFoundError(path)
    ext = path.suffix.lower()
    stats = kml_stats(path) if ext == '.kml' else geojson_stats(path) if ext == '.geojson' else json_stats(path)
    stored = DEST / f'{safe_name(path.stem)}_{digest(path)[:12]}{ext}'
    shutil.copy2(path, stored)
    manifest.append({'originalFileName': name, 'storedFileName': stored.name, 'sourceKind': ext.lstrip('.'), 'sha256': digest(path), 'sizeBytes': path.stat().st_size, **stats})

out = {'manifestVersion': '2026-08-14-user-requested-1', 'policy': 'مصادر المستخدم محفوظة كما هي؛ لا إدخال أو نشر تلقائي قبل المطابقة والمراجعة وحقوق الصور.', 'files': manifest}
(ROOT / 'docs/user-requested-sources-manifest-2026-08-14.json').write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'files': len(manifest), 'records': sum(x['records'] for x in manifest), 'coordinates': sum(x['coordinates'] for x in manifest), 'imageReferences': sum(x['imageReferences'] for x in manifest)}, ensure_ascii=False))
