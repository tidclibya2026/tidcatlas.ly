export type GeoViewport = { south: number; west: number; north: number; east: number; zoom: number };

export type GeoPoint = { lat: number; lng: number };

const toRadians = (value: number) => (value * Math.PI) / 180;

export function distanceKm(from: [number, number], to: [number, number]) {
  const earthRadius = 6371;
  const dLat = toRadians(to[0] - from[0]);
  const dLng = toRadians(to[1] - from[1]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from[0])) * Math.cos(toRadians(to[0])) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isPointInViewport(point: GeoPoint, viewport: GeoViewport) {
  const inLongitude = viewport.west <= viewport.east
    ? point.lng >= viewport.west && point.lng <= viewport.east
    : point.lng >= viewport.west || point.lng <= viewport.east;
  return point.lat >= viewport.south && point.lat <= viewport.north && inLongitude;
}

export function nearbyPoints<T extends GeoPoint>(points: T[], viewport: GeoViewport, limit = 12) {
  const center: [number, number] = [
    (viewport.south + viewport.north) / 2,
    (viewport.west + viewport.east) / 2,
  ];

  return points
    .filter((point) => isPointInViewport(point, viewport))
    .map((point) => ({
      ...point,
      distanceKm: distanceKm(center, [point.lat, point.lng]),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
