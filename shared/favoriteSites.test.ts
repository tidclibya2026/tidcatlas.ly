import { describe, expect, it } from "vitest";
import { isFavoriteSiteName, normalizeFavoriteName } from "./favoriteSites";

describe("favorite site selection", () => {
  it("matches an approved KML name and tolerates invisible formatting marks", () => {
    expect(isFavoriteSiteName("شلال بالفو\u200e"),).toBe(true);
    expect(isFavoriteSiteName("مدينة لبدة الاثرية الكبرى")).toBe(true);
  });

  it("does not promote an unapproved similarly named site", () => {
    expect(isFavoriteSiteName("مدينة إيراسا القديمة")).toBe(false);
    expect(isFavoriteSiteName("واو الناموس")).toBe(false);
  });

  it("normalizes Arabic punctuation and diacritics consistently", () => {
    expect(normalizeFavoriteName("موقع شحات (قورينة) الأثري")).toBe(normalizeFavoriteName("موقع شحات قورينة الأثري"));
  });
});
