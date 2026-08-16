import { and, desc, eq, gt, like, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  atlasAuditLogs,
  atlasBackups,
  atlasComments,
  atlasRatings,
  atlasSuggestions,
  atlasImages,
  atlasImportJobs,
  atlasLayers,
  atlasPoints,
  atlasTeamMembers,
  atlasTop150Reviews,
  InsertAtlasTop150Review,
  InsertAtlasBackup,
  InsertAtlasImage,
  InsertAtlasImportJob,
  InsertAtlasLayer,
  InsertAtlasPoint,
  InsertAtlasAuditLog,
  InsertAtlasComment,
  InsertAtlasRating,
  InsertAtlasSuggestion,
  InsertAtlasTeamMember,
  InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  values.lastSignedIn ??= new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function createLocalUser(input: { email: string; name: string; passwordHash: string; role?: "user" | "admin" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const normalizedEmail = input.email.trim().toLowerCase();
  const openId = `local_${crypto.randomUUID()}`;
  await db.insert(users).values({ openId, email: normalizedEmail, name: input.name.trim(), passwordHash: input.passwordHash, loginMethod: "local", role: input.role ?? "user", isActive: true });
  return getUserByOpenId(openId);
}

export async function updateUserPasswordHash(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function listAtlasLayers(includeArchived = false) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(atlasLayers).where(includeArchived ? undefined : eq(atlasLayers.status, "active")).orderBy(atlasLayers.label);
}

export async function createAtlasLayer(layer: InsertAtlasLayer) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.insert(atlasLayers).values(layer);
  const rows = await db.select().from(atlasLayers).where(eq(atlasLayers.id, layer.id)).limit(1);
  return rows[0];
}

export async function updateAtlasLayer(id: string, patch: Partial<InsertAtlasLayer>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.update(atlasLayers).set(patch).where(eq(atlasLayers.id, id));
  const rows = await db.select().from(atlasLayers).where(eq(atlasLayers.id, id)).limit(1);
  return rows[0];
}

export async function listAtlasPoints(layerId?: string, status?: "draft" | "published" | "archived", createdBy?: number) {
  const db = await getDb();
  if (!db) return [];
  const filters = [
    layerId ? eq(atlasPoints.layerId, layerId) : undefined,
    status ? eq(atlasPoints.status, status) : undefined,
    createdBy ? eq(atlasPoints.createdBy, createdBy) : undefined,
  ].filter(Boolean) as any[];
  return db.select().from(atlasPoints).where(filters.length ? and(...filters) : undefined).orderBy(desc(atlasPoints.createdAt));
}

export async function listReviewQueue(recordStatus?: "draft" | "pending_review" | "approved" | "published" | "rejected" | "archived", filters?: { search?: string; layerId?: string; municipality?: string; category?: string; sort?: "newest" | "oldest" | "name" }) {
  const db = await getDb();
  if (!db) return [];
  const search = filters?.search?.trim();
  const clauses = [
    recordStatus ? eq(atlasPoints.recordStatus, recordStatus) : undefined,
    filters?.layerId ? eq(atlasPoints.layerId, filters.layerId) : undefined,
    filters?.municipality ? like(atlasPoints.municipality, `%${filters.municipality}%`) : undefined,
    filters?.category ? like(atlasPoints.category, `%${filters.category}%`) : undefined,
    search ? or(like(atlasPoints.name, `%${search}%`), like(atlasPoints.nameEn, `%${search}%`), like(atlasPoints.description, `%${search}%`), like(atlasPoints.source, `%${search}%`)) : undefined,
  ].filter(Boolean) as any[];
  const order = filters?.sort === "oldest" ? atlasPoints.createdAt : filters?.sort === "name" ? atlasPoints.name : desc(atlasPoints.updatedAt);
  return db.select().from(atlasPoints).where(clauses.length ? and(...clauses) : undefined).orderBy(order);
}

export async function getAtlasPoint(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(atlasPoints).where(eq(atlasPoints.id, id)).limit(1);
  return rows[0];
}

export async function createAtlasPoint(point: InsertAtlasPoint) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const result = await db.insert(atlasPoints).values(point);
  const id = Number(result[0].insertId);
  return getAtlasPoint(id);
}

