import { describe, expect, it } from "vitest";
import { verifiedSiteImageFallback } from "./siteImageFallback";

describe("verifiedSiteImageFallback", () => {
  it("returns a directly relevant Commons image and attribution for the Severan Forum", () => {
    const fallback = verifiedSiteImageFallback("الساحة السيفيرية‎‎");
    expect(fallback?.image_source).toContain("Forum_Leptis_Magna_03.JPG");
    expect(fallback?.image_author).toBe("SashaCoachman");
    expect(fallback?.image_license).toBe("CC BY-SA 3.0");
  });

  it("recognizes the English KML alias", () => {
    expect(verifiedSiteImageFallback("Forum of Severus")?.image_source).toContain("upload.wikimedia.org");
  });

  it("does not use an unrelated image for unknown sites", () => {
    expect(verifiedSiteImageFallback("موقع غير معروف")).toBeUndefined();
  });
});
