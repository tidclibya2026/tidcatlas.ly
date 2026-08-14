import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertAtlasPoint, InsertUser, atlasPoints, users } from "../drizzle/schema";
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

export async function createAtlasPoint(point: InsertAtlasPoint) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const result = await db.insert(atlasPoints).values(point);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(atlasPoints).where(eq(atlasPoints.id, id)).limit(1);
  return rows[0];
}
