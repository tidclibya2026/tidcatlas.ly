import { listAtlasImages, listAtlasPoints, mergeAtlasPoints, createAuditLog } from "../server/db";

type Point = Awaited<ReturnType<typeof listAtlasPoints>>[number];

type Group = { primary: Point; duplicates: Point[]; distanceMeters: number[] };

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/^(فندق|hotel|the)\s+/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function distanceMeters(a: Point, b: Point) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function completeness(point: Point, imageCount: number) {
  const metadataLength = point.metadata?.length ?? 0;
  return imageCount * 10000 + metadataLength + (point.description?.length ?? 0) + (point.nameEn ? 500 : 0) + (point.sourceRecordId ? 100 : 0);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const allPoints = (await listAtlasPoints("hotels")).filter((point) => point.recordStatus !== "archived");
  const allImages = await listAtlasImages();
  const imageCounts = new Map<number, number>();
  for (const image of allImages) imageCounts.set(image.pointId, (imageCounts.get(image.pointId) ?? 0) + 1);

  const byName = new Map<string, Point[]>();
  for (const point of allPoints) {
    const key = normalizeName(point.nameEn || point.name);
    if (!key) continue;
    const bucket = byName.get(key) ?? [];
    bucket.push(point);
    byName.set(key, bucket);
  }

  const groups: Group[] = [];
  for (const candidates of byName.values()) {
    if (candidates.length < 2) continue;
    const remaining = [...candidates];
    while (remaining.length > 1) {
      const seed = remaining.shift()!;
      const near = remaining.filter((candidate) => distanceMeters(seed, candidate) <= 500);
      if (!near.length) continue;
      const cluster = [seed, ...near];
      for (const item of near) remaining.splice(remaining.indexOf(item), 1);
      cluster.sort((a, b) => completeness(b, imageCounts.get(b.id) ?? 0) - completeness(a, imageCounts.get(a.id) ?? 0));
      const primary = cluster[0];
      const duplicates = cluster.slice(1);
      groups.push({ primary, duplicates, distanceMeters: duplicates.map((item) => distanceMeters(primary, item)) });
    }
  }

  const plannedMerges = groups.reduce((count, group) => count + group.duplicates.length, 0);
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", activeHotels: allPoints.length, duplicateGroups: groups.length, plannedMerges }, null, 2));
  for (const group of groups) {
    console.log(`GROUP primary=${group.primary.id} ${group.primary.name} images=${imageCounts.get(group.primary.id) ?? 0} duplicates=${group.duplicates.map((item, index) => `${item.id}:${item.name}:${Math.round(group.distanceMeters[index])}m:images=${imageCounts.get(item.id) ?? 0}`).join(", ")}`);
  }

  if (!apply) return;
  const actorId = Number(process.env.ATLAS_MERGE_ACTOR_ID || 1);
  for (const group of groups) {
    for (const duplicate of group.duplicates) {
      await mergeAtlasPoints(group.primary.id, duplicate.id);
      await createAuditLog({ entityType: "atlas_point", entityId: duplicate.id, action: "merge_duplicate", details: JSON.stringify({ primaryId: group.primary.id, reason: "hotel name and coordinates within 500m", movedImages: true }), actorId });
    }
  }
  console.log(`Applied ${plannedMerges} hotel merges; images were reassigned to primary points and duplicates archived.`);
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exitCode = 1; });
