import { describe, expect, it } from "vitest";
import { normalizeRecordStatus } from "./recordStatus";

describe("normalizeRecordStatus", () => {
  it("adds a review-required fallback when source status is absent", () => {
    expect(normalizeRecordStatus({ name: "سجل" })).toMatchObject({ record_status: "مراجعة مطلوبة", draft: "false" });
  });

  it("preserves explicit draft state", () => {
    expect(normalizeRecordStatus({ draft: "true" })).toMatchObject({ record_status: "مسودة", draft: "true" });
  });

  it("does not turn an arbitrary source status into a published claim", () => {
    expect(normalizeRecordStatus({ status: "مقترح" }).record_status).toBe("مراجعة مطلوبة");
  });
});
