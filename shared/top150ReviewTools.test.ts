import { describe, expect, it } from "vitest";
import { buildTop150Csv } from "./top150ReviewTools";

describe("top-150 review export", () => {
  it("exports UTF-8 rows with escaped values and source coordinates", () => {
    const csv = buildTop150Csv([{ rank: 6, candidate: 'موقع، "غير مؤكد"', region: "بنغازي", category: null, matchScore: 0, reviewStatus: "pending_review", sourceMatches: [{ lat: 32.1, lon: 20.2, source: "source.kml" }] }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"موقع، ""غير مؤكد"""');
    expect(csv).toContain('"32.1, 20.2"');
    expect(csv).toContain('"source.kml"');
  });
});