export async function createAtlasPointsBatch(points: InsertAtlasPoint[]) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  if (!points.length) return { inserted: 0 };
  await db.insert(atlasPoints).values(points);
  return { inserted: points.length };
}

export async function updateAtlasPoint(id: number, patch: Partial<InsertAtlasPoint>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.update(atlasPoints).set(patch).where(eq(atlasPoints.id, id));
  return getAtlasPoint(id);
}

export async function archiveAtlasPoint(id: number, duplicateOfId?: number) {
  return updateAtlasPoint(id, { status: "archived", recordStatus: "archived", duplicateOfId });
}

export async function listAtlasSuggestions(status: "pending" | "approved" | "rejected" | "archived" = "pending") {
  const db = await getDb();
  if (!db) return [];
  return db.select({ suggestion: atlasSuggestions, pointName: atlasPoints.name, pointLayerId: atlasPoints.layerId, pointLatitude: atlasPoints.latitude, pointLongitude: atlasPoints.longitude })
    .from(atlasSuggestions)
    .leftJoin(atlasPoints, eq(atlasSuggestions.pointId, atlasPoints.id))
    .where(eq(atlasSuggestions.status, status))
    .orderBy(desc(atlasSuggestions.createdAt));
}

export async function createAtlasSuggestion(suggestion: InsertAtlasSuggestion) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const result = await db.insert(atlasSuggestions).values(suggestion);
  const rows = await db.select().from(atlasSuggestions).where(eq(atlasSuggestions.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}

export async function updateAtlasSuggestion(id: number, patch: Partial<InsertAtlasSuggestion>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.update(atlasSuggestions).set(patch).where(eq(atlasSuggestions.id, id));
  const rows = await db.select().from(atlasSuggestions).where(eq(atlasSuggestions.id, id)).limit(1);
  return rows[0];
}

export async function listAtlasImages(pointId?: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(atlasImages)
    .where(pointId ? eq(atlasImages.pointId, pointId) : undefined)
    .orderBy(desc(atlasImages.isPrimary), desc(atlasImages.createdAt));
}

export async function createAtlasImage(image: InsertAtlasImage) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const result = await db.insert(atlasImages).values(image);
  const rows = await db.select().from(atlasImages).where(eq(atlasImages.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}

export async function updateAtlasImage(id: number, patch: Partial<InsertAtlasImage>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.update(atlasImages).set(patch).where(eq(atlasImages.id, id));
  const rows = await db.select().from(atlasImages).where(eq(atlasImages.id, id)).limit(1);
  return rows[0];
}

export async function listAtlasImageReviewQueue() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ image: atlasImages, pointName: atlasPoints.name, pointLayerId: atlasPoints.layerId, pointLatitude: atlasPoints.latitude, pointLongitude: atlasPoints.longitude })
    .from(atlasImages)
    .leftJoin(atlasPoints, eq(atlasImages.pointId, atlasPoints.id))
    .where(eq(atlasImages.reviewStatus, "pending"))
    .orderBy(desc(atlasImages.createdAt));
}

export async function reassignAtlasImage(imageId: number, pointId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const point = await getAtlasPoint(pointId);
  if (!point) throw new Error("النقطة المستهدفة غير موجودة");
  await db.update(atlasImages).set({ pointId, reviewStatus: "pending", reviewedBy: null, reviewedAt: null, rightsWarning: true }).where(eq(atlasImages.id, imageId));
  const rows = await db.select().from(atlasImages).where(eq(atlasImages.id, imageId)).limit(1);
  return rows[0];
}

