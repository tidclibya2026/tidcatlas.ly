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

export function normalizeAtlasSearch(value: string) {
  return value.normalize("NFKC").replace(/[ًٌٍَُِّْـ]/g, "").replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").trim().toLocaleLowerCase();
}

const CATEGORY_FAMILIES = [
  { label: "تاريخية", terms: ["تاريخ", "histor", "old city", "مدينة قديمة", "قلعة", "قصر"] },
  { label: "طبيعية", terms: ["طبي", "natural", "nature", "واحة", "بحيرة", "وادي", "شلال", "جبل", "صحراء", "محمية"] },
  { label: "دينية", terms: ["دين", "relig", "مسجد", "زاوية", "كنيسة", "ضريح"] },
  { label: "أثرية", terms: ["أثر", "archaeolog", "heritage", "تراث", "روماني", "يوناني", "موقع عالمي"] },
  { label: "خدمية", terms: ["خدم", "service", "hotel", "فندق", "إيواء", "مطعم", "مقهى", "منتجع", "قرية سياحية"] },
  { label: "استثمارية", terms: ["استثمار", "investment", "مشروع", "تنمية"] },
];

export function inferAtlasCategory(site: FilterableAtlasSite): string {
  const raw = [site.name, site.description, value(site, ["category", "type", "classification", "التصنيف"]), site.layerId].join(" ").toLocaleLowerCase();
  return CATEGORY_FAMILIES.find((family) => family.terms.some((term) => raw.includes(term)))?.label || "أخرى";
}

export function atlasCategoryFamilies() {
  return CATEGORY_FAMILIES.map(({ label }) => label);
}

export function filterAtlasSites<T extends FilterableAtlasSite>(sites: T[], filters: AtlasSiteFilters): T[] {
  const query = normalizeAtlasSearch(filters.query ?? "");
  return sites.filter((site) => {
    const category = value(site, ["category", "type", "classification", "التصنيف"]);
    const categoryFamily = inferAtlasCategory(site);
    const municipality = value(site, ["municipality", "municipality_name", "بلدية", "البلدية", "city"]);
    const status = value(site, ["status", "حالة السجل", "الحالة"]) || "منشور";
    const searchableText = [site.name, site.description, category, municipality, site.layerId, ...Object.values(site.properties)].filter(Boolean).join(" ");
    const matchesQuery = !query || normalizeAtlasSearch(searchableText).includes(query);
    return matchesQuery
      && (!filters.category || filters.category === "all" || category === filters.category || categoryFamily === filters.category)
      && (!filters.municipality || filters.municipality === "all" || municipality === filters.municipality)
      && (!filters.layerId || filters.layerId === "all" || site.layerId === filters.layerId)
      && (!filters.status || filters.status === "all" || status === filters.status);
  });
}
