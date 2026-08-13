import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar, double } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const atlasPoints = mysqlTable("atlas_points", {
  id: int("id").autoincrement().primaryKey(),
  layerId: varchar("layerId", { length: 80 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  description: text("description"),
  latitude: double("latitude").notNull(),
  longitude: double("longitude").notNull(),
  municipality: varchar("municipality", { length: 160 }),
  category: varchar("category", { length: 120 }),
  source: varchar("source", { length: 255 }),
  metadata: text("metadata"),
  imageUrl: text("imageUrl"),
  imageKey: text("imageKey"),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  layerStatusIdx: index("atlas_points_layer_status_idx").on(table.layerId, table.status),
  coordinatesIdx: index("atlas_points_coordinates_idx").on(table.latitude, table.longitude),
}));

export type AtlasPoint = typeof atlasPoints.$inferSelect;
export type InsertAtlasPoint = typeof atlasPoints.$inferInsert;