export async function archiveAtlasImage(id: number, rightsNote: string) {
  return updateAtlasImage(id, { reviewStatus: "rejected", rightsWarning: true, rightsNote });
}

export async function mergeAtlasPoints(primaryId: number, duplicateId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.transaction(async (tx) => {
    await tx.update(atlasImages).set({ pointId: primaryId }).where(eq(atlasImages.pointId, duplicateId));
    await tx.update(atlasPoints).set({ status: "archived", recordStatus: "archived", duplicateOfId: primaryId, reviewNote: "تم دمج السجل مع النقطة الأصلية." }).where(eq(atlasPoints.id, duplicateId));
  });
  return getAtlasPoint(primaryId);
}

export async function findPotentialDuplicatePoints(name: string, latitude: number, longitude: number) {
  const db = await getDb();
  if (!db) return [];
  const delta = 0.0005;
  return db.select().from(atlasPoints).where(and(
    or(eq(atlasPoints.name, name), eq(atlasPoints.fingerprint, name)),
    gt(atlasPoints.latitude, latitude - delta), lt(atlasPoints.latitude, latitude + delta),
    gt(atlasPoints.longitude, longitude - delta), lt(atlasPoints.longitude, longitude + delta),
  )).limit(20);
}

export async function createImportJob(job: InsertAtlasImportJob) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const result = await db.insert(atlasImportJobs).values(job);
  const rows = await db.select().from(atlasImportJobs).where(eq(atlasImportJobs.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}

export async function getImportJob(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(atlasImportJobs).where(eq(atlasImportJobs.id, id)).limit(1);
  return rows[0];
}

export async function listImportJobs(createdBy?: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(atlasImportJobs).where(createdBy ? eq(atlasImportJobs.createdBy, createdBy) : undefined).orderBy(desc(atlasImportJobs.createdAt));
}

export async function updateImportJob(id: number, patch: Partial<InsertAtlasImportJob>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.update(atlasImportJobs).set(patch).where(eq(atlasImportJobs.id, id));
  const rows = await db.select().from(atlasImportJobs).where(eq(atlasImportJobs.id, id)).limit(1);
  return rows[0];
}

export async function listAtlasComments(pointId: number, includePending = false) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: atlasComments.id, pointId: atlasComments.pointId, userId: atlasComments.userId, userName: users.name, body: atlasComments.body, status: atlasComments.status, createdAt: atlasComments.createdAt, updatedAt: atlasComments.updatedAt }).from(atlasComments).leftJoin(users, eq(atlasComments.userId, users.id)).where(and(eq(atlasComments.pointId, pointId), includePending ? undefined : eq(atlasComments.status, "approved"))).orderBy(desc(atlasComments.createdAt));
  return rows;
}

export async function createAtlasComment(comment: InsertAtlasComment) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const result = await db.insert(atlasComments).values(comment);
  const rows = await db.select().from(atlasComments).where(eq(atlasComments.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}

export async function updateAtlasComment(id: number, patch: Partial<InsertAtlasComment>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.update(atlasComments).set(patch).where(eq(atlasComments.id, id));
  const rows = await db.select().from(atlasComments).where(eq(atlasComments.id, id)).limit(1);
  return rows[0];
}

export async function getAtlasRatingSummary(pointId: number, userId?: number) {
  const db = await getDb();
  if (!db) return { average: 0, count: 0, mine: null as number | null };
  const ratings = await db.select().from(atlasRatings).where(eq(atlasRatings.pointId, pointId));
  const total = ratings.reduce((sum, rating) => sum + rating.rating, 0);
  return { average: ratings.length ? Number((total / ratings.length).toFixed(1)) : 0, count: ratings.length, mine: userId ? ratings.find((rating) => rating.userId === userId)?.rating ?? null : null };
}

export async function upsertAtlasRating(pointId: number, userId: number, rating: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const existing = await db.select().from(atlasRatings).where(and(eq(atlasRatings.pointId, pointId), eq(atlasRatings.userId, userId))).limit(1);
  if (existing[0]) await db.update(atlasRatings).set({ rating }).where(eq(atlasRatings.id, existing[0].id));
  else await db.insert(atlasRatings).values({ pointId, userId, rating });
  return getAtlasRatingSummary(pointId, userId);
}

export async function getAtlasComment(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(atlasComments).where(eq(atlasComments.id, id)).limit(1);
  return rows[0];
}

export async function getAtlasDataSnapshot() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const [points, images, imports, teamMembers, audits] = await Promise.all([
    db.select().from(atlasPoints),
    db.select().from(atlasImages),
    db.select().from(atlasImportJobs),
    db.select().from(atlasTeamMembers),
    db.select().from(atlasAuditLogs),
  ]);
  return { exportedAt: new Date().toISOString(), schemaVersion: 1, points, images, imports, teamMembers, audits };
}

