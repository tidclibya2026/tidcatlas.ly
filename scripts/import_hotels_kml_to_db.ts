import { readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import { atlasImages, atlasImportJobs, atlasLayers, atlasPoints } from "../drizzle/schema";
import { extractKmlImageUrls, parseKml } from "../server/importParsers";
import { getDb } from "../server/db";

const fileName = "hotels.kml";
const layerId = "hotels";
const createdBy = 1;
const CHUNK_SIZE = 20;
const db = await getDb();
if (!db) throw new Error("DATABASE_URL is not configured");
const parsed = parseKml(readFileSync("/home/ubuntu/upload/hotels.kml"), { layerId, source: fileName });
const existing = await db.select({ fingerprint: atlasPoints.fingerprint }).from(atlasPoints).where(eq(atlasPoints.layerId, layerId));
const known = new Set(existing.map((row) => row.fingerprint).filter((value): value is string => Boolean(value)));
const uniqueRows = parsed.rows.filter((row) => {
  if (known.has(row.fingerprint)) return false;
  known.add(row.fingerprint);
  return true;
});
await db.insert(atlasLayers).values({ id: layerId, label: "الفنادق", description: "الفنادق والمنشآت الفندقية في ليبيا", color: "#b7791f", icon: "building-2", status: "active", createdBy }).onDuplicateKeyUpdate({ set: { label: "الفنادق", description: "الفنادق والمنشآت الفندقية في ليبيا", color: "#b7791f", icon: "building-2", status: "active" } });
const jobResult = await db.insert(atlasImportJobs).values({ fileName, sourceKind: "kml", status: "needs_review", totalRows: parsed.totalRows, importedRows: uniqueRows.length, duplicateRows: parsed.rows.length - uniqueRows.length, rejectedRows: parsed.issues.length, errorSummary: parsed.issues.length ? JSON.stringify(parsed.issues.slice(0, 100)) : null, createdBy });
const importJobId = Number(jobResult[0].insertId);
const insertChunks = async <T,>(table: any, values: T[]) => {
  for (let index = 0; index < values.length; index += CHUNK_SIZE) await db.insert(table).values(values.slice(index, index + CHUNK_SIZE));
};
const pointValues = uniqueRows.map((row) => ({ layerId, name: row.name, nameEn: row.nameEn, description: row.description, latitude: row.latitude, longitude: row.longitude, municipality: row.municipality, category: row.category?.slice(0, 120), source: fileName, sourceKind: "kml" as const, sourceRecordId: row.sourceRecordId, metadata: JSON.stringify(row.metadata), imageUrl: null, imageKey: null, status: "draft" as const, recordStatus: "pending_review" as const, fingerprint: row.fingerprint, createdBy }));
await insertChunks(atlasPoints, pointValues);
const importedPoints = uniqueRows.length ? await db.select({ id: atlasPoints.id, fingerprint: atlasPoints.fingerprint }).from(atlasPoints).where(inArray(atlasPoints.fingerprint, uniqueRows.map((row) => row.fingerprint))) : [];
const pointByFingerprint = new Map(importedPoints.map((point) => [point.fingerprint, point.id]));
const images = uniqueRows.flatMap((row) => {
  const pointId = pointByFingerprint.get(row.fingerprint);
  if (!pointId) return [];
  return extractKmlImageUrls(row).map((imageUrl, index) => ({ pointId, imageUrl, sourceUrl: imageUrl, sourceKind: "kml" as const, sourceRecordId: row.sourceRecordId, sourceFileName: fileName, importJobId, rightsNote: "رابط صورة مستورد من ملف KML؛ يجب مراجعة المصدر وحقوق الاستخدام قبل الاعتماد.", rightsWarning: true, isPrimary: index === 0, reviewStatus: "pending" as const, createdBy }));
});
await insertChunks(atlasImages, images);
console.log(JSON.stringify({ layerId, importJobId, totalRows: parsed.totalRows, insertedHotels: uniqueRows.length, skippedDuplicates: parsed.rows.length - uniqueRows.length, importedImages: images.length, imageRows: uniqueRows.filter((row) => extractKmlImageUrls(row).length > 0).length, rejectedRows: parsed.issues.length }, null, 2));
