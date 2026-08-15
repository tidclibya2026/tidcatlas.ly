import { describe, expect, it } from "vitest";
import fs from "node:fs";

const queue = JSON.parse(fs.readFileSync("docs/top-150-review-queue-2026-08-14.json", "utf8")) as {
  total: number;
  rows: Array<{ matchScore: number; reviewStatus: string }>;
};

describe("top-150 review queue", () => {
  it("contains exactly 150 pending review rows", () => {
    expect(queue.total).toBe(150);
    expect(queue.rows).toHaveLength(150);
    expect(queue.rows.every((row) => row.reviewStatus === "pending_review")).toBe(true);
  });

  it("keeps confirmed matches separate from manual review", () => {
    const confirmed = queue.rows.filter((row) => row.matchScore === 1);
    const manual = queue.rows.filter((row) => row.matchScore < 1);
    expect(confirmed.length).toBe(15);
    expect(manual.length).toBe(135);
  });
});
