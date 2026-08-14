import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, atlasEditorProcedure, atlasImportProcedure, atlasReviewerProcedure, documentationProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { archiveAtlasImage, archiveAtlasPoint, createAtlasImage, createAtlasLayer, createAtlasPoint, createAtlasPointsBatch, createAuditLog, createImportJob, findPotentialDuplicatePoints, getActiveTeamMemberForUser, getAtlasPoint, getImportJob, listAtlasImages, listAtlasImageReviewQueue, reassignAtlasImage, getAtlasDataSnapshot, listAtlasSuggestions, createAtlasSuggestion, updateAtlasSuggestion, listAtlasLayers, listAtlasPoints, listBackups, listImportJobs, listReviewQueue, listTeamMembers, mergeAtlasPoints, createBackupRecord, createTeamMember, updateBackupRecord, updateTeamMember, updateAtlasImage, updateAtlasLayer, updateAtlasPoint, updateImportJob, listAtlasComments, createAtlasComment, updateAtlasComment, getAtlasComment, getAtlasRatingSummary, upsertAtlasRating } from "./db";
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
  sourceKind: z.enum(["kml", "excel", "agency", "photographer", "web_page", "facebook", "wikimedia", "custom", "other"]).optional(),
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
    layers: publicProcedure.query(() => listAtlasLayers()),
    manageLayers: adminProcedure.query(() => listAtlasLayers(true)),
    createLayer: adminProcedure.input(z.object({ id: z.string().regex(/^[a-z0-9-]{2,80}$/), label: z.string().min(2).max(160), description: z.string().max(4000).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), icon: z.string().min(1).max(80) })).mutation(async ({ input, ctx }) => { const layer = await createAtlasLayer({ ...input, createdBy: ctx.user.id, status: "active" }); await createAuditLog({ entityType: "atlas_layer", entityId: 0, action: "create", details: JSON.stringify(input), actorId: ctx.user.id }); return layer; }),
    updateLayer: adminProcedure.input(z.object({ id: z.string().max(80), patch: z.object({ label: z.string().min(2).max(160).optional(), description: z.string().max(4000).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), icon: z.string().min(1).max(80).optional(), status: z.enum(["active", "archived"]).optional() }) })).mutation(async ({ input, ctx }) => { const layer = await updateAtlasLayer(input.id, input.patch); await createAuditLog({ entityType: "atlas_layer", entityId: 0, action: "update", details: JSON.stringify({ id: input.id, patch: input.patch }), actorId: ctx.user.id }); return layer; }),
    mine: protectedProcedure.query(({ ctx }) => listAtlasPoints(undefined, undefined, ctx.user.id)),
    myTeamAccess: protectedProcedure.query(async ({ ctx }) => ({ isAdmin: ctx.user.role === "admin", member: ctx.user.role === "admin" ? null : await getActiveTeamMemberForUser(ctx.user) })),
    reviewQueue: documentationProcedure.input(z.object({ recordStatus: z.enum(["draft", "pending_review", "approved", "published", "rejected", "archived"]).optional(), search: z.string().max(255).optional(), layerId: z.string().max(80).optional(), municipality: z.string().max(160).optional(), category: z.string().max(120).optional(), sort: z.enum(["newest", "oldest", "name"]).optional() }).optional()).query(({ input }) => listReviewQueue(input?.recordStatus, input)),
    sourceReconciliation: adminProcedure.query(async () => {
      const root = process.cwd();
      const [summaryText, manifestText, reportText] = await Promise.all([
        readFile(resolve(root, "docs/normalized-attached-sources-2026-08-14.jsonl.summary.json"), "utf8"),
        readFile(resolve(root, "docs/import-job-attached-sources-2026-08-14.json"), "utf8"),
        readFile(resolve(root, "docs/attached-source-reconciliation-2026-08-14.md"), "utf8"),
      ]);
      return { summary: JSON.parse(summaryText), manifest: JSON.parse(manifestText), report: reportText };
    }),
    top150ReviewQueue: adminProcedure.input(z.object({ status: z.enum(["pending_review", "approved", "rejected"]).default("pending_review"), matchFilter: z.enum(["all", "confirmed", "manual_review"]).default("all"), search: z.string().max(255).optional() }).optional()).query(async ({ input }) => {
      const queue = JSON.parse(await readFile(resolve(process.cwd(), "docs/top-150-review-queue-2026-08-14.json"), "utf8")) as { rows: Array<{ rank: number; candidate: string; region: string; status: string; confirmedName: string | null; matchScore: number; reviewStatus: string; sourceReport: string }> };
      const search = input?.search?.trim().toLocaleLowerCase("ar");
      return queue.rows.filter((row) => row.reviewStatus === (input?.status || "pending_review") && (input?.matchFilter === "all" || (input?.matchFilter === "confirmed" ? row.matchScore === 1 : row.matchScore < 1)) && (!search || `${row.candidate} ${row.region} ${row.confirmedName || ""}`.toLocaleLowerCase("ar").includes(search)));
    }),
    pointDetails: documentationProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input, ctx }) => ({ point: await getAtlasPoint(input.id), images: await listAtlasImages(input.id), comments: await listAtlasComments(input.id, ctx.user.role === "admin"), rating: await getAtlasRatingSummary(input.id, ctx.user.id) })),
    addComment: protectedProcedure.input(z.object({ pointId: z.number().int().positive(), body: z.string().trim().min(3).max(4000) })).mutation(async ({ input, ctx }) => {
      const point = await getAtlasPoint(input.pointId);
      if (!point) throw new TRPCError({ code: "NOT_FOUND", message: "الوثيقة غير موجودة" });
      const comment = await createAtlasComment({ pointId: input.pointId, userId: ctx.user.id, body: input.body, status: "pending" });
      await createAuditLog({ entityType: "atlas_comment", entityId: comment.id, action: "create", details: JSON.stringify({ pointId: input.pointId }), actorId: ctx.user.id });
      return comment;
    }),
    ratePoint: protectedProcedure.input(z.object({ pointId: z.number().int().positive(), rating: z.number().int().min(1).max(5) })).mutation(async ({ input, ctx }) => {
      const point = await getAtlasPoint(input.pointId);
      if (!point) throw new TRPCError({ code: "NOT_FOUND", message: "الوثيقة غير موجودة" });
      return upsertAtlasRating(input.pointId, ctx.user.id, input.rating);
    }),
    submitSuggestion: protectedProcedure.input(z.object({ pointId: z.number().int().positive().optional(), suggestionType: z.enum(["edit", "image"]), proposedName: z.string().trim().max(255).optional(), proposedDescription: z.string().trim().max(10000).optional(), proposedCategory: z.string().trim().max(120).optional(), proposedMetadata: z.record(z.string(), z.string()).optional(), imageUrl: z.string().url().optional(), imageDataUrl: z.string().max(8_000_000).optional(), fileName: z.string().max(180).optional(), contentType: z.string().max(120).optional(), sourceUrl: z.string().url().optional(), sourceKind: z.enum(["agency", "photographer", "web_page", "facebook", "wikimedia", "kml", "excel", "custom", "other"]), ownerName: z.string().max(255).optional(), photographerName: z.string().max(255).optional(), license: z.string().max(255).optional(), rightsNote: z.string().trim().min(3).max(4000) })).mutation(async ({ input, ctx }) => {
      if (input.pointId) {
        const point = await getAtlasPoint(input.pointId);
        if (!point) throw new TRPCError({ code: "NOT_FOUND", message: "المعلم المطلوب غير موجود" });
      }
      if (input.suggestionType === "edit" && !input.pointId) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر المعلم المطلوب تعديله" });
      if (input.suggestionType === "image" && !input.imageUrl && !input.imageDataUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "أضف رابط الصورة أو ارفع ملفًا" });
      let imageUrl = input.imageUrl;
      let storageKey: string | undefined;
      if (input.imageDataUrl) {
        const match = input.imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة الصورة غير صالحة" });
        const extension = (input.fileName?.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
        const stored = await storagePut(`atlas-suggestions/${ctx.user.id}/${crypto.randomUUID()}.${extension}`, Buffer.from(match[2], "base64"), input.contentType || match[1]);
        imageUrl = stored.url; storageKey = stored.key;
      }
      const suggestion = await createAtlasSuggestion({ pointId: input.pointId, userId: ctx.user.id, suggestionType: input.suggestionType, proposedName: input.proposedName, proposedDescription: input.proposedDescription, proposedCategory: input.proposedCategory, proposedMetadata: input.proposedMetadata ? JSON.stringify(input.proposedMetadata) : undefined, imageUrl, storageKey, sourceUrl: input.sourceUrl, sourceKind: input.sourceKind, ownerName: input.ownerName, photographerName: input.photographerName, license: input.license, rightsNote: input.rightsNote, status: "pending" });
      await createAuditLog({ entityType: "atlas_suggestion", entityId: suggestion.id, action: "create", details: JSON.stringify({ pointId: input.pointId, suggestionType: input.suggestionType, sourceKind: input.sourceKind, sourceUrl: input.sourceUrl }), actorId: ctx.user.id });
      return suggestion;
    }),
    suggestionQueue: atlasReviewerProcedure.input(z.object({ status: z.enum(["pending", "approved", "rejected", "archived"]).default("pending") }).optional()).query(({ input }) => listAtlasSuggestions(input?.status || "pending")),
    reviewSuggestion: atlasReviewerProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected", "archived"]), reviewNote: z.string().max(4000).optional() })).mutation(async ({ input, ctx }) => {
      const queue = await listAtlasSuggestions("pending");
      const row = queue.find((item) => item.suggestion.id === input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "الاقتراح غير موجود أو تمت مراجعته" });
      if (input.status === "approved" && row.suggestion.suggestionType === "edit" && row.suggestion.pointId) {
        const patch = { name: row.suggestion.proposedName || undefined, description: row.suggestion.proposedDescription || undefined, category: row.suggestion.proposedCategory || undefined, metadata: row.suggestion.proposedMetadata || undefined, recordStatus: "pending_review" as const };
        await updateAtlasPoint(row.suggestion.pointId, patch);
      }
      if (input.status === "approved" && row.suggestion.suggestionType === "image" && row.suggestion.pointId && row.suggestion.imageUrl) {
        await createAtlasImage({ pointId: row.suggestion.pointId, imageUrl: row.suggestion.imageUrl, storageKey: row.suggestion.storageKey || undefined, sourceUrl: row.suggestion.sourceUrl || undefined, sourceKind: row.suggestion.sourceKind, ownerName: row.suggestion.ownerName || undefined, photographerName: row.suggestion.photographerName || undefined, license: row.suggestion.license || undefined, rightsNote: row.suggestion.rightsNote || "تمت مراجعة المصدر والحقوق من فريق الأطلس.", rightsWarning: false, isPrimary: false, reviewStatus: "approved", createdBy: ctx.user.id });
      }
      const suggestion = await updateAtlasSuggestion(input.id, { status: input.status, reviewedBy: ctx.user.id, reviewedAt: new Date(), reviewNote: input.reviewNote });
      await createAuditLog({ entityType: "atlas_suggestion", entityId: input.id, action: "review", details: JSON.stringify({ status: input.status, reviewNote: input.reviewNote }), actorId: ctx.user.id });
      return suggestion;
    }),
    moderateComment: atlasReviewerProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected", "archived"]) })).mutation(async ({ input, ctx }) => {
      const comment = await getAtlasComment(input.id);
      if (!comment) throw new TRPCError({ code: "NOT_FOUND", message: "التعليق غير موجود" });
      const updated = await updateAtlasComment(input.id, { status: input.status, moderatedBy: ctx.user.id, moderatedAt: new Date() });
      await createAuditLog({ entityType: "atlas_comment", entityId: input.id, action: "moderate", details: JSON.stringify({ status: input.status }), actorId: ctx.user.id });
      return updated;
    }),
    findDuplicates: atlasReviewerProcedure.input(z.object({ name: z.string().min(1).max(255), latitude: z.number(), longitude: z.number() })).query(({ input }) => findPotentialDuplicatePoints(input.name, input.latitude, input.longitude)),
    update: atlasEditorProcedure.input(z.object({ id: z.number().int().positive(), patch: pointInput.partial() })).mutation(async ({ input, ctx }) => {
      const patch = { ...input.patch, metadata: input.patch.metadata ? JSON.stringify(input.patch.metadata) : undefined };
      const updated = await updateAtlasPoint(input.id, patch);
      await createAuditLog({ entityType: "atlas_point", entityId: input.id, action: "update", details: JSON.stringify(input.patch), actorId: ctx.user.id });
      return updated;
    }),
    review: atlasReviewerProcedure.input(z.object({ id: z.number().int().positive(), recordStatus: z.enum(["draft", "pending_review", "approved", "published", "rejected", "archived"]), reviewNote: z.string().max(4000).optional() })).mutation(async ({ input, ctx }) => {
      const updated = await updateAtlasPoint(input.id, { recordStatus: input.recordStatus, status: input.recordStatus === "published" ? "published" : input.recordStatus === "archived" ? "archived" : "draft", reviewNote: input.reviewNote, reviewedBy: ctx.user.id, reviewedAt: new Date() });
      await createAuditLog({ entityType: "atlas_point", entityId: input.id, action: "review", details: JSON.stringify({ recordStatus: input.recordStatus, reviewNote: input.reviewNote }), actorId: ctx.user.id });
      return updated;
    }),
    archiveDuplicate: atlasReviewerProcedure.input(z.object({ id: z.number().int().positive(), duplicateOfId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const updated = await archiveAtlasPoint(input.id, input.duplicateOfId);
      await createAuditLog({ entityType: "atlas_point", entityId: input.id, action: "archive_duplicate", details: JSON.stringify({ duplicateOfId: input.duplicateOfId }), actorId: ctx.user.id });
      return updated;
    }),
    mergeDuplicate: atlasReviewerProcedure.input(z.object({ primaryId: z.number().int().positive(), duplicateId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      if (input.primaryId === input.duplicateId) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن دمج النقطة مع نفسها" });
      const primary = await mergeAtlasPoints(input.primaryId, input.duplicateId);
      await createAuditLog({ entityType: "atlas_point", entityId: input.duplicateId, action: "merge_duplicate", details: JSON.stringify({ primaryId: input.primaryId }), actorId: ctx.user.id });
      return primary;
    }),
    archive: atlasReviewerProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().min(3).max(4000) })).mutation(async ({ input, ctx }) => {
      const updated = await archiveAtlasPoint(input.id);
      await createAuditLog({ entityType: "atlas_point", entityId: input.id, action: "archive", details: JSON.stringify({ reason: input.reason }), actorId: ctx.user.id });
      return updated;
    }),
    archiveImage: atlasReviewerProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().min(3).max(4000) })).mutation(async ({ input, ctx }) => {
      const image = await archiveAtlasImage(input.id, input.reason);
      await createAuditLog({ entityType: "atlas_image", entityId: input.id, action: "archive", details: JSON.stringify({ reason: input.reason }), actorId: ctx.user.id });
      return image;
    }),
    addImage: atlasEditorProcedure.input(z.object({ pointId: z.number().int().positive(), imageUrl: z.string().url().optional(), imageDataUrl: z.string().max(8_000_000).optional(), fileName: z.string().max(180).optional(), contentType: z.string().max(120).optional(), sourceUrl: z.string().url().optional(), sourceKind: z.enum(["agency", "photographer", "web_page", "facebook", "wikimedia", "kml", "excel", "custom", "other"]), sourceRecordId: z.string().max(255).optional(), sourceFileName: z.string().max(255).optional(), assetHash: z.string().max(128).optional(), importJobId: z.number().int().positive().optional(), ownerName: z.string().max(255).optional(), photographerName: z.string().max(255).optional(), license: z.string().max(255).optional(), rightsNote: z.string().min(3).max(4000), rightsWarning: z.boolean().default(true), isPrimary: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
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
      const image = await createAtlasImage({ pointId: input.pointId, imageUrl, storageKey, sourceUrl: input.sourceUrl, sourceKind: input.sourceKind, sourceRecordId: input.sourceRecordId, sourceFileName: input.sourceFileName, assetHash: input.assetHash, importJobId: input.importJobId, ownerName: input.ownerName, photographerName: input.photographerName, license: input.license, rightsNote: input.rightsNote, rightsWarning: input.rightsWarning, isPrimary: input.isPrimary, reviewStatus: "pending", createdBy: ctx.user.id });
      await createAuditLog({ entityType: "atlas_image", entityId: image.id, action: "create", details: JSON.stringify({ pointId: input.pointId, sourceKind: input.sourceKind, sourceUrl: input.sourceUrl, rightsWarning: input.rightsWarning, sourceRecordId: input.sourceRecordId, sourceFileName: input.sourceFileName, assetHash: input.assetHash }), actorId: ctx.user.id });
      return image;
    }),
    imageReviewQueue: adminProcedure.query(() => listAtlasImageReviewQueue()),
    reassignImage: adminProcedure.input(z.object({ imageId: z.number().int().positive(), pointId: z.number().int().positive(), reason: z.string().min(3).max(1000) })).mutation(async ({ input, ctx }) => { const image = await reassignAtlasImage(input.imageId, input.pointId); await createAuditLog({ entityType: "atlas_image", entityId: input.imageId, action: "reassign", details: JSON.stringify({ pointId: input.pointId, reason: input.reason }), actorId: ctx.user.id }); return image; }),
    reviewImage: atlasReviewerProcedure.input(z.object({ id: z.number().int().positive(), reviewStatus: z.enum(["pending", "approved", "rejected"]), rightsNote: z.string().min(3).max(4000).optional() })).mutation(async ({ input, ctx }) => {
      const image = await updateAtlasImage(input.id, { reviewStatus: input.reviewStatus, rightsNote: input.rightsNote, reviewedBy: ctx.user.id, reviewedAt: new Date() });
      await createAuditLog({ entityType: "atlas_image", entityId: input.id, action: "review", details: JSON.stringify({ reviewStatus: input.reviewStatus }), actorId: ctx.user.id });
      return image;
    }),
    importJobs: atlasImportProcedure.query(({ ctx }) => listImportJobs(ctx.user.id)),
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
    previewImport: atlasImportProcedure.input(z.object({ sourceKind: z.enum(["kml", "excel"]), fileName: z.string().min(1).max(255), fileDataBase64: z.string().min(10).max(30_000_000), layerId: z.string().max(80).optional() })).mutation(async ({ input }) => {
      const parsed = input.sourceKind === "kml" ? parseKml(Buffer.from(input.fileDataBase64, "base64"), { layerId: input.layerId, source: input.fileName }) : parseExcel(Buffer.from(input.fileDataBase64, "base64"), { layerId: input.layerId, source: input.fileName });
      return { fileName: input.fileName, sourceKind: input.sourceKind, ...parsed, rows: parsed.rows.slice(0, 500) };
    }),
    startImport: atlasImportProcedure.input(z.object({ fileName: z.string().min(1).max(255), sourceKind: z.enum(["kml", "excel"]), storageKey: z.string().optional(), fileDataBase64: z.string().min(10).max(30_000_000).optional() })).mutation(async ({ input, ctx }) => {
      let storageKey = input.storageKey;
      if (input.fileDataBase64) storageKey = (await storagePut(`atlas-imports/${ctx.user.id}/${crypto.randomUUID()}-${input.fileName.replace(/[^a-z0-9._-]/gi, "_")}`, Buffer.from(input.fileDataBase64, "base64"), input.sourceKind === "kml" ? "application/vnd.google-earth.kml+xml" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).key;
      return createImportJob({ fileName: input.fileName, sourceKind: input.sourceKind, storageKey, status: "uploaded", createdBy: ctx.user.id });
    }),
    commitImport: atlasImportProcedure.input(z.object({ jobId: z.number().int().positive(), sourceKind: z.enum(["kml", "excel"]), fileName: z.string().min(1).max(255), fileDataBase64: z.string().min(10).max(30_000_000).optional(), layerId: z.string().max(80).optional() })).mutation(async ({ input, ctx }) => {
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
    create: atlasEditorProcedure.input(pointInput).mutation(async ({ input, ctx }) => {
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
