import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;

function context(user: User | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("atlas points", () => {
  it("rejects invalid coordinates before attempting persistence", async () => {
    const caller = appRouter.createCaller(context({ id: 1, openId: "admin", name: "Admin", email: null, loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }));
    await expect(caller.atlas.create({ layerId: "heritage", name: "اختبار", latitude: 120, longitude: 17 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("protects the internal points list from unauthenticated access", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.atlas.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects malformed voice input before upload", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.voice.transcribe({ audioDataUrl: "not-a-data-url", language: "ar" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires at least one verified record for smart search", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.atlas.smartSearch({ question: "ما المواقع؟", mode: "visitor", sites: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires at least two verified records for route planning", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.atlas.routePlan({ mode: "tourist", durationHours: 8, interests: ["تراث"], sites: [{ id: "one", name: "موقع واحد", description: "", latitude: 32, longitude: 13, layerId: "heritage" }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
