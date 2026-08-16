from pathlib import Path
import re
from html import unescape

path = next(Path("client/public").rglob("hotels*.kml"))
text = path.read_text(errors="ignore")
for block in re.findall(r"<Placemark.*?</Placemark>", text, flags=re.I | re.S):
    name = re.search(r"<name>(.*?)</name>", block, flags=re.I | re.S)
    title = re.sub(r"\s+", " ", unescape(name.group(1))).strip() if name else ""
    if "برج الحياة" in title or "Lancaster" in title or "ماريوت" in title:
        print("NAME:", title)
        for key, value in re.findall(r"<Data[^>]+name=['\"]([^'\"]+)['\"][^>]*>.*?<value>(.*?)</value>", block, flags=re.I | re.S):
            if any(token in key.lower() for token in ("image", "photo", "media", "gx_")):
                urls = re.findall(r"https?://[^\s\"'<>\]]+", unescape(value))
                print(key, "urls=", urls[:5], "raw=", re.sub(r"\s+", " ", unescape(value)).strip()[:220])
        for value in re.findall(r"<img[^>]+src=['\"]([^'\"]+)['\"]", block, flags=re.I):
            print("IMG", value[:300])
        break
