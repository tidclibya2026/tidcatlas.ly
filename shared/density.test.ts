import { describe, expect, it } from "vitest";
import { buildDensityBins, densityColor } from "./density";

describe("tourism density", () => {
  it("groups nearby records into deterministic spatial bins", () => {
    const bins = buildDensityBins([
      { lat: 32.01, lng: 13.02 },
      { lat: 32.04, lng: 13.01 },
      { lat: 31.51, lng: 14.2 },
    ]);
    expect(bins[0]).toMatchObject({ lat: 32, lng: 13, count: 2 });
    expect(bins).toHaveLength(2);
  });

  it("maps lower and higher concentration to different colors", () => {
    expect(densityColor(1, 10)).not.toBe(densityColor(10, 10));
    expect(densityColor(10, 10)).toContain("rgb(222");
  });
});
