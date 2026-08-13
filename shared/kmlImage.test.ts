import { describe, expect, it } from "vitest";
import { extractKmlImageUrl } from "./kmlImage";

describe("extractKmlImageUrl", () => {
  it("extracts image URLs from KML img markup", () => {
    expect(extractKmlImageUrl('<img src="https://mymaps.usercontent.google.com/hostedimage/theatre.png?x=1&amp;y=2" />')).toBe("https://mymaps.usercontent.google.com/hostedimage/theatre.png?x=1&y=2");
  });

  it("prefers image properties when KML provides a direct photo field", () => {
    expect(extractKmlImageUrl("photo_URL: https://example.com/fallback.jpg", { photo_URL: "https://example.com/leptis.jpg" })).toBe("https://example.com/leptis.jpg");
  });
});
