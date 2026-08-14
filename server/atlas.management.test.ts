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

  it("allows flexible image source kinds through validation", async () => {
    await expect(appRouter.createCaller(context("admin")).atlas.addImage({ pointId: 8, sourceKind: "wikimedia", rightsNote: "مصدر مفتوح" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("protects the image review queue and reassignment from normal users", async () => {
    await expect(appRouter.createCaller(context("user")).atlas.imageReviewQueue()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(context("user")).atlas.reassignImage({ imageId: 1, pointId: 8, reason: "اختبار" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires a rights note when reviewing an image", async () => {
    await expect(appRouter.createCaller(context("admin")).atlas.reviewImage({ id: 4, reviewStatus: "approved", rightsNote: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects layer identifiers outside the safe slug format", async () => {
    await expect(appRouter.createCaller(context("admin")).atlas.createLayer({ id: "طبقة جديدة", label: "طبقة جديدة", color: "#287a70", icon: "map-pin" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("does not allow normal users to manage layers", async () => {
    await expect(appRouter.createCaller(context("user")).atlas.manageLayers()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates comment length before persistence", async () => {
    await expect(appRouter.createCaller(context("user")).atlas.addComment({ pointId: 8, body: "  " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("validates rating range before persistence", async () => {
    await expect(appRouter.createCaller(context("user")).atlas.ratePoint({ pointId: 8, rating: 6 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires reviewer access to moderate comments", async () => {
    await expect(appRouter.createCaller(context("user")).atlas.moderateComment({ id: 8, status: "approved" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires a point for visitor edit suggestions", async () => {
    await expect(appRouter.createCaller(context("user")).atlas.submitSuggestion({ suggestionType: "edit", sourceKind: "custom", rightsNote: "اقتراح زائر" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires an image source for visitor image suggestions", async () => {
    await expect(appRouter.createCaller(context("user")).atlas.submitSuggestion({ suggestionType: "image", sourceKind: "photographer", rightsNote: "الصورة ملك المصور" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("protects the visitor suggestion review queue from normal users", async () => {
    await expect(appRouter.createCaller(context("user")).atlas.suggestionQueue({ status: "pending" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(context("user")).atlas.reviewSuggestion({ id: 1, status: "approved" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows administrators to read the visitor suggestion queue", async () => {
    const result = await appRouter.createCaller(context("admin")).atlas.suggestionQueue({ status: "pending" });
    expect(Array.isArray(result)).toBe(true);
  });
});
