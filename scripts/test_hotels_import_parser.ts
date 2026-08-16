import { readFileSync } from "node:fs";
import { extractKmlImageUrls, parseKml } from "../server/importParsers";

const buffer = readFileSync("/home/ubuntu/upload/hotels.kml");
const result = parseKml(buffer, { layerId: "hotels", source: "hotels.kml" });
const imageKeys = ["image_count", "images_json", "source_media_url", "gx_media_links", "image_url", "imageUrl"];
const withImages = result.rows.filter((row) => imageKeys.some((key) => Boolean(row.metadata[key])));
const extractedImageUrls = result.rows.map((row) => extractKmlImageUrls(row));
const first = result.rows[0];
console.log(JSON.stringify({
  totalRows: result.totalRows,
  validRows: result.rows.length,
  issues: result.issues.length,
  firstIssue: result.issues[0] ?? null,
  withImageMetadata: withImages.length,
  imageMetadataCounts: Object.fromEntries(imageKeys.map((key) => [key, result.rows.filter((row) => Boolean(row.metadata[key])).length])),
  extractedImageRows: extractedImageUrls.filter((urls) => urls.length > 0).length,
  extractedImageUrlCount: extractedImageUrls.reduce((sum, urls) => sum + urls.length, 0),
  firstExtractedImage: extractedImageUrls[0]?.[0] ?? null,
  firstRow: first ? { name: first.name, latitude: first.latitude, longitude: first.longitude, metadataKeys: Object.keys(first.metadata).filter((key) => imageKeys.includes(key)), imageCount: first.metadata.image_count ?? null, imagesJsonLength: first.metadata.images_json?.length ?? 0, sourceMediaUrlLength: first.metadata.source_media_url?.length ?? 0 } : null,
  lastRow: result.rows.at(-1) ? { name: result.rows.at(-1)!.name, latitude: result.rows.at(-1)!.latitude, longitude: result.rows.at(-1)!.longitude } : null,
}, null, 2));
