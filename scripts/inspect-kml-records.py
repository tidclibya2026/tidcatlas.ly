from pathlib import Path
import xml.etree.ElementTree as ET

path = Path('client/public/data/world-heritage_ae1639b4.kml')
root = ET.fromstring(path.read_text(encoding='utf-8'))
ns = {'k': 'http://www.opengis.net/kml/2.2'}
for placemark in root.findall('.//k:Placemark', ns):
    coords = ''.join(placemark.findtext('.//k:coordinates', default='', namespaces=ns).split())
    if '14.3094895,32.6323093' not in coords and '14.2904233,32.638338' not in coords:
        continue
    name = placemark.findtext('k:name', default='', namespaces=ns)
    description = placemark.findtext('k:description', default='', namespaces=ns)
    data = {}
    for item in placemark.findall('.//k:Data', ns):
        key = item.attrib.get('name', '')
        data[key] = item.findtext('k:value', default='', namespaces=ns)
    print({'name': name, 'coords': coords, 'description': description[:1500], 'gx_media_links': data.get('gx_media_links', '')})
