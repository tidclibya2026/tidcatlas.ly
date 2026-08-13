import { describe, expect, it } from "vitest";
import { extractKmlImageUrl, toDisplayImageUrl } from "./kmlImage";

describe("extractKmlImageUrl", () => {
  it("extracts image URLs from KML img markup", () => {
    expect(extractKmlImageUrl('<img src="https://mymaps.usercontent.google.com/hostedimage/theatre.png?x=1&amp;y=2" />')).toBe("https://mymaps.usercontent.google.com/hostedimage/theatre.png?x=1&y=2");
  });

  it("extracts image URLs from normalized KML property names", () => {
    expect(extractKmlImageUrl("", { photo_URL: "https://example.com/photo.jpg" })).toBe("https://example.com/photo.jpg");
    expect(extractKmlImageUrl("", { PictureUrl: "https://example.com/picture.jpg" })).toBe("https://example.com/picture.jpg");
  });

  it("extracts an image from HTML-escaped KML descriptions", () => {
    expect(extractKmlImageUrl("&lt;img src=\"https://example.com/leptis.jpg?x=1&amp;y=2\" /&gt;")).toBe("https://example.com/leptis.jpg?x=1&y=2");
  });

  it("prefers image properties when KML provides a direct photo field", () => {
    expect(extractKmlImageUrl("photo_URL: https://example.com/fallback.jpg", { photo_URL: "https://example.com/leptis.jpg" })).toBe("https://example.com/leptis.jpg");
  });

  it("creates a browser-display URL while retaining the original source separately", () => {
    const source = "https://mymaps.usercontent.google.com/hostedimage/leptis.png?authuser=1";
    expect(toDisplayImageUrl(source)).toContain("https://images.weserv.nl/?url=");
    expect(decodeURIComponent(toDisplayImageUrl(source)!.split("?url=")[1].split("&w=")[0])).toBe(source);
  });
});
