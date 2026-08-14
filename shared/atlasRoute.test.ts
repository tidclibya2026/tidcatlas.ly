import { describe, expect, it } from "vitest";
import { routeCoordinates } from "./atlasRoute";

describe("routeCoordinates", () => {
  it("preserves verified route order and ignores unknown ids", () => {
    const sites = [{ id: "a", lat: 32, lng: 13 }, { id: "b", lat: 31, lng: 14 }];
    expect(routeCoordinates(sites, ["b", "missing", "a"])).toEqual([[31, 14], [32, 13]]);
  });

  it("returns too few coordinates when a route lacks verified stops", () => {
    expect(routeCoordinates([{ id: "a", lat: 32, lng: 13 }], ["a"])).toHaveLength(1);
  });
});
