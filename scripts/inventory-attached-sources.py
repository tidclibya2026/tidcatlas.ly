from __future__ import annotations
import json, re, sys
from pathlib import Path
from xml.etree import ElementTree as ET

files = [Path('/home/ubuntu/upload/atlasnatrual.geojson'), Path('/home/ubuntu/upload/atlasnatrual-with-media.geojson'), Path('/home/ubuntu/upload/اكاكوس.kml'), Path('/home/ubuntu/upload/المدينةالقديمة_طرابلس.kml'), Path('/home/ubuntu/upload/المشاريعوفرصالاستثمارالسياحي.kml'), Path('/home/ubuntu/upload/مواقعالتراثالعالميالخمسة_LY.kml')]

def flatten_text(value):
    if value is None: return ''
    return re.sub(r'<[^>]+>', ' ', str(value)).strip()

def geojson_summary(path):
    obj = json.loads(path.read_text(encoding='utf-8'))
    features = obj.get('features', [])
    rows=[]
    key_counts={}
    source_types={}
    for f in features:
        p=f.get('properties') or {}
        g=f.get('geometry') or {}
        coords=g.get('coordinates') or []
        if g.get('type') == 'Point' and len(coords)>=2:
            lon,lat=coords[:2]
        else:
            lon=lat=None
        media_keys=[k for k in p if any(token in k.lower() for token in ('image','photo','media','url','source','author','license'))]
        for k in p: key_counts[k]=key_counts.get(k,0)+1
        source_value=p.get('source') or p.get('source_type')
        if source_value: source_types[str(source_value)]=source_types.get(str(source_value),0)+1
        rows.append({'name': p.get('name') or p.get('Name') or p.get('اسم') or p.get('اسم الموقع'), 'lat':lat,'lon':lon,'mediaKeys':media_keys})
    print(json.dumps({'file':path.name,'type':'GeoJSON','count':len(features),'sample':rows[:5],'mediaPropertyCount':sum(bool(r['mediaKeys']) for r in rows),'sourceTypes':source_types,'propertyKeys':sorted(key_counts)}, ensure_ascii=False))

def kml_summary(path):
    text=path.read_text(encoding='utf-8', errors='replace')
    placemarks=[]
    data_names={}
    try:
        root=ET.fromstring(text)
        blocks=[]
        for pm in root.iter():
            if pm.tag.split('}')[-1] == 'Placemark': blocks.append(ET.tostring(pm, encoding='unicode'))
    except ET.ParseError:
        blocks=re.findall(r'<(?:[A-Za-z0-9_:-]+:)?Placemark\b[\s\S]*?</(?:[A-Za-z0-9_:-]+:)?Placemark>', text, flags=re.I)
    for block in blocks:
        def tag_text(tag):
            match=re.search(r'<(?:[A-Za-z0-9_:-]+:)?'+tag+r'\b[^>]*>([\s\S]*?)</(?:[A-Za-z0-9_:-]+:)?'+tag+r'>', block, flags=re.I)
            return re.sub(r'<[^>]+>', ' ', match.group(1)).strip() if match else ''
        name=tag_text('name'); coords=tag_text('coordinates'); desc=tag_text('description')
        for field, value in re.findall(r'<(?:[A-Za-z0-9_:-]+:)?Data[^>]+name=["\']([^"\']+)["\'][^>]*>[\s\S]*?<value[^>]*>([\s\S]*?)</value>', block, flags=re.I):
            data_names[field]=data_names.get(field,0)+1
        media=len(re.findall(r'https?://[^\s"<>]+(?:jpg|jpeg|png|webp)', desc, flags=re.I))
        inline_images=len(re.findall(r'<img\\s+[^>]*src=["\']([^"\']+)', desc, flags=re.I))
        placemarks.append({'name':flatten_text(name),'coordinates':coords[:120],'descriptionLength':len(desc),'mediaRefs':media,'inlineImages':inline_images})
    print(json.dumps({'file':path.name,'type':'KML','count':len(placemarks),'mediaPlacemarkCount':sum(p['mediaRefs']>0 or p['inlineImages']>0 for p in placemarks),'dataFieldCounts':data_names,'sample':placemarks[:5]}, ensure_ascii=False))

for path in files:
    if path.suffix.lower()=='.geojson': geojson_summary(path)
    else: kml_summary(path)
