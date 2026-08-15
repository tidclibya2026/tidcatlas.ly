from __future__ import annotations
import json, re
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT=Path('/home/ubuntu/libya-tourism-atlas-app/docs/source-imports/2026-08-14')
OUT=Path('/home/ubuntu/libya-tourism-atlas-app/docs/normalized-attached-sources-2026-08-14.jsonl')
SOURCES=list(ROOT.glob('*'))

def clean(value):
    if value is None: return ''
    value=re.sub(r'<[^>]+>', ' ', str(value))
    return re.sub(r'\s+', ' ', value).strip()

def first_prop(props, keys):
    for k in keys:
        if props.get(k) not in (None, ''): return props[k]
    return ''

def geojson(path):
    obj=json.loads(path.read_text(encoding='utf-8'))
    for index, feature in enumerate(obj.get('features', []), 1):
        props=feature.get('properties') or {}
        geom=feature.get('geometry') or {}
        coords=geom.get('coordinates') or []
        lat=lon=None
        if geom.get('type')=='Point' and len(coords)>=2:
            lon,lat=float(coords[0]),float(coords[1])
        name=clean(first_prop(props,['name','Name','اسم','اسم الموقع']))
        yield {'sourceFile':path.name,'sourceType':'geojson','sourceRecordId':str(props.get('id') or index),'name':name,'nameEn':clean(props.get('name_en')),'description':clean(first_prop(props,['description','description_enriched'])),'category':clean(first_prop(props,['primary_category','category_enriched','all_categories'])),'municipality':clean(first_prop(props,['locality_ar','municipality','municipality_name'])),'latitude':lat,'longitude':lon,'source':clean(first_prop(props,['source','origin'])),'sourceKind':'custom','metadata':{str(k):str(v) for k,v in props.items() if k not in {'name','Name','اسم','اسم الموقع','description','description_enriched','primary_category','category_enriched','all_categories'}},'media':{'images':props.get('images') or props.get('images_json') or [],'mediaStatus':props.get('media_status'),'mediaMatchType':props.get('media_match_type')}}

def kml(path):
    text=path.read_text(encoding='utf-8', errors='replace')
    try:
        root=ET.fromstring(text)
        blocks=[ET.tostring(pm,encoding='unicode') for pm in root.iter() if pm.tag.split('}')[-1]=='Placemark']
    except ET.ParseError:
        blocks=re.findall(r'<(?:[A-Za-z0-9_:-]+:)?Placemark\b[\s\S]*?</(?:[A-Za-z0-9_:-]+:)?Placemark>',text,flags=re.I)
    for index,block in enumerate(blocks,1):
        def tag(tag):
            m=re.search(r'<(?:[A-Za-z0-9_:-]+:)?'+tag+r'\b[^>]*>([\s\S]*?)</(?:[A-Za-z0-9_:-]+:)?'+tag+r'>',block,flags=re.I)
            return m.group(1).strip() if m else ''
        name=clean(tag('name')); desc=tag('description'); coords=clean(tag('coordinates'))
        first_coord=coords.split()[0].split(',') if coords else []
        lon=float(first_coord[0]) if len(first_coord)>1 and first_coord[0] else None
        lat=float(first_coord[1]) if len(first_coord)>1 and first_coord[1] else None
        plain=clean(desc)
        images=re.findall(r'<img\s+[^>]*src=["\']([^"\']+)',desc,flags=re.I)
        urls=re.findall(r'https?://[^\s"<>]+',desc,flags=re.I)
        category=''
        m=re.search(r'(?:التصنيف|Category)\s*:\s*([^<\n]+)',plain,flags=re.I)
        if m: category=clean(m.group(1))
        yield {'sourceFile':path.name,'sourceType':'kml','sourceRecordId':str(index),'name':name,'nameEn':'','description':plain,'category':category,'municipality':'','latitude':lat,'longitude':lon,'source':path.name,'sourceKind':'kml','metadata':{'rawCoordinate':coords},'media':{'images':list(dict.fromkeys(images)),'urls':list(dict.fromkeys(urls))}}

records=[]
for path in SOURCES:
    if path.suffix.lower()=='.geojson': records.extend(geojson(path))
    elif path.suffix.lower()=='.kml': records.extend(kml(path))
with OUT.open('w',encoding='utf-8') as f:
    for record in records: f.write(json.dumps(record,ensure_ascii=False)+'\n')
keys={}
for r in records:
    key=(r['name'].casefold(),round(r['latitude'],5) if r['latitude'] is not None else None,round(r['longitude'],5) if r['longitude'] is not None else None)
    keys[key]=keys.get(key,0)+1
summary={'records':len(records),'uniqueNameCoordinateKeys':len(keys),'duplicateGroups':sum(1 for n in keys.values() if n>1),'geojsonRecords':sum(r['sourceType']=='geojson' for r in records),'kmlRecords':sum(r['sourceType']=='kml' for r in records),'recordsWithImages':sum(bool(r['media']['images']) for r in records)}
Path(str(OUT)+'.summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
