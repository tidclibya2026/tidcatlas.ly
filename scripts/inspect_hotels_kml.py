from pathlib import Path
import re

path = next(Path("client/public").rglob("hotels*.kml"))
text = path.read_text(errors="ignore")
print(f"file={path} chars={len(text)} placemarks={text.count('<Placemark')}")
for index, block in enumerate(re.findall(r"<Placemark.*?</Placemark>", text, flags=re.I | re.S)[:8], start=1):
    print(f"--- placemark {index} ---")
    for pattern in (r"<name>(.*?)</name>", r"<description>(.*?)</description>", r"<Data[^>]+name=['\"]([^'\"]*(?:image|photo|picture|media|link)[^'\"]*)['\"][^>]*>.*?<value>(.*?)</value>", r"<href>(.*?)</href>"):
        matches = re.findall(pattern, block, flags=re.I | re.S)
        for match in matches[:5]:
            print(re.sub(r"\\s+", " ", " ".join(match) if isinstance(match, tuple) else match).strip()[:500])
