from pathlib import Path
import json
import re
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "client/public/data"
OUT = ROOT / "docs/layer-sample-verification.md"

def first_kml(path):
    text = path.read_text(encoding="utf-8", errors="replace")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    text = re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)", "&amp;", text)
    root = ET.fromstring(text)
    for pm in root.iter():
        if pm.tag.rsplit("}", 1)[-1] != "Placemark":
            continue
        name = next((e.text or "" for e in pm.iter() if e.tag.rsplit("}", 1)[-1] == "name"), "").strip()
        coord = next((e.text or "" for e in pm.iter() if e.tag.rsplit("}", 1)[-1] == "coordinates"), "").strip()
        urls = re.findall(r"https?://[^\"'<>\s]+", ET.tostring(pm, encoding="unicode"))
        if coord:
            return name or "(اسم غير موجود؛ يحتاج مراجعة)", coord.split()[0], len(set(urls))
    return "(لا يوجد سجل صالح)", "", 0

def first_geojson(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    for feature in data.get("features", []):
        p = feature.get("properties") or {}
        g = feature.get("geometry") or {}
        c = g.get("coordinates") or []
        if g.get("type") == "Point" and len(c) >= 2:
            return str(p.get("name_ar") or p.get("name") or "(اسم يحتاج مراجعة)"), f"{c[0]},{c[1]}", 0
    return "(لا يوجد سجل صالح)", "", 0

files = sorted(DATA.glob("*.kml")) + sorted(DATA.glob("*.geojson"))
lines = ["# مراجعة موضعية ممثلة لطبقات TIDC", "", "هذه مراجعة آلية لعينة أول سجل صالح من كل مصدر؛ لا تغني عن الاعتماد الميداني الشامل.", "", "| المصدر | اسم العينة | الإحداثية الخام | روابط صور HTTP في العينة | حالة العرض |", "|---|---|---|---:|---|"]
for path in files:
    row = first_kml(path) if path.suffix.lower() == ".kml" else first_geojson(path)
    status = "صالح للتحميل" if row[1] else "يحتاج مراجعة"
    lines.append(f"| `{path.name}` | {row[0].replace('|', '/')} | `{row[1]}` | {row[2]} | {status} |")
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"wrote {OUT}")
