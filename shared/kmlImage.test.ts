import { describe, expect, it } from "vitest";
import { extractKmlImageUrl, extractKmlImageUrls, normalizeKmlImageRights, toDisplayImageUrl, toFallbackImageUrl } from "./kmlImage";

describe("extractKmlImageUrl", () => {
  it("normalizes KML image rights fields", () => {
    expect(normalizeKmlImageRights({ Photographer: "TIDC", photo_license: "CC BY-SA 4.0", image_license_note: "Attribution required" })).toEqual({ author: "TIDC", license: "CC BY-SA 4.0", note: "Attribution required" });
  });
  it("extracts every distinct image URL from description and image fields", () => {
    const urls = extractKmlImageUrls('<img src="https://example.com/a.jpg"><img src="https://example.com/b.jpg"> https://example.com/a.jpg', { image_URL: "https://example.com/c.jpg" });
    expect(urls).toEqual(["https://example.com/c.jpg", "https://example.com/a.jpg", "https://example.com/b.jpg"]);
  });
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


it("extracts hotel photos from gx_media_links values", () => {
  const urls = extractKmlImageUrls("", { gx_media_links: "<![CDATA[https://lh3.googleusercontent.com/hotel-photo-a https://lh3.googleusercontent.com/hotel-photo-b]]>" });
  expect(urls).toEqual(["https://lh3.googleusercontent.com/hotel-photo-a", "https://lh3.googleusercontent.com/hotel-photo-b"]);
});

it("supports alternate image fields and keeps the original source", () => {
  expect(extractKmlImageUrl("", { image_href: "https://example.com/site.webp" })).toBe("https://example.com/site.webp");
  expect(extractKmlImageUrl("", { thumbnail_url: "https://example.com/thumb.jpg" })).toBe("https://example.com/thumb.jpg");
});

it("creates a second fallback proxy URL", () => {
  const source = "https://example.com/site.jpg?x=1&y=2";
  expect(toFallbackImageUrl(source)).toContain("https://wsrv.nl/?url=");
  expect(decodeURIComponent(toFallbackImageUrl(source)!.split("?url=")[1].split("&w=")[0])).toBe(source);
});
