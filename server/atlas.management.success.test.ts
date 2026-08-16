import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditLog, backupRecord } = vi.hoisted(() => ({ auditLog: vi.fn(), backupRecord: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: vi.fn(async () => ({ key: "atlas-backups/test/backup.json.gz", url: "/manus-storage/atlas-backups/test/backup.json.gz" })), storageGetSignedUrl: vi.fn() }));
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    updateAtlasPoint: vi.fn(async (id: number, patch: unknown) => ({ id, ...patch })),
    archiveAtlasPoint: vi.fn(async (id: number, duplicateOfId?: number) => ({ id, status: "archived", recordStatus: "archived", duplicateOfId })),
    mergeAtlasPoints: vi.fn(async (primaryId: number, duplicateId: number) => ({ id: primaryId, mergedDuplicateId: duplicateId })),
    createAtlasImage: vi.fn(async (image: unknown) => ({ id: 21, ...(image as object) })),
    updateAtlasImage: vi.fn(async (id: number, patch: unknown) => ({ id, ...(patch as object) })),
    createAuditLog: auditLog,
    getAtlasPoint: vi.fn(async (id: number) => ({ id })),
    listAtlasImages: vi.fn(async () => []),
    listTeamMembers: vi.fn(async () => [{ id: 31, displayName: "مراجع تجريبي", email: "reviewer@example.com", teamRole: "reviewer", status: "pending" }]),
    createTeamMember: vi.fn(async (member: unknown) => ({ id: 31, ...(member as object) })),
    updateTeamMember: vi.fn(async (id: number, patch: unknown) => ({ id, ...(patch as object) })),
    createBackupRecord: vi.fn(async (record: unknown) => { const result = { id: 41, ...(record as object) }; backupRecord.mockReturnValue(result); return result; }),
    updateBackupRecord: vi.fn(async (id: number, patch: unknown) => ({ id, ...(patch as object) })),
    listBackups: vi.fn(async () => []),
    getAtlasDataSnapshot: vi.fn(async () => ({ exportedAt: "test", points: [], images: [], imports: [], teamMembers: [], audits: [] })),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const ctx = (): TrpcContext => ({ user: { id: 7, openId: "admin-test", email: "admin@example.com", name: "Admin", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });

describe("atlas documentation success flows", () => {
  beforeEach(() => auditLog.mockClear());

  it("reviews and publishes a point with an audit record", async () => {
    const result = await appRouter.createCaller(ctx()).atlas.review({ id: 4, recordStatus: "published", reviewNote: "تم التحقق" });
    expect(result).toMatchObject({ id: 4, recordStatus: "published", status: "published" });
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ entityType: "atlas_point", action: "review", actorId: 7 }));
  });

  it("archives a duplicate and records the decision", async () => {
    const result = await appRouter.createCaller(ctx()).atlas.archiveDuplicate({ id: 5, duplicateOfId: 4 });
    expect(result).toMatchObject({ id: 5, recordStatus: "archived", duplicateOfId: 4 });
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "archive_duplicate" }));
  });

  it("merges duplicate points and records the primary id", async () => {
    const result = await appRouter.createCaller(ctx()).atlas.mergeDuplicate({ primaryId: 4, duplicateId: 5 });
    expect(result).toMatchObject({ id: 4, mergedDuplicateId: 5 });
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "merge_duplicate" }));
  });

  it("previews a KML file before committing", async () => {
    const kml = Buffer.from(`<kml><Placemark><name>موقع تجريبي</name><Point><coordinates>14.2,32.6,0</coordinates></Point></Placemark></kml>`).toString("base64");
    const result = await appRouter.createCaller(ctx()).atlas.previewImport({ sourceKind: "kml", fileName: "sample.kml", fileDataBase64: kml, layerId: "heritage" });
    expect(result).toMatchObject({ totalRows: 1, sourceKind: "kml" });
    expect(result.rows[0]).toMatchObject({ name: "موقع تجريبي", layerId: "heritage" });
  });

  it("refuses commit when the import job has no stored file", async () => {
    await expect(appRouter.createCaller(ctx()).atlas.commitImport({ jobId: 9999, sourceKind: "kml", fileName: "missing.kml", layerId: "heritage" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("creates a compressed backup and records administration", async () => {
    const result = await appRouter.createCaller(ctx()).atlas.createBackup();
    expect(result).toMatchObject({ id: 41, status: "completed", storageKey: "atlas-backups/test/backup.json.gz" });
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ entityType: "atlas_backup", action: "create", actorId: 7 }));
  });

  it("creates a documentation team member and records administration", async () => {
    const result = await appRouter.createCaller(ctx()).atlas.createTeamMember({ displayName: "مراجع تجريبي", email: "reviewer@example.com", teamRole: "reviewer", notes: "فريق التوثيق" });
    expect(result).toMatchObject({ id: 31, status: "pending", teamRole: "reviewer" });
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ entityType: "atlas_team_member", action: "create", actorId: 7 }));
    const updated = await appRouter.createCaller(ctx()).atlas.updateTeamMember({ id: 31, patch: { status: "suspended" } });
    expect(updated).toMatchObject({ id: 31, status: "suspended" });
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ entityType: "atlas_team_member", action: "update", actorId: 7 }));
  });

  it("adds and reviews an externally sourced image with rights metadata", async () => {
    const caller = appRouter.createCaller(ctx());
    const image = await caller.atlas.addImage({ pointId: 4, imageUrl: "https://example.com/site.jpg", sourceUrl: "https://example.com/source", sourceKind: "web_page", ownerName: "TIDC", license: "Permission pending", rightsNote: "يجب مراجعة إذن الاستخدام قبل النشر.", rightsWarning: true, isPrimary: true });
    expect(image).toMatchObject({ pointId: 4, sourceKind: "web_page", rightsWarning: true });
<<<<<<< HEAD
    const reviewed = await caller.atlas.reviewImage({ id: 21, reviewStatus: "approved", rightsNote: "تم توثيق المصدر." });
    expect(reviewed).toMatchObject({ id: 21, reviewStatus: "approved" });
=======
    const reviewed = await caller.atlas.reviewImage({ id: 21, reviewStatus: "approved", isPrimary: true, rightsNote: "تم توثيق المصدر." });
    expect(reviewed).toMatchObject({ id: 21, reviewStatus: "approved", isPrimary: true, rightsNote: "تم توثيق المصدر." });
>>>>>>> origin/repair/latest-atlas-2026
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ entityType: "atlas_image", action: "create" }));
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ entityType: "atlas_image", action: "review" }));
  });
});
