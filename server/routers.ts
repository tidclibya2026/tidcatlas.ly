import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { archiveAtlasImage, archiveAtlasPoint, createAtlasImage, createAtlasPoint, createAtlasPointsBatch, createAuditLog, createImportJob, findPotentialDuplicatePoints, getAtlasPoint, getImportJob, listAtlasImages, getAtlasDataSnapshot, listAtlasPoints, listBackups, listImportJobs, listReviewQueue, listTeamMembers, mergeAtlasPoints, createBackupRecord, createTeamMember, updateBackupRecord, updateTeamMember, updateAtlasImage, updateAtlasPoint, updateImportJob } from "./db";
import { parseExcel, parseKml, type ImportRow } from "./importParsers";
import { storageGetSignedUrl, storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";

const assistantSiteInput = z.object({
  id: z.string().max(160),
  name: z.string().max(255),
  description: z.string().max(4000).optional(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  layerId: z.string().max(80),
  category: z.string().max(160).optional(),
  municipality: z.string().max(160).optional(),
  source: z.string().min(1).max(255),
});

const assistantContext = z.object({
  question: z.string().min(2).max(1200),
  mode: z.enum(["researcher", "tourist", "visitor"]).default("visitor"),
});

async function getVerifiedAssistantSites() {
  const rows = await listAtlasPoints(undefined, "published");
  return rows.slice(0, 120).map((row) => ({
    id: String(row.id), name: row.name, description: row.description || "", latitude: Number(row.latitude), longitude: Number(row.longitude),
    layerId: row.layerId, category: row.category || undefined, municipality: row.municipality || undefined, source: row.source || "سجل منشور في أطلس ليبيا السياحي",
  }));
}

const pointInput = z.object({
  layerId: z.string().min(1).max(80),
  name: z.string().min(1).max(255),
  nameEn: z.string().max(255).optional(),
  description: z.string().max(10000).optional(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  municipality: z.string().max(160).optional(),
  category: z.string().max(120).optional(),
  source: z.string().max(255).optional(),
  sourceKind: z.enum(["kml", "excel", "agency", "web_page", "facebook", "other"]).optional(),
  sourceRecordId: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  imageDataUrl: z.string().max(8_000_000).optional(),
  imageFileName: z.string().max(180).optional(),
  imageContentType: z.string().max(120).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  atlas: router({
    smartSearch: publicProcedure.input(assistantContext).mutation(async ({ input }) => {
      const sites = await getVerifiedAssistantSites();
      if (!sites.length) throw new TRPCError({ code: "BAD_REQUEST", message: "لا توجد سجلات منشورة كافية للبحث الذكي." });
      const response = await invokeLLM({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: "أنت مساعد بحث جغرافي لمشروع أطلس ليبيا السياحي. أجب بالعربية اعتمادًا حصريًا على سجلات المواقع المرفقة. لا تخترع مواقع أو أرقامًا أو مصادر. إذا لم تكفِ البيانات، صرّح بذلك بوضوح. أعد JSON فقط." },
          { role: "user", content: `نمط المستخدم: ${input.mode}\nالسؤال: ${input.question}\nسجلات الأطلس المتاحة:\n${JSON.stringify(sites)}` },
        ],
        reasoning: { effort: "low" },
        response_format: { type: "json_schema", json_schema: { name: "atlas_search", strict: true, schema: { type: "object", properties: { answer: { type: "string" }, matchedIds: { type: "array", items: { type: "string" } }, sources: { type: "array", items: { type: "string" } }, confidence: { type: "string", enum: ["high", "medium", "low"] }, limitation: { type: "string" } }, required: ["answer", "matchedIds", "sources", "confidence", "limitation"], additionalProperties: false } } },
        maxTokens: 1600,
      });
      const content = response.choices[0]?.message.content;
      const raw = typeof content === "string" ? content : content?.map((part) => part.type === "text" ? part.text : "").join("") || "{}";
      const parsed = JSON.parse(raw) as { answer: string; matchedIds: string[]; sources: string[]; confidence: "high" | "medium" | "low"; limitation: string };
      const validIds = new Set(sites.map((site) => site.id));
      const validSources = new Set(sites.flatMap((site) => [site.name, site.source].filter(Boolean) as string[]));
      return { ...parsed, matchedIds: parsed.matchedIds.filter((id) => validIds.has(id)), sources: parsed.sources.filter((source) => validSources.has(source)) };
    }),
    routePlan: publicProcedure.input(z.object({ mode: z.enum(["researcher", "tourist", "visitor"]), startName: z.string().max(255).optional(), durationHours: z.number().min(1).max(120), interests: z.array(z.string().max(120)).max(8) })).mutation(async ({ input }) => {
      const sites = (await getVerifiedAssistantSites()).slice(0, 80);
      if (sites.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "يحتاج المسار إلى سجلين منشورين على الأقل." });
      const response = await invokeLLM({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: "أنت مخطط مسارات جغرافية لمشروع أطلس ليبيا السياحي. استخدم المواقع المرفقة فقط، ولا تضف أي موقع غير موجود. رتّب محطات منطقية حسب نمط المستخدم والاهتمامات والوقت، واذكر أن الترتيب تقريبي ما لم تتوفر شبكة طرق. أعد JSON فقط." },
          { role: "user", content: `النمط: ${input.mode}\nنقطة البداية: ${input.startName || "غير محددة"}\nالمدة بالساعات: ${input.durationHours}\nالاهتمامات: ${input.interests.join(", ") || "استكشاف عام"}\nالمواقع الموثقة:\n${JSON.stringify(sites)}` },
        ],
        reasoning: { effort: "low" },
        response_format: { type: "json_schema", json_schema: { name: "atlas_route", strict: true, schema: { type: "object", properties: { title: { type: "string" }, orderedIds: { type: "array", items: { type: "string" } }, rationale: { type: "string" }, warnings: { type: "array", items: { type: "string" } } }, required: ["title", "orderedIds", "rationale", "warnings"], additionalProperties: false } } },
        maxTokens: 1400,
      });
      const content = response.choices[0]?.message.content;
      const raw = typeof content === "string" ? content : content?.map((part) => part.type === "text" ? part.text : "").join("") || "{}";
      const parsed = JSON.parse(raw) as { title: string; orderedIds: string[]; rationale: string; warnings: string[] };
      const validIds = new Set(sites.map((site) => site.id));
      return { ...parsed, orderedIds: parsed.orderedIds.filter((id) => validIds.has(id)) };
    }),
    published: publicProcedure
      .input(z.object({ layerId: z.string().max(80).optional() }).optional())
      .query(({ input }) => listAtlasPoints(input?.layerId, "published")),
    mine: protectedProcedure.query(({ ctx }) => listAtlasPoints(undefined, undefined, ctx.user.id)),
    reviewQueue: adminProcedure.input(z.object({ recordStatus: z.enum(["draft", "pending_review", "approved", "published", "rejected", "archived"]).optional() }).optional()).query(({ input }) => listReviewQueue(input?.recordStatus)),
    pointDetails: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => ({ point: await getAtlasPoint(input.id), images: await listAtlasImages(input.id) })),
    findDuplicates: adminProcedure.input(z.object({ name: z.string().min(1).max(255), latitude: z.number(), longitude: z.number() })).query(({ input }) => findPotentialDuplicatePoints(input.name, input.latitude, input.longitude)),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), patch: pointInput.partial() })).mutation(async ({ input, ctx }) => {
      const patch = { ...input.patch, metadata: input.patch.metadata ? JSON.stringify(input.patch.metadata) : undefined };
      const updated = await updateAtlasPoint(input.id, patch);
      await createAuditLog({ entityType: "atlas_point", entityId: input.id, action: "update", details: JSON.stringify(input.patch), actorId: ctx.user.id });
      return updated;
    }),
    review: adminProcedure.input(z.object({ id: z.number().int().positive(), recordStatus: z.enum(["draft", "pending_review", "approved", "published", "rejected", "archived"]), reviewNote: z.string().max(4000).optional() })).mutation(async ({ input, ctx }) => {
      const updated = await updateAtlasPoint(input.id, { recordStatus: input.recordStatus, status: input.recordStatus === "published" ? "published" : input.recordStatus === "archived" ? "archived" : "draft", reviewNote: input.reviewNote, reviewedBy: ctx.user.id, reviewedAt: new Date() });
      await createAuditLog({ entityType: "atlas_point", entityId: input.id, action: "review", details: JSON.stringify({ recordStatus: input.recordStatus, reviewNote: input.reviewNote }), actorId: ctx.user.id });
      return updated;
    }),
    archiveDuplicate: adminProcedure.input(z.object({ id: z.number().int().positive(), duplicateOfId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const updated = await archiveAtlasPoint(input.id, input.duplicateOfId);
      await createAuditLog({ entityType: "atlas_point", entityId: input.id, action: "archive_duplicate", details: JSON.stringify({ duplicateOfId: input.duplicateOfId }), actorId: ctx.user.id });
      return updated;
    }),
    mergeDuplicate: adminProcedure.input(z.object({ primaryId: z.number().int().positive(), duplicateId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      if (input.primaryId === input.duplicateId) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن دمج النقطة مع نفسها" });
      const primary = await mergeAtlasPoints(input.primaryId, input.duplicateId);
      await createAuditLog({ entityType: "atlas_point", entityId: input.duplicateId, action: "merge_duplicate", details: JSON.stringify({ primaryId: input.primaryId }), actorId: ctx.user.id });
      return primary;
    }),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().min(3).max(4000) })).mutation(async ({ input, ctx }) => {
      const updated = await archiveAtlasPoint(input.id);
      await createAuditLog({ entityType: "atlas_point", entityId: input.id, action: "archive", details: JSON.stringify({ reason: input.reason }), actorId: ctx.user.id });
      return updated;
    }),
    archiveImage: adminProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().min(3).max(4000) })).mutation(async ({ input, ctx }) => {
      const image = await archiveAtlasImage(input.id, input.reason);
      await createAuditLog({ entityType: "atlas_image", entityId: input.id, action: "archive", details: JSON.stringify({ reason: input.reason }), actorId: ctx.user.id });
      return image;
    }),
    addImage: adminProcedure.input(z.object({ pointId: z.number().int().positive(), imageUrl: z.string().url().optional(), imageDataUrl: z.string().max(8_000_000).optional(), fileName: z.string().max(180).optional(), contentType: z.string().max(120).optional(), sourceUrl: z.string().url().optional(), sourceKind: z.enum(["agency", "photographer", "web_page", "facebook", "kml", "other"]), ownerName: z.string().max(255).optional(), photographerName: z.string().max(255).optional(), license: z.string().max(255).optional(), rightsNote: z.string().min(3).max(4000), rightsWarning: z.boolean().default(true), isPrimary: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
      let imageUrl = input.imageUrl;
      let storageKey: string | undefined;
      if (input.imageDataUrl) {
        const match = input.imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة الصورة غير صالحة" });
        const extension = (input.fileName?.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
        const stored = await storagePut(`atlas-images/${ctx.user.id}/${crypto.randomUUID()}.${extension}`, Buffer.from(match[2], "base64"), input.contentType || match[1]);
        imageUrl = stored.url; storageKey = stored.key;
      }
      if (!imageUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب توفير ملف الصورة أو رابطها" });
      const image = await createAtlasImage({ pointId: input.pointId, imageUrl, storageKey, sourceUrl: input.sourceUrl, sourceKind: input.sourceKind, ownerName: input.ownerName, photographerName: input.photographerName, license: input.license, rightsNote: input.rightsNote, rightsWarning: input.rightsWarning, isPrimary: input.isPrimary, reviewStatus: "pending", createdBy: ctx.user.id });
      await createAuditLog({ entityType: "atlas_image", entityId: image.id, action: "create", details: JSON.stringify({ pointId: input.pointId, sourceKind: input.sourceKind, sourceUrl: input.sourceUrl, rightsWarning: input.rightsWarning }), actorId: ctx.user.id });
      return image;
    }),
    reviewImage: adminProcedure.input(z.object({ id: z.number().int().positive(), reviewStatus: z.enum(["pending", "approved", "rejected"]), rightsNote: z.string().min(3).max(4000).optional() })).mutation(async ({ input, ctx }) => {
      const image = await updateAtlasImage(input.id, { reviewStatus: input.reviewStatus, rightsNote: input.rightsNote, reviewedBy: ctx.user.id, reviewedAt: new Date() });
      await createAuditLog({ entityType: "atlas_image", entityId: input.id, action: "review", details: JSON.stringify({ reviewStatus: input.reviewStatus }), actorId: ctx.user.id });
      return image;
    }),
    importJobs: adminProcedure.query(({ ctx }) => listImportJobs(ctx.user.id)),
    teamMembers: adminProcedure.query(() => listTeamMembers()),
    backups: adminProcedure.query(() => listBackups()),
    createBackup: adminProcedure.mutation(async ({ ctx }) => {
      const record = await createBackupRecord({ fileName: `libya-tourism-atlas-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz`, status: "creating", createdBy: ctx.user.id });
      try {
        const snapshot = await getAtlasDataSnapshot();
        const compressed = await promisify(gzip)(Buffer.from(JSON.stringify(snapshot), "utf8"));
        const uploaded = await storagePut(`atlas-backups/${ctx.user.id}/${record.fileName}`, compressed, "application/gzip");
        const completed = await updateBackupRecord(record.id, { storageKey: uploaded.key, status: "completed", sizeBytes: compressed.byteLength });
        await createAuditLog({ entityType: "atlas_backup", entityId: record.id, action: "create", details: JSON.stringify({ sizeBytes: compressed.byteLength, storageKey: uploaded.key }), actorId: ctx.user.id });
        return completed;
      } catch (error) {
        await updateBackupRecord(record.id, { status: "failed", errorSummary: error instanceof Error ? error.message : "فشل إنشاء النسخة الاحتياطية" });
        throw error;
      }
    }),
    createTeamMember: adminProcedure.input(z.object({ displayName: z.string().min(2).max(255), email: z.string().email().max(320), teamRole: z.enum(["reviewer", "editor", "import_manager"]), notes: z.string().max(4000).optional() })).mutation(async ({ input, ctx }) => {
      const member = await createTeamMember({ ...input, status: "pending", createdBy: ctx.user.id });
      await createAuditLog({ entityType: "atlas_team_member", entityId: member.id, action: "create", details: JSON.stringify({ email: input.email, teamRole: input.teamRole }), actorId: ctx.user.id });
      return member;
    }),
    updateTeamMember: adminProcedure.input(z.object({ id: z.number().int().positive(), patch: z.object({ displayName: z.string().min(2).max(255).optional(), teamRole: z.enum(["reviewer", "editor", "import_manager"]).optional(), status: z.enum(["active", "suspended", "pending"]).optional(), notes: z.string().max(4000).optional() }) })).mutation(async ({ input, ctx }) => {
      const member = await updateTeamMember(input.id, input.patch);
      await createAuditLog({ entityType: "atlas_team_member", entityId: input.id, action: "update", details: JSON.stringify(input.patch), actorId: ctx.user.id });
      return member;
    }),
    previewImport: adminProcedure.input(z.object({ sourceKind: z.enum(["kml", "excel"]), fileName: z.string().min(1).max(255), fileDataBase64: z.string().min(10).max(30_000_000), layerId: z.string().max(80).optional() })).mutation(async ({ input }) => {
      const parsed = input.sourceKind === "kml" ? parseKml(Buffer.from(input.fileDataBase64, "base64"), { layerId: input.layerId, source: input.fileName }) : parseExcel(Buffer.from(input.fileDataBase64, "base64"), { layerId: input.layerId, source: input.fileName });
      return { fileName: input.fileName, sourceKind: input.sourceKind, ...parsed, rows: parsed.rows.slice(0, 500) };
    }),
    startImport: adminProcedure.input(z.object({ fileName: z.string().min(1).max(255), sourceKind: z.enum(["kml", "excel"]), storageKey: z.string().optional(), fileDataBase64: z.string().min(10).max(30_000_000).optional() })).mutation(async ({ input, ctx }) => {
      let storageKey = input.storageKey;
      if (input.fileDataBase64) storageKey = (await storagePut(`atlas-imports/${ctx.user.id}/${crypto.randomUUID()}-${input.fileName.replace(/[^a-z0-9._-]/gi, "_")}`, Buffer.from(input.fileDataBase64, "base64"), input.sourceKind === "kml" ? "application/vnd.google-earth.kml+xml" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).key;
      return createImportJob({ fileName: input.fileName, sourceKind: input.sourceKind, storageKey, status: "uploaded", createdBy: ctx.user.id });
    }),
    commitImport: adminProcedure.input(z.object({ jobId: z.number().int().positive(), sourceKind: z.enum(["kml", "excel"]), fileName: z.string().min(1).max(255), fileDataBase64: z.string().min(10).max(30_000_000).optional(), layerId: z.string().max(80).optional() })).mutation(async ({ input, ctx }) => {
      const job = await getImportJob(input.jobId);
      if (!job?.storageKey) throw new TRPCError({ code: "BAD_REQUEST", message: "ملف الاستيراد غير موجود في التخزين" });
      await updateImportJob(input.jobId, { status: "processing" });
      try {
        const sourceUrl = await storageGetSignedUrl(job.storageKey);
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error(`تعذر قراءة ملف الاستيراد (${response.status})`);
        const fileBuffer = Buffer.from(await response.arrayBuffer());
        const parsed = input.sourceKind === "kml" ? parseKml(fileBuffer, { layerId: input.layerId, source: input.fileName }) : parseExcel(fileBuffer, { layerId: input.layerId, source: input.fileName });
        const existing = await listAtlasPoints();
        const known = new Set(existing.map((row) => row.fingerprint).filter(Boolean));
        const unique = parsed.rows.filter((row) => { if (known.has(row.fingerprint)) return false; known.add(row.fingerprint); return true; });
        const points = unique.map((row: ImportRow) => ({ layerId: row.layerId, name: row.name, nameEn: row.nameEn, description: row.description, latitude: row.latitude, longitude: row.longitude, municipality: row.municipality, category: row.category, source: row.source, sourceKind: row.sourceKind, sourceRecordId: row.sourceRecordId, metadata: JSON.stringify(row.metadata), status: "draft" as const, recordStatus: "pending_review" as const, fingerprint: row.fingerprint, createdBy: ctx.user.id }));
        await createAtlasPointsBatch(points);
        await updateImportJob(input.jobId, { status: parsed.issues.length ? "needs_review" : "completed", totalRows: parsed.totalRows, importedRows: points.length, duplicateRows: parsed.rows.length - unique.length, rejectedRows: parsed.issues.length, errorSummary: parsed.issues.length ? JSON.stringify(parsed.issues.slice(0, 100)) : null });
        await createAuditLog({ entityType: "atlas_import_job", entityId: input.jobId, action: "commit", details: JSON.stringify({ importedRows: points.length, duplicateRows: parsed.rows.length - unique.length, rejectedRows: parsed.issues.length }), actorId: ctx.user.id });
        return { jobId: input.jobId, status: parsed.issues.length ? "needs_review" : "completed", totalRows: parsed.totalRows, importedRows: points.length, duplicateRows: parsed.rows.length - unique.length, rejectedRows: parsed.issues.length, issues: parsed.issues.slice(0, 100) };
      } catch (error) {
        await updateImportJob(input.jobId, { status: "failed", errorSummary: error instanceof Error ? error.message : "فشل غير معروف" });
        throw error;
      }
    }),
    create: adminProcedure.input(pointInput).mutation(async ({ input, ctx }) => {
      let imageUrl: string | undefined;
      let imageKey: string | undefined;
      if (input.imageDataUrl) {
        const match = input.imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) throw new Error("صيغة الصورة غير صالحة");
        const extension = (input.imageFileName?.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
        const stored = await storagePut(`atlas-points/${ctx.user.id}/${crypto.randomUUID()}.${extension}`, Buffer.from(match[2], "base64"), input.imageContentType || match[1]);
        imageUrl = stored.url;
        imageKey = stored.key;
      }
      return createAtlasPoint({
        layerId: input.layerId,
        name: input.name,
        nameEn: input.nameEn,
        description: input.description,
        latitude: input.latitude,
        longitude: input.longitude,
        municipality: input.municipality,
        category: input.category,
        source: input.source,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
        imageUrl,
        imageKey,
        status: "draft",
        recordStatus: "draft",
        createdBy: ctx.user.id,
      });
    }),
  }),
});

export type AppRouter = typeof appRouter;
