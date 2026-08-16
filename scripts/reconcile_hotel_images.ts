import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { atlasImages, atlasPoints } from "../drizzle/schema";
import { extractKmlImageUrls, parseKml } from "../server/importParsers";
import { getDb } from "../server/db";

const db = await getDb();
if (!db) throw new Error("DATABASE_URL is not configured");
const rows = parseKml(readFileSync("/home/ubuntu/upload/hotels.kml"), { layerId: "hotels", source: "hotels.kml" }).rows;
const points = await db.select({ id: atlasPoints.id, fingerprint: atlasPoints.fingerprint }).from(atlasPoints).where(eq(atlasPoints.layerId, "hotels"));
const images = await db.select({ pointId: atlasImages.pointId, imageUrl: atlasImages.imageUrl }).from(atlasImages);
const existing = new Set(images.map((image) => `${image.pointId}|${image.imageUrl}`));
const pointByFingerprint = new Map(points.map((point) => [point.fingerprint, point.id]));
const missing = rows.flatMap((row) => {
  const pointId = pointByFingerprint.get(row.fingerprint);
  if (!pointId) return [];
  return extractKmlImageUrls(row).map((imageUrl, index) => ({ pointId, imageUrl, sourceUrl: imageUrl, sourceKind: "kml" as const, sourceRecordId: row.sourceRecordId, sourceFileName: "hotels.kml", importJobId: 30003, rightsNote: "رابط صورة مستورد من ملف KML؛ يجب مراجعة المصدر وحقوق الاستخدام قبل الاعتماد.", rightsWarning: true, isPrimary: index === 0, reviewStatus: "pending" as const, createdBy: 1 })).filter((image) => !existing.has(`${image.pointId}|${image.imageUrl}`));
});
for (let index = 0; index < missing.length; index += 20) await db.insert(atlasImages).values(missing.slice(index, index + 20));
console.log(JSON.stringify({ hotelPoints: points.length, existingImages: images.length, addedImages: missing.length, sourceImageRows: rows.filter((row) => extractKmlImageUrls(row).length > 0).length }, null, 2));
