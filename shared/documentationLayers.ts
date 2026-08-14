export type CustomDocumentationLayer = { id: string; label: string; description: string; color: string; icon: string; active: boolean };

const STORAGE_KEY = "tidc.documentation.layers";

export const builtInDocumentationLayers = [
  { id: "heritage", label: "التراث العالمي" }, { id: "historic-cities", label: "المدن التاريخية" },
  { id: "museums", label: "المتاحف" }, { id: "natural", label: "المواقع الطبيعية" },
  { id: "hotels", label: "الفنادق والإيواء" }, { id: "resorts", label: "القرى والمنتجعات" },
  { id: "investment", label: "فرص الاستثمار" }, { id: "services", label: "الخدمات" },
  { id: "restaurants", label: "المطاعم" }, { id: "cafes", label: "المقاهي" },
] as const;

export function readCustomDocumentationLayers(): CustomDocumentationLayer[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as CustomDocumentationLayer[]; } catch { return []; }
}

export function saveCustomDocumentationLayers(layers: CustomDocumentationLayer[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layers));
  window.dispatchEvent(new CustomEvent("tidc:documentation-layers"));
}
