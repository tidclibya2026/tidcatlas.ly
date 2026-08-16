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

<<<<<<< HEAD
=======
  it("returns the licensed Al Hayat Tower fallback for hotel aliases", () => {
    const fallback = verifiedSiteImageFallback("لانكاستر برج الحياة (ماريوت سابقا)");
    expect(fallback?.image_source).toContain("al-hayat-tower-wikimedia");
    expect(fallback?.image_author).toContain("Abdul-Jawad");
    expect(fallback?.image_license).toBe("CC BY-SA 3.0");
  });

>>>>>>> origin/repair/latest-atlas-2026
  it("does not use an unrelated image for unknown sites", () => {
    expect(verifiedSiteImageFallback("موقع غير معروف")).toBeUndefined();
  });
});
