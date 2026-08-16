from pathlib import Path
import json
import re
import requests

text = Path('/home/ubuntu/upload/hotels.kml').read_text(errors='ignore')
blocks = re.findall(r'<Placemark\b.*?</Placemark>', text, flags=re.I | re.S)
urls = []
for block in blocks:
    for raw in re.findall(r'https?://[^\s"\'<>\]]+', block):
        url = raw.rstrip('.,);')
        if 'googleusercontent' in url.lower() or any(ext in url.lower() for ext in ('.jpg', '.jpeg', '.png', '.webp')):
            if url not in urls:
                urls.append(url)
results = []
for url in urls[:20]:
    try:
        response = requests.get(url, timeout=8, stream=True, headers={'User-Agent': 'LibyaTourismAtlas/2026'})
        results.append({'status': response.status_code, 'content_type': response.headers.get('content-type', ''), 'url_length': len(url)})
        response.close()
    except requests.RequestException as exc:
        results.append({'status': 'error', 'error': type(exc).__name__, 'url_length': len(url)})
print(json.dumps({'sampled': len(results), 'successes': sum(1 for row in results if row['status'] == 200), 'failures': sum(1 for row in results if row['status'] != 200), 'results': results}, ensure_ascii=False, indent=2))
