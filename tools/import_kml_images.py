#!/usr/bin/env python3
"""Import image references from KML files.

The default mode is parse-only: it never downloads remote files. Use --download
explicitly to download images into --output-dir. Use --upload-url-template with
pre-signed PUT URLs when an external durable object store is configured.

Example:
  python tools/import_kml_images.py data/site.kml --download \
    --output-dir imported-images --manifest imported-images/manifest.json
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import mimetypes
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urljoin, urlparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

IMAGE_RE = re.compile(r"(?:src|href)\s*=\s*[\"']([^\"']+)[\"']", re.I)
URL_RE = re.compile(r"https?://[^\s<>'\"]+", re.I)
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".tif", ".tiff"}
IMAGE_KEYS = {"image", "image_url", "imageurl", "image_source", "imagesource", "photo", "photo_url", "picture", "pictureurl", "thumbnail", "href", "url"}
AUTHOR_KEYS = {"author", "creator", "photographer", "image_author", "photo_author", "المؤلف", "المصور"}
LICENSE_KEYS = {"license", "licence", "image_license", "photo_license", "الترخيص"}


@dataclass
class ImageRecord:
    site_id: str
    site_name: str
    latitude: float | None
    longitude: float | None
    source_url: str
    author: str | None = None
    license: str | None = None
    license_note: str | None = None
    local_path: str | None = None
    storage_url: str | None = None
    sha256: str | None = None
    content_type: str | None = None
    status: str = "reference_only"
    error: str | None = None


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", html.unescape(value or "")).strip()


def local_name(url: str) -> str:
    name = Path(unquote(urlparse(url).path)).name or "image"
    suffix = Path(name).suffix.lower()
    return name if suffix in IMAGE_EXTENSIONS else f"{name}.jpg"


def property_map(node: ET.Element) -> dict[str, str]:
    values: dict[str, str] = {}
    for data in node.findall(".//{*}Data"):
        key = clean(data.attrib.get("name")).lower()
        value = clean(data.findtext("{*}value"))
        if key and value:
            values[key] = value
    for simple in node.findall(".//{*}SimpleData"):
        key = clean(simple.attrib.get("name")).lower()
        value = clean(simple.text)
        if key and value:
            values[key] = value
    return values


def description_text(node: ET.Element) -> str:
    parts = [node.findtext("{*}description") or ""]
    parts.extend(clean(child.text) for child in node.findall(".//{*}description"))
    return html.unescape(" ".join(parts))


def candidate_urls(node: ET.Element, base_url: str | None) -> list[str]:
    props = property_map(node)
    raw = [description_text(node), node.findtext(".//{*}href") or ""]
    raw.extend(value for key, value in props.items() if key in IMAGE_KEYS or "image" in key or "photo" in key or "picture" in key)
    found: list[str] = []
    for text in raw:
        for match in IMAGE_RE.findall(text) + URL_RE.findall(text):
            value = clean(match).rstrip(").,;]")
            if not value:
                continue
            resolved = urljoin(base_url or "", value)
            extension = Path(urlparse(resolved).path).suffix.lower()
            if extension in IMAGE_EXTENSIONS or any(token in value.lower() for token in ("image", "photo", "picture", "thumbnail")):
                if resolved not in found:
                    found.append(resolved)
    return found


def parse_coordinate(node: ET.Element) -> tuple[float | None, float | None]:
    raw = clean(node.findtext(".//{*}coordinates"))
    if not raw:
        return None, None
    try:
        longitude, latitude, *_ = [float(part) for part in raw.split(",")]
        return latitude, longitude
    except (TypeError, ValueError):
        return None, None


def parse_kml(path: Path, base_url: str | None = None) -> list[ImageRecord]:
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError:
        try:
            from lxml import etree  # type: ignore
        except ImportError as exc:
            raise ValueError(f"Malformed KML and lxml is unavailable: {path}") from exc
        parser = etree.XMLParser(recover=True, huge_tree=True)
        root = etree.fromstring(path.read_bytes(), parser=parser)
    records: list[ImageRecord] = []
    for index, node in enumerate(root.findall(".//{*}Placemark")):
        name = clean(node.findtext("{*}name")) or f"موقع {index + 1}"
        props = property_map(node)
        lat, lng = parse_coordinate(node)
        urls = candidate_urls(node, base_url)
        if not urls:
            continue
        author = next((value for key, value in props.items() if key in AUTHOR_KEYS), None)
        license_name = next((value for key, value in props.items() if key in LICENSE_KEYS), None)
        note = props.get("license_note") or props.get("image_license_note")
        for image_index, source_url in enumerate(urls):
            records.append(ImageRecord(f"{path.stem}-{index}-{image_index}", name, lat, lng, source_url, author, license_name, note))
    return records


def download(record: ImageRecord, output_dir: Path, timeout: int, allowed_hosts: set[str]) -> None:
    parsed = urlparse(record.source_url)
    if parsed.scheme not in {"http", "https"}:
        record.status, record.error = "skipped", "unsupported URL scheme"
        return
    if allowed_hosts and parsed.hostname not in allowed_hosts:
        record.status, record.error = "blocked", "host is not in --allow-host"
        return
    try:
        request = Request(record.source_url, headers={"User-Agent": "Libya-Tourist-Atlas-KML-Importer/1.0"})
        with urlopen(request, timeout=timeout) as response:
            content = response.read()
            content_type = response.headers.get_content_type() if response.headers else None
        if not content:
            raise ValueError("empty response")
        digest = hashlib.sha256(content).hexdigest()
        suffix = Path(local_name(record.source_url)).suffix or mimetypes.guess_extension(content_type or "") or ".jpg"
        target = output_dir / f"{digest[:16]}{suffix.lower()}"
        target.write_bytes(content)
        record.local_path = str(target)
        record.sha256 = digest
        record.content_type = content_type or mimetypes.guess_type(str(target))[0]
        record.status = "downloaded"
    except Exception as exc:  # network and malformed sources are recorded per item
        record.status, record.error = "error", str(exc)


def upload_presigned(record: ImageRecord, template: str, timeout: int) -> None:
    if not record.local_path or record.status != "downloaded":
        return
    key = Path(record.local_path).name
    upload_url = template.format(key=key, filename=key)
    try:
        data = Path(record.local_path).read_bytes()
        request = Request(upload_url, data=data, method="PUT", headers={"Content-Type": record.content_type or "application/octet-stream"})
        with urlopen(request, timeout=timeout) as response:
            if response.status >= 300:
                raise ValueError(f"upload returned HTTP {response.status}")
        record.storage_url = upload_url.split("?", 1)[0]
    except Exception as exc:
        record.status, record.error = "upload_error", str(exc)


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract and optionally import image references from KML files.")
    parser.add_argument("kml", nargs="+", type=Path, help="KML files to inspect")
    parser.add_argument("--base-url", help="Base URL used for relative image references")
    parser.add_argument("--download", action="store_true", help="Explicitly download remote images")
    parser.add_argument("--output-dir", type=Path, default=Path("imported-images"))
    parser.add_argument("--manifest", type=Path, default=Path("imported-images/manifest.json"))
    parser.add_argument("--allow-host", action="append", default=[], help="Allowed download host; repeat for multiple hosts")
    parser.add_argument("--upload-url-template", help="Optional pre-signed PUT URL template, e.g. https://storage/upload/{key}?token=...")
    parser.add_argument("--timeout", type=int, default=20)
    args = parser.parse_args()

    records: list[ImageRecord] = []
    for path in args.kml:
        if not path.exists():
            print(f"warning: missing file: {path}", file=sys.stderr)
            continue
        records.extend(parse_kml(path, args.base_url))
    if args.download:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        allowed = set(args.allow_host)
        for record in records:
            download(record, args.output_dir, args.timeout, allowed)
            if args.upload_url_template:
                upload_presigned(record, args.upload_url_template, args.timeout)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps({"version": 1, "records": [asdict(record) for record in records]}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"records": len(records), "manifest": str(args.manifest), "downloaded": sum(record.status == "downloaded" for record in records)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
