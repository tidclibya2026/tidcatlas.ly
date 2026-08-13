export type FilterableAtlasSite = {
  id: string;
  name: string;
  description: string;
  layerId: string;
  properties: Record<string, unknown>;
};

export type AtlasSiteFilters = {
  query?: string;
  category?: string;
  municipality?: string;
  layerId?: string;
  status?: string;
};

function value(site: FilterableAtlasSite, keys: string[]) {
  return keys.map((key) => site.properties[key] ?? site.properties[key.toLowerCase()]).find(Boolean)?.toString() ?? "";
}

export function filterAtlasSites<T extends FilterableAtlasSite>(sites: T[], filters: AtlasSiteFilters): T[] {
  const query = (filters.query ?? "").trim().toLocaleLowerCase();
  return sites.filter((site) => {
    const category = value(site, ["category", "type", "classification", "التصنيف"]);
    const municipality = value(site, ["municipality", "municipality_name", "بلدية", "البلدية", "city"]);
    const status = value(site, ["status", "حالة السجل", "الحالة"]) || "منشور";
    const matchesQuery = !query || `${site.name} ${site.description} ${category} ${municipality}`.toLocaleLowerCase().includes(query);
    return matchesQuery
      && (!filters.category || filters.category === "all" || category === filters.category)
      && (!filters.municipality || filters.municipality === "all" || municipality === filters.municipality)
      && (!filters.layerId || filters.layerId === "all" || site.layerId === filters.layerId)
      && (!filters.status || filters.status === "all" || status === filters.status);
  });
}
