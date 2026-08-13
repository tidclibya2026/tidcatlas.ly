import { describe, expect, it } from "vitest";
import { filterAtlasSites } from "./atlasFilters";

const sites = [
  { id: "a", name: "مدينة غدامس القديمة", description: "تراث معماري", layerId: "heritage", lat: 30.13, lng: 9.5, properties: { category: "تراث", municipality: "غدامس", status: "منشور" } },
  { id: "b", name: "شاطئ طرابلس", description: "ساحل", layerId: "nature", lat: 32.88, lng: 13.18, properties: { category: "طبيعة", municipality: "طرابلس", status: "مسودة" } },
];

describe("filterAtlasSites", () => {
  it("filters by query, category, municipality, layer, and status", () => {
    expect(filterAtlasSites(sites, { query: "غدامس", category: "تراث", municipality: "غدامس", layerId: "heritage", status: "منشور" }).map((site) => site.id)).toEqual(["a"]);
    expect(filterAtlasSites(sites, { status: "مسودة" }).map((site) => site.id)).toEqual(["b"]);
  });

  it("returns an empty result when no verified record matches", () => {
    expect(filterAtlasSites(sites, { query: "سرت", status: "منشور" })).toHaveLength(0);
  });
});
