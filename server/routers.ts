import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createAtlasPoint, listAtlasPoints } from "./db";
import { storagePut } from "./storage";
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
        createdBy: ctx.user.id,
      });
    }),
  }),
});

export type AppRouter = typeof appRouter;
