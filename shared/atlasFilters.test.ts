import { describe, expect, it } from "vitest";
import { atlasCategoryFamilies, filterAtlasSites, inferAtlasCategory } from "./atlasFilters";

const sites = [
  { id: "a", name: "مدينة غدامس القديمة", description: "تراث معماري", layerId: "heritage", lat: 30.13, lng: 9.5, properties: { category: "تراث", municipality: "غدامس", status: "منشور" } },
  { id: "b", name: "شاطئ طرابلس", description: "ساحل", layerId: "nature", lat: 32.88, lng: 13.18, properties: { category: "طبيعة", municipality: "طرابلس", status: "مسودة" } },
];

describe("filterAtlasSites", () => {
  it("filters by query, category, municipality, layer, and status", () => {
    expect(filterAtlasSites(sites, { query: "غدامس", category: "تراث", municipality: "غدامس", layerId: "heritage", status: "منشور" }).map((site) => site.id)).toEqual(["a"]);
    expect(filterAtlasSites(sites, { status: "مسودة" }).map((site) => site.id)).toEqual(["b"]);
  });

  it("searches Arabic and English names stored in site properties", () => {
    const multilingualSites = [{ id: "heritage-1", name: "مسرح لبدة", description: "", layerId: "heritage", properties: { name_en: "Leptis Magna Theatre", landmark_en: "Septimius Severus" } }];
    expect(filterAtlasSites(multilingualSites, { query: "مسرح لبدة" })).toHaveLength(1);
    expect(filterAtlasSites(multilingualSites, { query: "Leptis Magna" })).toHaveLength(1);
    expect(filterAtlasSites(multilingualSites, { query: "Septimius" })).toHaveLength(1);
  });

  it("returns an empty result when no verified record matches", () => {
    expect(filterAtlasSites(sites, { query: "سرت", status: "منشور" })).toHaveLength(0);
  });
});


describe("tourism category families", () => {
  it("infers historical, natural, and service categories", () => {
    expect(inferAtlasCategory({ id: "1", name: "قلعة السرايا", description: "معلم تاريخي", layerId: "heritage", properties: {} })).toBe("تاريخية");
    expect(inferAtlasCategory({ id: "2", name: "وادي الحياة", description: "مشهد طبيعي", layerId: "natural", properties: {} })).toBe("طبيعية");
    expect(inferAtlasCategory({ id: "3", name: "فندق الساحل", description: "إيواء", layerId: "hotels", properties: {} })).toBe("خدمية");
  });

  it("exposes canonical category labels and filters by them", () => {
    expect(atlasCategoryFamilies()).toEqual(expect.arrayContaining(["تاريخية", "طبيعية", "خدمية"]));
    expect(filterAtlasSites([
      { id: "historic", name: "قلعة", description: "موقع تاريخي", layerId: "heritage", properties: {} },
      { id: "nature", name: "وادي", description: "موقع طبيعي", layerId: "natural", properties: {} },
    ], { category: "طبيعية" }).map((site) => site.id)).toEqual(["nature"]);
  });
});
