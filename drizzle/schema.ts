import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar, double, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
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
  sourceKind: mysqlEnum("sourceKind", ["kml", "excel", "agency", "web_page", "facebook", "other"]).default("other").notNull(),
  sourceRecordId: varchar("sourceRecordId", { length: 255 }),
  metadata: text("metadata"),
  imageUrl: text("imageUrl"),
  imageKey: text("imageKey"),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  recordStatus: mysqlEnum("recordStatus", ["draft", "pending_review", "approved", "published", "rejected", "archived"]).default("draft").notNull(),
  reviewNote: text("reviewNote"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  duplicateOfId: int("duplicateOfId"),
  fingerprint: varchar("fingerprint", { length: 128 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  layerStatusIdx: index("atlas_points_layer_status_idx").on(table.layerId, table.recordStatus),
  coordinatesIdx: index("atlas_points_coordinates_idx").on(table.latitude, table.longitude),
  fingerprintIdx: index("atlas_points_fingerprint_idx").on(table.fingerprint),
}));

export type AtlasPoint = typeof atlasPoints.$inferSelect;
export type InsertAtlasPoint = typeof atlasPoints.$inferInsert;

export const atlasImages = mysqlTable("atlas_images", {
  id: int("id").autoincrement().primaryKey(),
  pointId: int("pointId").notNull(),
  storageKey: text("storageKey"),
  imageUrl: text("imageUrl").notNull(),
  sourceUrl: text("sourceUrl"),
  sourceKind: mysqlEnum("sourceKind", ["agency", "photographer", "web_page", "facebook", "kml", "other"]).default("other").notNull(),
  ownerName: varchar("ownerName", { length: 255 }),
  photographerName: varchar("photographerName", { length: 255 }),
  license: varchar("license", { length: 255 }),
  rightsNote: text("rightsNote").notNull(),
  rightsWarning: boolean("rightsWarning").default(true).notNull(),
  isPrimary: boolean("isPrimary").default(false).notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  pointIdx: index("atlas_images_point_idx").on(table.pointId),
  reviewIdx: index("atlas_images_review_idx").on(table.reviewStatus),
}));

export type AtlasImage = typeof atlasImages.$inferSelect;
export type InsertAtlasImage = typeof atlasImages.$inferInsert;

export const atlasImportJobs = mysqlTable("atlas_import_jobs", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  sourceKind: mysqlEnum("sourceKind", ["kml", "excel"]).notNull(),
  storageKey: text("storageKey"),
  status: mysqlEnum("status", ["uploaded", "processing", "needs_review", "completed", "failed"]).default("uploaded").notNull(),
  totalRows: int("totalRows").default(0).notNull(),
  importedRows: int("importedRows").default(0).notNull(),
  duplicateRows: int("duplicateRows").default(0).notNull(),
  rejectedRows: int("rejectedRows").default(0).notNull(),
  errorSummary: text("errorSummary"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ statusIdx: index("atlas_import_jobs_status_idx").on(table.status) }));

export type AtlasImportJob = typeof atlasImportJobs.$inferSelect;
export type InsertAtlasImportJob = typeof atlasImportJobs.$inferInsert;

export const atlasAuditLogs = mysqlTable("atlas_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: int("entityId").notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  details: text("details"),
  actorId: int("actorId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ entityIdx: index("atlas_audit_entity_idx").on(table.entityType, table.entityId) }));

export type AtlasAuditLog = typeof atlasAuditLogs.$inferSelect;
export type InsertAtlasAuditLog = typeof atlasAuditLogs.$inferInsert;

export const atlasTeamMembers = mysqlTable("atlas_team_members", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  teamRole: mysqlEnum("teamRole", ["reviewer", "editor", "import_manager"]).default("reviewer").notNull(),
  status: mysqlEnum("status", ["active", "suspended", "pending"]).default("pending").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ statusIdx: index("atlas_team_members_status_idx").on(table.status), roleIdx: index("atlas_team_members_role_idx").on(table.teamRole) }));

export type AtlasTeamMember = typeof atlasTeamMembers.$inferSelect;
export type InsertAtlasTeamMember = typeof atlasTeamMembers.$inferInsert;

export const atlasBackups = mysqlTable("atlas_backups", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 700 }),
  status: mysqlEnum("status", ["creating", "completed", "failed"]).default("creating").notNull(),
  sizeBytes: int("sizeBytes"),
  errorSummary: text("errorSummary"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ statusIdx: index("atlas_backups_status_idx").on(table.status), createdAtIdx: index("atlas_backups_created_at_idx").on(table.createdAt) }));

export type AtlasBackup = typeof atlasBackups.$inferSelect;
export type InsertAtlasBackup = typeof atlasBackups.$inferInsert;
