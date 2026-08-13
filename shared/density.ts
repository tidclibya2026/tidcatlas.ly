export type DensitySite = { lat: number; lng: number };
export type DensityBin = { lat: number; lng: number; count: number };

export function buildDensityBins(sites: DensitySite[], precision = 4): DensityBin[] {
  const bins = new Map<string, DensityBin>();
  sites.forEach((site) => {
    const lat = Math.round(site.lat * precision) / precision;
    const lng = Math.round(site.lng * precision) / precision;
    const key = `${lat}:${lng}`;
    const current = bins.get(key);
    bins.set(key, current ? { ...current, count: current.count + 1 } : { lat, lng, count: 1 });
  });
  return Array.from(bins.values()).sort((a, b) => b.count - a.count || a.lat - b.lat || a.lng - b.lng);
}

export function densityColor(count: number, maxCount: number) {
  const ratio = Math.max(0, Math.min(1, count / Math.max(1, maxCount)));
  return `rgb(${Math.round(47 + 175 * ratio)}, ${Math.round(190 - 86 * ratio)}, ${Math.round(240 - 170 * ratio)})`;
}
