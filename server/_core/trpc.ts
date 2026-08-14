import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import type { TrpcContext } from "./context";
import { getActiveTeamMemberForUser } from "../db";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user, teamMember: null } });
  }),
);

const documentationAccess = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (ctx.user.role === "admin") return next({ ctx: { ...ctx, user: ctx.user, teamMember: null } });
  const teamMember = await getActiveTeamMemberForUser(ctx.user);
  if (!teamMember) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك عضوية نشطة في فريق التوثيق" });
  return next({ ctx: { ...ctx, user: ctx.user, teamMember } });
});

export const documentationProcedure = t.procedure.use(documentationAccess);

const roleProcedure = (allowed: Array<"reviewer" | "editor" | "import_manager">) => documentationProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (ctx.user?.role === "admin") return next();
    if (ctx.user) {
      const teamMember = await getActiveTeamMemberForUser(ctx.user);
      if (teamMember && allowed.includes(teamMember.teamRole)) return next();
    }
    throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك الصلاحية المطلوبة لهذه العملية" });
  }),
);

export const atlasEditorProcedure = roleProcedure(["editor"]);
export const atlasReviewerProcedure = roleProcedure(["reviewer"]);
export const atlasImportProcedure = roleProcedure(["import_manager"]);
