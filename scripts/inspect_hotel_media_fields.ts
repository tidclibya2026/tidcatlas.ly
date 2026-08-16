import { readFileSync } from "node:fs";
import { parseKml } from "../server/importParsers";

const result = parseKml(readFileSync("/home/ubuntu/upload/hotels.kml"), { layerId: "hotels", source: "hotels.kml" });
const first = result.rows[0];
const raw = first.metadata.images_json || "";
let parsed: unknown = null;
try { parsed = JSON.parse(raw); } catch { parsed = { parseError: true }; }
const urls = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
console.log(JSON.stringify({ name: first.name, imageCount: first.metadata.image_count, parsedType: Array.isArray(parsed) ? "array" : typeof parsed, parsedLength: Array.isArray(parsed) ? parsed.length : null, urlLengths: urls.map((url) => url.length).slice(0, 5), sourceMediaUrlPrefix: (first.metadata.source_media_url || "").slice(0, 80) }, null, 2));
