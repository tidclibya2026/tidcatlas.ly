import { describe, expect, it } from "vitest";
import { cleanUserFacingKmlDescription, descriptionSourceText, hasRawKmlCoordinates } from "./kmlDescription";

describe("KML description sanitization", () => {
  it("combines description content without Placemark geometry", () => {
    expect(descriptionSourceText("<p>وصف الموقع</p>", "<img src=\"https://example.com/site.jpg\" />")).toContain("وصف الموقع");
  });

  it("removes markup and caps long user-facing descriptions", () => {
    const cleaned = cleanUserFacingKmlDescription(`<p>${"وصف ".repeat(400)}</p>`);
    expect(cleaned).not.toContain("<p>");
    expect(cleaned.length).toBeLessThanOrEqual(1200);
  });

  it("rejects raw coordinate strings from being shown as description", () => {
    const raw = "coordinates: 13.175237,32.899496,0 13.176000,32.900000,0";
    expect(hasRawKmlCoordinates(raw)).toBe(true);
    expect(cleanUserFacingKmlDescription(raw)).toBe("");
  });
});
