import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "admin" | "user"): TrpcContext {
  return {
    user: { id: role === "admin" ? 99 : 100, openId: `${role}-test`, email: `${role}@example.com`, name: role, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("atlas documentation team", () => {
  it("allows an administrator to open the review queue", async () => {
    const result = await appRouter.createCaller(context("admin")).atlas.reviewQueue({ recordStatus: "pending_review" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects review queue access for a normal user", async () => {
    await expect(appRouter.createCaller(context("user")).atlas.reviewQueue({ recordStatus: "pending_review" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects malformed duplicate checks before database access", async () => {
    await expect(appRouter.createCaller(context("admin")).atlas.findDuplicates({ name: "", latitude: 32, longitude: 13 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects merging a point with itself", async () => {
    await expect(appRouter.createCaller(context("admin")).atlas.mergeDuplicate({ primaryId: 8, duplicateId: 8 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires a reason for safe point archiving", async () => {
    await expect(appRouter.createCaller(context("admin")).atlas.archive({ id: 8, reason: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires rights metadata and an image source", async () => {
    await expect(appRouter.createCaller(context("admin")).atlas.addImage({ pointId: 8, sourceKind: "facebook", rightsNote: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires a rights note when reviewing an image", async () => {
    await expect(appRouter.createCaller(context("admin")).atlas.reviewImage({ id: 4, reviewStatus: "approved", rightsNote: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