export async function createBackupRecord(record: InsertAtlasBackup) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const result = await db.insert(atlasBackups).values(record);
  const rows = await db.select().from(atlasBackups).where(eq(atlasBackups.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}

export async function updateBackupRecord(id: number, patch: Partial<InsertAtlasBackup>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.update(atlasBackups).set(patch).where(eq(atlasBackups.id, id));
  const rows = await db.select().from(atlasBackups).where(eq(atlasBackups.id, id)).limit(1);
  return rows[0];
}

export async function listBackups() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(atlasBackups).orderBy(desc(atlasBackups.createdAt));
}

export async function listTeamMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(atlasTeamMembers).orderBy(desc(atlasTeamMembers.createdAt));
}

export async function getActiveTeamMemberForUser(user: { id: number; email: string | null }) {
  const db = await getDb();
  if (!db) return undefined;
  const conditions = [eq(atlasTeamMembers.status, "active")];
  const identity = user.email ? or(eq(atlasTeamMembers.userId, user.id), eq(atlasTeamMembers.email, user.email)) : eq(atlasTeamMembers.userId, user.id);
  const rows = await db.select().from(atlasTeamMembers).where(and(...conditions, identity)).limit(1);
  return rows[0];
}

export async function createTeamMember(member: InsertAtlasTeamMember) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const result = await db.insert(atlasTeamMembers).values(member);
  const rows = await db.select().from(atlasTeamMembers).where(eq(atlasTeamMembers.id, Number(result[0].insertId))).limit(1);
  return rows[0];
}

export async function updateTeamMember(id: number, patch: Partial<InsertAtlasTeamMember>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.update(atlasTeamMembers).set(patch).where(eq(atlasTeamMembers.id, id));
  const rows = await db.select().from(atlasTeamMembers).where(eq(atlasTeamMembers.id, id)).limit(1);
  return rows[0];
}

export async function createAuditLog(log: InsertAtlasAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(atlasAuditLogs).values(log);
}

export async function listTop150ReviewDecisions(queueVersion: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(atlasTop150Reviews).where(eq(atlasTop150Reviews.queueVersion, queueVersion));
}

export async function upsertTop150ReviewDecision(decision: InsertAtlasTop150Review) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  await db.insert(atlasTop150Reviews).values(decision).onDuplicateKeyUpdate({
    set: {
      candidate: decision.candidate,
      region: decision.region ?? null,
      confirmedName: decision.confirmedName ?? null,
      matchScore: decision.matchScore,
      status: decision.status,
      reviewNote: decision.reviewNote ?? null,
      reviewedBy: decision.reviewedBy ?? null,
      reviewedAt: decision.reviewedAt ?? null,
      sourceReport: decision.sourceReport,
    },
  });
  const rows = await db.select().from(atlasTop150Reviews).where(and(eq(atlasTop150Reviews.queueVersion, decision.queueVersion), eq(atlasTop150Reviews.rank, decision.rank))).limit(1);
  return rows[0];
}
