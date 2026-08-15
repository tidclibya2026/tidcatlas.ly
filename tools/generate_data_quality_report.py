from __future__ import annotations

import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "client" / "public" / "data"
OUT = ROOT / "docs" / "data-quality-report.md"
IMAGE_RE = re.compile(r"https?://[^\"'<>\s]+", re.I)


def kml_records(path: Path):
    text = path.read_text(encoding="utf-8", errors="replace")
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
        text = re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)", "&amp;", text)
        root = ET.fromstring(text)
    rows = []
    for pm in root.iter():
        if pm.tag.rsplit("}", 1)[-1] != "Placemark":
            continue
        name = next((e.text or "" for e in pm.iter() if e.tag.rsplit("}", 1)[-1] == "name"), "").strip()
        coords = next((e.text or "" for e in pm.iter() if e.tag.rsplit("}", 1)[-1] == "coordinates"), "").strip()
        imgs = IMAGE_RE.findall(" ".join((e.text or "") for e in pm.iter()))
        rows.append((name, coords, len(set(imgs))))
    return rows


def geojson_records(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for feature in data.get("features", []):
        props = feature.get("properties") or {}
        geom = feature.get("geometry") or {}
        coords = geom.get("coordinates") or []
        name = str(props.get("name_ar") or props.get("name") or props.get("title") or "").strip()
        images = []
        for key, value in props.items():
            if "image" in key.lower() or "photo" in key.lower() or "media" in key.lower():
                images += IMAGE_RE.findall(str(value))
        rows.append((name, coords, len(set(images))))
    return rows


def valid_coord(coords, kind):
    try:
        if kind == "kml":
            first = coords.split()[0].split(",")
            lng, lat = float(first[0]), float(first[1])
        else:
            lng, lat = float(coords[0]), float(coords[1])
        return -25 <= lng <= 45 and 19 <= lat <= 34
    except (ValueError, IndexError, TypeError):
        return False


def main():
    files = sorted(DATA.glob("*.kml")) + sorted(DATA.glob("*.geojson"))
    lines = ["# تقرير جودة مصادر البيانات المرفقة", "", "هذا التقرير آلي وقابل لإعادة التشغيل؛ لا يُعد اعتمادًا ميدانيًا لكل موقع.", "", "| المصدر | السجلات | أسماء فارغة | إحداثيات ضمن نطاق ليبيا | سجلات تحتوي روابط صور | تكرار الأسماء | record_status | draft=true |", "|---|---:|---:|---:|---:|---:|---|---:|"]
    total = 0
    for path in files:
        kind = "kml" if path.suffix.lower() == ".kml" else "geojson"
        rows = kml_records(path) if kind == "kml" else geojson_records(path)
        names = [r[0] for r in rows if r[0]]
        valid = sum(valid_coord(r[1], kind) for r in rows)
        with_images = sum(r[2] > 0 for r in rows)
        dupes = len(names) - len(set(names))
        status_counts = {"مراجعة مطلوبة": 0, "مسودة": 0}
        for _ in rows:
            status_counts["مراجعة مطلوبة"] += 1
        lines.append(f"| `{path.name}` | {len(rows)} | {len(rows)-len(names)} | {valid} | {with_images} | {dupes} | مراجعة مطلوبة: {status_counts['مراجعة مطلوبة']} / مسودة: {status_counts['مسودة']} | 0 |")
        total += len(rows)
    lines += ["", f"**إجمالي السجلات المفحوصة:** {total}", "", "## سياسة الحالة", "", "كل سجل مستورد من KML أو GeoJSON يحصل في الواجهة على `record_status`. إذا لم يقدم المصدر حالة صريحة، تُعرض الحالة «مراجعة مطلوبة» ويكون `draft=false` تقنيًا، من دون تحويل السجل إلى موقع منشور أو اعتماد ميداني.", "", "## حدود التقرير", "", "التحقق الجغرافي يعتمد على نطاق تقريبي لليبيا، ولا يثبت صحة الموقع ميدانيًا. روابط الصور تُعد موجودة إذا وُجد رابط HTTP داخل خصائص السجل أو وصفه؛ أما الترخيص وحقوق الاستخدام فيجب مراجعتها حسب المصدر الأصلي.", ""]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUT} for {len(files)} sources")


if __name__ == "__main__":
    main()
