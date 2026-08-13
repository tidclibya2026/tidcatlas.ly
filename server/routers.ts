import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createAtlasPoint, listAtlasPoints } from "./db";
import { storagePut } from "./storage";

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
