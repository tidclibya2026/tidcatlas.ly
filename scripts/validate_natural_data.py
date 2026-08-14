import json
from pathlib import Path

source = Path('/tmp/natural.geojson')
if not source.exists():
    raise SystemExit('natural.geojson is not available in /tmp')
data = json.loads(source.read_text())
features = data.get('features', [])
rows = []
for feature in features:
    props = feature.get('properties') or {}
    geom = feature.get('geometry') or {}
    coords = geom.get('coordinates') or []
    point = coords if geom.get('type') == 'Point' else (coords[0][0] if coords and isinstance(coords[0], list) and coords[0] and isinstance(coords[0][0], list) else [])
    has_coords = len(point) >= 2 and all(isinstance(value, (int, float)) for value in point[:2])
    name = str(props.get('name') or '').strip()
    description = str(props.get('description') or props.get('description_ar') or '').strip()
    category = str(props.get('primary_category') or props.get('category') or '').strip()
    rows.append((name, has_coords, bool(description), bool(category), str(geom.get('type') or '')))

name_count = sum(bool(row[0]) for row in rows)
coord_count = sum(row[1] for row in rows)
description_count = sum(row[2] for row in rows)
category_count = sum(row[3] for row in rows)
point_count = sum(row[4] == 'Point' for row in rows)

out = [
    '# تحقق من بيانات طبقة الموارد الطبيعية',
    '',
    f'- إجمالي المعالم المقروءة: {len(rows)}',
    f'- سجلات بأسماء: {name_count}',
    f'- سجلات بإحداثيات قابلة للقراءة: {coord_count}',
    f'- سجلات بوصف: {description_count}',
    f'- سجلات بتصنيف أولي: {category_count}',
    f'- معالم Point: {point_count}',
    '',
    'المصدر: natural-atlas-with-media_5ccb1fb0.geojson، تم تحميله من تخزين المشروع للتحقق فقط. لا ينشئ التقرير نقاطًا جديدة ولا يعدّل قاعدة البيانات.',
]
Path('/home/ubuntu/libya-tourism-atlas-app/docs/natural-layer-validation.md').write_text('\n'.join(out) + '\n')
print('\n'.join(out))
