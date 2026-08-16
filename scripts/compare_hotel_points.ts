import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { atlasPoints } from "../drizzle/schema";
import { getDb } from "../server/db";
import { parseKml } from "../server/importParsers";

const db = await getDb();
if (!db) throw new Error("DATABASE_URL is not configured");
const source = parseKml(readFileSync("/home/ubuntu/upload/hotels.kml"), { layerId: "hotels", source: "hotels.kml" }).rows;
const target = await db.select({ fingerprint: atlasPoints.fingerprint, name: atlasPoints.name }).from(atlasPoints).where(eq(atlasPoints.layerId, "hotels"));
const targetSet = new Set(target.map((row) => row.fingerprint));
const sourceCounts = new Map<string, { name: string; count: number }>();
for (const row of source) { const current = sourceCounts.get(row.fingerprint) ?? { name: row.name, count: 0 }; current.count += 1; sourceCounts.set(row.fingerprint, current); }
const duplicateGroups = [...sourceCounts.values()].filter((row) => row.count > 1);
const missing = source.filter((row) => !targetSet.has(row.fingerprint));
console.log(JSON.stringify({ sourcePlacemarkRows: source.length, sourceUniqueFingerprints: sourceCounts.size, sourceDuplicateRows: source.length - sourceCounts.size, duplicateGroups: duplicateGroups.length, targetHotelPoints: target.length, missingUniquePoints: [...sourceCounts.keys()].filter((fingerprint) => !targetSet.has(fingerprint)).length, missingNames: missing.slice(0, 60).map((row) => row.name), duplicateExamples: duplicateGroups.slice(0, 20) }, null, 2));
