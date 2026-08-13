export type RouteCoordinateSite = { id: string; lat: number; lng: number };

export function routeCoordinates(sites: RouteCoordinateSite[], orderedIds: string[]) {
  const byId = new Map(sites.map((site) => [site.id, site]));
  return orderedIds.map((id) => byId.get(id)).filter((site): site is RouteCoordinateSite => Boolean(site)).map((site) => [site.lat, site.lng] as [number, number]);
}
