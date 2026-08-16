from pathlib import Path
from html import unescape
import re

path = Path('/home/ubuntu/upload/hotels.kml')
text = path.read_text(errors='ignore')
blocks = re.findall(r'<Placemark\b.*?</Placemark>', text, flags=re.I | re.S)
print(f'FILE={path.name}')
print(f'BYTES={path.stat().st_size}')
print(f'PLACEMARKS={len(blocks)}')
coords = []
image_rows = 0
image_urls = []
names = []
for block in blocks:
    name_match = re.search(r'<name>(.*?)</name>', block, flags=re.I | re.S)
    name = re.sub(r'\s+', ' ', unescape(name_match.group(1))).strip() if name_match else ''
    if name:
        names.append(name)
    coord_match = re.search(r'<coordinates>\s*([^<]+?)\s*</coordinates>', block, flags=re.I | re.S)
    if coord_match:
        raw = coord_match.group(1).strip().split(',')
        if len(raw) >= 2:
            try:
                coords.append((float(raw[1]), float(raw[0])))
            except ValueError:
                pass
    urls = re.findall(r'https?://[^\s\"\'<>\]]+', unescape(block))
    image_like = [u.rstrip('.,);') for u in urls if any(x in u.lower() for x in ('googleusercontent', 'jpg', 'jpeg', 'png', 'webp', 'image', 'photo'))]
    if image_like:
        image_rows += 1
        image_urls.extend(image_like)
print(f'WITH_COORDINATES={len(coords)}')
print(f'WITH_IMAGE_URLS={image_rows}')
print(f'IMAGE_URL_COUNT={len(image_urls)}')
print(f'UNIQUE_IMAGE_URL_COUNT={len(set(image_urls))}')
if coords:
    print(f'LAT_RANGE={min(x[0] for x in coords):.6f},{max(x[0] for x in coords):.6f}')
    print(f'LNG_RANGE={min(x[1] for x in coords):.6f},{max(x[1] for x in coords):.6f}')
print('FIRST_NAMES=')
for name in names[:10]:
    print(name)
print('IMAGE_FIELDS=')
fields = re.findall(r'<Data[^>]+name=[\'\"]([^\'\"]+)', text, flags=re.I)
for key in sorted(set(fields)):
    if any(x in key.lower() for x in ('image', 'photo', 'media', 'gx_')):
        print(key)
print('IMAGE_SAMPLES=')
for url in list(dict.fromkeys(image_urls))[:5]:
    print(url)
