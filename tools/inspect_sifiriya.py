from pathlib import Path
import re

for path in Path('/tmp/github-pages-root').glob('*.kml'):
    text = path.read_text(encoding='utf-8', errors='ignore')
    for match in re.finditer(r'<Placemark\b.*?</Placemark>', text, flags=re.I | re.S):
        block = match.group(0)
        if re.search(r'السيف|سيفيروس|سيفيري|Sever|Sef', block, flags=re.I):
            name = re.search(r'<name>(.*?)</name>', block, flags=re.I | re.S)
            urls = re.findall(r'<(?:img|image)[^>]+(?:src|href)=["\']([^"\']+)', block, flags=re.I)
            if not urls:
                urls = re.findall(r'https?://[^\s"\'<>]+', block, flags=re.I)
            print('FILE=', path.name)
            print('NAME=', re.sub(r'<[^>]+>', ' ', name.group(1)).strip() if name else '')
            print('URL_COUNT=', len(urls))
            for url in urls[:8]:
                print('URL=', url[:500])
            print('---')
