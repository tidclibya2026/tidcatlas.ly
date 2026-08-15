import { describe, expect, it } from "vitest";
import { distanceKm, isPointInViewport, nearbyPoints, type GeoViewport } from "./geoViewport";

const viewport: GeoViewport = { south: 31, west: 12, north: 33, east: 15, zoom: 8 };

describe("geoViewport", () => {
  it("detects points inside and outside the visible bounds", () => {
    expect(isPointInViewport({ lat: 32, lng: 13 }, viewport)).toBe(true);
    expect(isPointInViewport({ lat: 34, lng: 13 }, viewport)).toBe(false);
  });

  it("supports longitude ranges that cross the antimeridian", () => {
    const crossing: GeoViewport = { south: -2, west: 170, north: 2, east: -170, zoom: 4 };
    expect(isPointInViewport({ lat: 0, lng: 175 }, crossing)).toBe(true);
    expect(isPointInViewport({ lat: 0, lng: -175 }, crossing)).toBe(true);
    expect(isPointInViewport({ lat: 0, lng: 0 }, crossing)).toBe(false);
  });

  it("orders visible points by distance from the viewport center", () => {
    const points = [{ id: "near", lat: 32, lng: 13 }, { id: "far", lat: 31.2, lng: 12.2 }, { id: "outside", lat: 40, lng: 13 }];
    expect(nearbyPoints(points, viewport, 2).map((point) => point.id)).toEqual(["near", "far"]);
    expect(nearbyPoints(points, viewport, 1)[0]?.distanceKm).toBeCloseTo(47.1493, 3);
    expect(distanceKm([32, 13], [32, 13])).toBe(0);
  });
});
