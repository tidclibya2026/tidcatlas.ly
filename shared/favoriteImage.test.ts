import { describe, expect, it } from "vitest";
import { FAVORITE_IMAGE, favoriteImageMetadata } from "./favoriteImage";

describe("favorite image metadata", () => {
  it("returns the real KML source metadata when a site has an image", () => {
    const metadata = favoriteImageMetadata(true, { image_source: "kml://site-image", image_author: "جهة التوثيق", image_license: "ترخيص KML" });
    expect(metadata).toEqual({
      image_source: "kml://site-image",
      image_author: "جهة التوثيق",
      image_license: "ترخيص KML",
      image_license_note: "صورة مرتبطة ببيانات KML",
    });
  });

  it("returns a complete Commons fallback attribution when KML has no image", () => {
    const metadata = favoriteImageMetadata(false, {});
    expect(metadata.image_source).toBe(FAVORITE_IMAGE.sourceUrl);
    expect(metadata.image_author).toBe(FAVORITE_IMAGE.author);
    expect(metadata.image_license).toBe("CC BY-SA 3.0");
    expect(metadata.image_license_note).toContain("عرض المؤقت");
  });
});
