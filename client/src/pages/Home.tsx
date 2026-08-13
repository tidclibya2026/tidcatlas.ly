/**
 * Design reminder: National Memory Map — editorial institutional cartography.
 * Keep the map dominant, use atlas blue #123C52, sand surfaces, copper heritage accents,
 * Noto Kufi Arabic for headings, and IBM Plex Sans Arabic for data/UI.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { MapView } from "@/components/Map";
import { filterAtlasSites } from "@shared/atlasFilters";
import { isFavoriteSiteName } from "@shared/favoriteSites";
import { FAVORITE_IMAGE, favoriteImageMetadata } from "@shared/favoriteImage";
import { routeCoordinates } from "@shared/atlasRoute";
import { buildDensityBins, densityColor } from "@shared/density";
import { extractKmlImageUrl } from "@shared/kmlImage";
import L from "leaflet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Activity, ArrowLeft, Building2, ChevronDown, Database, ExternalLink, Eye, EyeOff, Flag, Hotel, ImagePlus, Landmark, Layers3,
  MapPinned, MapPinPlus, Menu, Mountain, Route, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, Trees, TrendingUp, Utensils, Waves, X, ZoomIn
} from "lucide-react";

type Site = { id: string; name: string; description: string; lat: number; lng: number; properties: Record<string, string>; layerId: string; imageUrl?: string | null };
type LayerConfig = { id: string; name: string; short: string; color: string; icon: ReactNode; url: string; kind: "kml" | "geojson"; description: string; featured?: boolean };

const DATA = {
  projectLogo: "/manus-storage/atlas-tourism-project_c75dcab1.png",
  ministryLogo: "/manus-storage/ministry-tourism_feb6f439.png",
  centerLogo: "/manus-storage/tourism-documentation-center_0d098924.png",
  hero: "/manus-storage/libya-atlas-hero_ebb8b2b9.jpg",
  desert: "/manus-storage/libya-atlas-desert_8d3e876d.jpg",
  heritage: "/manus-storage/libya-atlas-heritage_baefbb7e.jpg",
  cover: "/manus-storage/libya-atlas-cover-gis-landscape_22a918d0.png",
  intro: "/manus-storage/IMG_6898_91929b39.PNG",
};

const INITIAL_CENTER: [number, number] = [27.2, 17.2];

const layers: LayerConfig[] = [
  { id: "heritage", name: "التراث العالمي", short: "مواقع أثرية وتاريخية", color: "#B96D3B", icon: <Landmark size={19} strokeWidth={1.8} />, url: "/manus-storage/world-heritage_ae1639b4.kml", kind: "kml", description: "مواقع التراث العالمي والمكونات التابعة لها", featured: true },
  { id: "natural", name: "الموارد الطبيعية", short: "مشاهد وجغرافيا طبيعية", color: "#287A70", icon: <Trees size={19} strokeWidth={1.8} />, url: "/manus-storage/natural-atlas-with-media_5ccb1fb0.geojson", kind: "geojson", description: "سجل أطلس الموارد الطبيعية الليبية" },
  { id: "akakus", name: "تادرارت أكاكوس", short: "الفن الصخري والصحراء", color: "#A76027", icon: <Mountain size={19} strokeWidth={1.8} />, url: "/manus-storage/akakus_60c47b41.kml", kind: "kml", description: "الفن الصخري والمشهد الصحراوي" },
  { id: "old-tripoli", name: "المدينة القديمة طرابلس", short: "معالم تاريخية", color: "#3E7183", icon: <Building2 size={19} strokeWidth={1.8} />, url: "/manus-storage/old-tripoli_5c62867b.kml", kind: "kml", description: "مبانٍ ومعالم المدينة القديمة" },
  { id: "hotels", name: "الفنادق والإيواء", short: "خدمات الضيافة", color: "#B34B42", icon: <Hotel size={19} strokeWidth={1.8} />, url: "/manus-storage/hotels_b9547235.kml", kind: "kml", description: "الفنادق ومنشآت الإيواء" },
  { id: "resorts", name: "القرى والمنتجعات", short: "سياحة ساحلية", color: "#3D8C8A", icon: <Waves size={19} strokeWidth={1.8} />, url: "/manus-storage/resorts_e4a8f065.kml", kind: "kml", description: "القرى والمنتجعات والشاليهات" },
  { id: "density", name: "كثافة التجمعات السياحية", short: "فنادق وقرى ومنتجعات", color: "#D04C45", icon: <Activity size={19} strokeWidth={1.8} />, url: "", kind: "geojson", description: "توزيع مكاني محسوب من سجلات الفنادق والقرى والمنتجعات" },
  { id: "investment", name: "فرص الاستثمار", short: "مشاريع وتنمية", color: "#AF7A24", icon: <TrendingUp size={19} strokeWidth={1.8} />, url: "/manus-storage/investment_de22d4a0.kml", kind: "kml", description: "المشاريع والفرص الاستثمارية السياحية" },
  { id: "food", name: "المطاعم والمقاهي", short: "خدمات الطعام", color: "#855D42", icon: <Utensils size={19} strokeWidth={1.8} />, url: "/manus-storage/restaurants_0642e048.kml", kind: "kml", description: "مطاعم ومقاهٍ في طرابلس" },
  { id: "favorites", name: "المواقع المفضلة", short: "مختارات الأطلس", color: "#C08A2E", icon: <Star size={19} strokeWidth={1.8} />, url: "", kind: "geojson", description: "مختارات من المواقع الطبيعية والتراثية المميزة" },
];

function isFavoriteSite(site: Site) {
  return isFavoriteSiteName(site.name);
}

function buildFavoriteSites(sites: Site[]) {
  const seen = new Set<string>();
  return sites.filter(isFavoriteSite).filter((site) => {
    const key = `${site.name.trim().toLocaleLowerCase()}-${site.lat.toFixed(4)}-${site.lng.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((site) => {
    const imageUrl = site.imageUrl || FAVORITE_IMAGE.url;
    return {
      ...site,
      imageUrl,
      layerId: "favorites",
      properties: {
        ...site.properties,
        ...favoriteImageMetadata(Boolean(site.imageUrl), site.properties),
      },
    };
  });
}

function parseKml(text: string, layerId: string): Site[] {
  const xml = new DOMParser().parseFromString(text, "text/xml");
  return Array.from(xml.querySelectorAll("Placemark")).map((node, index) => {
    const name = node.querySelector("name")?.textContent?.trim() || `موقع ${index + 1}`;
    const description = (node.querySelector("description")?.textContent || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const coordinateText = node.querySelector("Point coordinates, coordinates")?.textContent?.trim() || node.querySelector("coordinates")?.textContent?.trim() || "";
    const [lng, lat] = coordinateText.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const properties: Record<string, string> = {};
    node.querySelectorAll("ExtendedData Data").forEach((item) => {
      const key = item.getAttribute("name");
      if (key) properties[key] = item.querySelector("value")?.textContent?.trim() || "";
    });
    const imageUrl = extractKmlImageUrl(description, properties);
    if (imageUrl) properties.image_url = imageUrl;
    properties.source_layer = layerId;
    properties.source_format = "KML";
    return { id: `${layerId}-${index}`, name, description, lat, lng, imageUrl, properties, layerId };
  }).filter(Boolean) as Site[];
}

function propertyName(properties: Record<string, unknown>) {
  return String(properties.name_ar || properties.name || properties.title || properties.name_en || "موقع موثق");
}

function parseMetadata(raw: string | null) {
  if (!raw) return {} as Record<string, string>;
  try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
}

async function loadLayer(config: LayerConfig): Promise<Site[]> {
  const response = await fetch(config.url);
  if (!response.ok) throw new Error(`تعذر تحميل ${config.name}`);
  if (config.kind === "kml") return parseKml(await response.text(), config.id);
  const json = await response.json();
  return (json.features || []).flatMap((feature: any, index: number) => {
    const geometry = feature.geometry;
    const point = geometry?.type === "Point" ? geometry.coordinates : geometry?.coordinates?.[0]?.[0];
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return [];
    const properties = feature.properties || {};
    const imageUrl = String(properties.image_url || properties.imageUrl || properties.image || "") || undefined;
    properties.source_layer = config.id;
    properties.source_format = "GeoJSON";
    return [{ id: `${config.id}-${index}`, name: propertyName(properties), description: String(properties.description_ar || properties.description || ""), lat: point[1], lng: point[0], imageUrl, properties, layerId: config.id }];
  });
}

export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  const [hasEnteredAtlas, setHasEnteredAtlas] = useState(false);
  const [activeLayers, setActiveLayers] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<Record<string, Site[]>>({});
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMunicipality, setSelectedMunicipality] = useState("all");
  const [selectedLayer, setSelectedLayer] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [assistantMode, setAssistantMode] = useState<"researcher" | "tourist" | "visitor">("visitor");
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [routeHours, setRouteHours] = useState("8");
  const [routeInterests, setRouteInterests] = useState("تراث، طبيعة");
  const [selected, setSelected] = useState<Site | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [map, setMap] = useState<L.Map | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [draftPoint, setDraftPoint] = useState({ layerId: "heritage", name: "", description: "", municipality: "", category: "", source: "", latitude: "", longitude: "", metadata: "", imageDataUrl: "", imageFileName: "", imageContentType: "" });
  const markers = useRef<Record<string, L.Layer[]>>({});
  const routeLine = useRef<L.Polyline | null>(null);
  const publishedPoints = trpc.atlas.published.useQuery({});
  const adminPoints = trpc.atlas.mine.useQuery(undefined, { enabled: Boolean(isAuthenticated && user?.role === "admin") });
  const trpcUtils = trpc.useUtils();
  const handleMapReady = useCallback((instance: L.Map) => setMap(instance), []);
  const smartSearch = trpc.atlas.smartSearch.useMutation();
  const routePlan = trpc.atlas.routePlan.useMutation();
  const createPoint = trpc.atlas.create.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ النقطة كمسودة وستظهر لك على الخريطة بعد التحديث");
      setEditorOpen(false);
      setDraftPoint({ layerId: "heritage", name: "", description: "", municipality: "", category: "", source: "", latitude: "", longitude: "", metadata: "", imageDataUrl: "", imageFileName: "", imageContentType: "" });
      trpcUtils.atlas.published.invalidate();
      trpcUtils.atlas.mine.invalidate();
    },
    onError: (error) => toast.error(error.message || "تعذر حفظ النقطة"),
  });

  const pointFeed = user?.role === "admin" ? adminPoints.data : publishedPoints.data;
  const managedSites = useMemo<Site[]>(() => (pointFeed || []).map((point) => ({ id: `managed-${point.id}`, name: point.name, description: point.description || "", lat: point.latitude, lng: point.longitude, imageUrl: point.imageUrl, properties: { municipality: point.municipality || "", category: point.category || "", source: point.source || "", ...parseMetadata(point.metadata) }, layerId: point.layerId })), [pointFeed]);
  const activeSites = useMemo(() => [...activeLayers.flatMap((id) => loaded[id] || []), ...managedSites.filter((site) => activeLayers.includes(site.layerId))], [activeLayers, loaded, managedSites]);
  const siteValue = (site: Site, keys: string[]) => keys.map((key) => site.properties[key] || site.properties[key.toLowerCase()]).find(Boolean) || "";
  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const municipalities = new Set<string>();
    const statuses = new Set<string>();
    activeSites.forEach((site) => {
      const category = siteValue(site, ["category", "type", "classification", "التصنيف"]);
      const municipality = siteValue(site, ["municipality", "municipality_name", "بلدية", "البلدية", "city"]);
      const status = siteValue(site, ["status", "حالة السجل", "الحالة"]) || "منشور";
      if (category) categories.add(category);
      if (municipality) municipalities.add(municipality);
      statuses.add(status);
    });
    return { categories: Array.from(categories).sort((a, b) => a.localeCompare(b, "ar")), municipalities: Array.from(municipalities).sort((a, b) => a.localeCompare(b, "ar")), statuses: Array.from(statuses).sort((a, b) => a.localeCompare(b, "ar")) };
  }, [activeSites]);
  const assistantSites = useMemo(() => activeSites.slice(0, 120).map((site) => ({ id: site.id, name: site.name, description: site.description, latitude: site.lat, longitude: site.lng, layerId: site.layerId, category: siteValue(site, ["category", "type", "classification", "التصنيف"]), municipality: siteValue(site, ["municipality", "municipality_name", "بلدية", "البلدية", "city"]), source: siteValue(site, ["source", "المصدر"]) || "سجلات أطلس ليبيا السياحي" })), [activeSites]);
  const visibleSites = useMemo(() => filterAtlasSites(activeSites, { query, category: selectedCategory, municipality: selectedMunicipality, layerId: selectedLayer, status: selectedStatus }), [activeSites, query, selectedCategory, selectedMunicipality, selectedLayer, selectedStatus]);

  const clearMarkers = useCallback((id: string) => {
    markers.current[id]?.forEach((marker) => marker.remove());
    markers.current[id] = [];
  }, []);

  const renderMarkers = useCallback((config: LayerConfig, sites: Site[]) => {
    if (!map) return;
    clearMarkers(config.id);
    markers.current[config.id] = sites.flatMap((site) => {
      const radius = config.id === "hotels" ? 9 : config.id === "resorts" ? 8 : config.id === "natural" ? 7 : 6.5;
      const halo = L.circleMarker([site.lat, site.lng], { radius: radius + 5, color: config.color, weight: 1, fillColor: config.color, fillOpacity: 0.12, opacity: 0.35, interactive: false });
      halo.addTo(map);
      const marker = L.circleMarker([site.lat, site.lng], { radius, color: "#fff", weight: 2, fillColor: config.color, fillOpacity: 0.92, opacity: 0.98 });
      marker.addTo(map);
      marker.bindTooltip(site.name, { direction: "top", offset: [0, -7], opacity: 0.95 });
      marker.on("click", () => { setSelected(site); setMobileOpen(false); });
      return [halo, marker];
    });
  }, [clearMarkers, map]);

  const renderDensity = useCallback((sites: Site[]) => {
    if (!map) return;
    clearMarkers("density");
    const bins = buildDensityBins(sites);
    const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
    markers.current.density = bins.map((bin) => {
      const color = densityColor(bin.count, maxCount);
      const circle = L.circle([bin.lat, bin.lng], { radius: 6500 + bin.count * 2800, color, fillColor: color, fillOpacity: 0.2 + (bin.count / maxCount) * 0.3, weight: 1.5 });
      circle.addTo(map);
      circle.bindTooltip(`تجمع سياحي · ${bin.count.toLocaleString("ar-LY")} سجلًا`, { direction: "top", opacity: 0.95 });
      return circle;
    });
  }, [clearMarkers, map]);

  useEffect(() => {
    if (!map) return;
    if (activeLayers.includes("density") && !markers.current.density?.length) {
      Promise.all(["hotels", "resorts"].map(async (id) => {
        if (loaded[id]) return loaded[id];
        const source = layers.find((item) => item.id === id);
        if (!source) return [];
        const sites = await loadLayer(source);
        setLoaded((current) => ({ ...current, [id]: sites }));
        return sites;
      })).then((groups) => renderDensity(groups.flat())).catch(() => toast.error("تعذر حساب كثافة التجمعات السياحية"));
    }
    if (activeLayers.includes("favorites") && !loaded.favorites) {
      const sourceIds = ["heritage", "natural", "akakus", "old-tripoli"];
      Promise.all(sourceIds.map(async (id) => {
        if (loaded[id]) return loaded[id];
        const source = layers.find((item) => item.id === id);
        return source ? loadLayer(source) : [];
      })).then((groups) => setLoaded((current) => ({ ...current, favorites: buildFavoriteSites(groups.flat()) }))).catch(() => toast.error("تعذر تحميل المواقع المفضلة"));
    }
    activeLayers.filter((id) => id !== "density").forEach(async (id) => {
      const config = layers.find((item) => item.id === id);
      if (!config || loaded[id]) { if (config && loaded[id]) renderMarkers(config, loaded[id]); return; }
      try {
        const sites = await loadLayer(config);
        setLoaded((current) => ({ ...current, [id]: sites }));
        renderMarkers(config, sites);
      } catch (error) {
        toast.error(`تعذر تحميل طبقة ${config.name}`);
      }
    });
    Object.keys(markers.current).filter((id) => id !== "managed" && !activeLayers.includes(id)).forEach(clearMarkers);
  }, [activeLayers, map, loaded, renderMarkers, renderDensity, clearMarkers]);

  useEffect(() => {
    if (!map || !pickMode) return;
    const chooseLocation = (event: L.LeafletMouseEvent) => { setDraftPoint((current) => ({ ...current, latitude: event.latlng.lat.toFixed(6), longitude: event.latlng.lng.toFixed(6) })); setPickMode(false); setEditorOpen(true); toast.success("تم تحديد الإحداثيات من الخريطة"); };
    map.on("click", chooseLocation);
    return () => { map.off("click", chooseLocation); };
  }, [pickMode, map]);

  useEffect(() => {
    if (!map) return;
    const visibleIds = new Set(visibleSites.map((site) => site.id));
    layers.forEach((config) => { if (loaded[config.id]) renderMarkers(config, loaded[config.id].filter((site) => visibleIds.has(site.id))); });
    if (pointFeed?.length) renderMarkers({ id: "managed", name: "النقاط المضافة", short: "سجلات الأطلس", color: "#7B4F35", icon: "✦", url: "", kind: "geojson", description: "النقاط المضافة من فريق التوثيق" }, managedSites.filter((site) => visibleIds.has(site.id)));
  }, [map, loaded, pointFeed, managedSites, visibleSites, renderMarkers]);

  useEffect(() => {
    if (!map) return;
    routeLine.current?.remove();
    routeLine.current = null;
    if (!routePlan.data?.orderedIds?.length) return;
    const coordinates = routeCoordinates(activeSites, routePlan.data.orderedIds);
    if (coordinates.length < 2) return;
    routeLine.current = L.polyline(coordinates, { color: "#B96D3B", weight: 3, dashArray: "8 8", opacity: 0.85 }).addTo(map);
    const bounds = L.latLngBounds(coordinates);
    map.fitBounds(bounds, { padding: [40, 40] });
    return () => { routeLine.current?.remove(); routeLine.current = null; };
  }, [map, routePlan.data, activeSites]);

  useEffect(() => {
    if (!map || !query) return;
    const first = visibleSites[0];
    if (first) map.panTo([first.lat, first.lng]);
  }, [query, map, visibleSites]);

  const toggleLayer = (id: string, checked: boolean) => {
    setQuery("");
    setSelectedCategory("all");
    setSelectedMunicipality("all");
    setSelectedStatus("all");
    setSelectedLayer(checked ? id : "all");
    setActiveLayers((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));
  };
  const focusLibya = () => map?.panTo(INITIAL_CENTER);
  const updateDraft = (field: keyof typeof draftPoint, value: string) => setDraftPoint((current) => ({ ...current, [field]: value }));
  const submitPoint = () => {
    const metadata: Record<string, string> = {};
    draftPoint.metadata.split("\n").map((line) => line.split(":")).filter(([key, value]) => key?.trim() && value?.trim()).forEach(([key, value]) => { metadata[key.trim()] = value.trim(); });
    createPoint.mutate({ ...draftPoint, latitude: Number(draftPoint.latitude), longitude: Number(draftPoint.longitude), metadata, imageDataUrl: draftPoint.imageDataUrl || undefined, imageFileName: draftPoint.imageFileName || undefined, imageContentType: draftPoint.imageContentType || undefined });
  };

  if (!hasEnteredAtlas) {
    return <main dir="rtl" className="intro-screen"><div className="intro-full-art"><img src={DATA.intro} alt="غلاف مشروع أطلس ليبيا السياحي" /><div className="intro-sheen" /><Button className="intro-enter-overlay" onClick={() => setHasEnteredAtlas(true)}>دخول إلى الأطلس <ArrowLeft size={17} /></Button></div></main>;
  }

  return (
    <main dir="rtl" className="atlas-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="project-mark"><img className="project-logo" src={DATA.projectLogo} alt="شعار مشروع أطلس ليبيا السياحي" /></div><div className="brand-title"><span className="eyebrow">مشروع وطني للتوثيق والاستكشاف</span><h1>أطلس ليبيا <em>السياحي</em></h1><small>ليبيا.. ملتقى الحضارات، ومهد الأصالة</small></div><div className="official-logos" aria-label="الجهات الرسمية المشرفة على المشروع"><div className="official-logo-cell"><img src={DATA.ministryLogo} alt="شعار وزارة السياحة والصناعات التقليدية" /><span>وزارة السياحة<br />والصناعات التقليدية</span></div><span className="logo-divider" /><div className="official-logo-cell"><img src={DATA.centerLogo} alt="شعار مركز المعلومات والتوثيق السياحي" /><span>مركز المعلومات<br />والتوثيق السياحي</span></div></div></div>
        <div className="topbar-actions"><div className="header-gis-badge"><Layers3 size={14} /><span>GIS</span><small>خريطة وطنية</small></div><span className="edition"><span className="status-dot" /> نسخة العرض المؤسسية · 2026</span><Button variant="ghost" size="icon" className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="فتح قائمة الطبقات"><Menu /></Button></div>
      </header>


      <section className="atlas-main">
        <aside className="control-panel">
          <div className="panel-intro"><div className="intro-kicker"><Sparkles size={14} /> من المعلومة إلى القرار</div><h2>ليبيا، كما تُروى عبر المكان.</h2><p>منصة جغرافية لتوثيق المقومات السياحية والتاريخية والطبيعية والخدمية، وربطها بمشهد واحد قابل للاستكشاف.</p></div>
          <div className="search-box"><Search size={18} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم موقع أو مدينة…" aria-label="البحث داخل المواقع" />{query && <button onClick={() => setQuery("")} aria-label="مسح البحث"><X size={15} /></button>}</div>
          {(query || selectedCategory !== "all" || selectedMunicipality !== "all" || selectedLayer !== "all" || selectedStatus !== "all") && <div className="search-results" aria-live="polite"><div className="search-results-heading"><span>نتائج البحث</span><strong>{visibleSites.length.toLocaleString("ar-LY")}</strong></div>{visibleSites.length === 0 ? <p className="search-empty">لا توجد سجلات مطابقة ضمن الطبقات النشطة.</p> : <div className="search-result-list">{visibleSites.slice(0, 8).map((site) => <button type="button" key={site.id} onClick={() => { setSelected(site); map?.panTo([site.lat, site.lng]); map?.setZoom(12); }}><span>{site.name}</span><small>{siteValue(site, ["municipality", "municipality_name", "بلدية", "البلدية", "city"]) || "موقع موثق"}</small></button>)}</div>}</div>}
          <div className="filter-panel" aria-label="الفلاتر المتقدمة"><div className="filter-heading"><span><SlidersHorizontal size={14} /> تصفية السجلات</span><button onClick={() => { setSelectedCategory("all"); setSelectedMunicipality("all"); setSelectedLayer("all"); setSelectedStatus("all"); }} type="button">إعادة ضبط</button></div><div className="filter-grid"><label>الطبقة<select value={selectedLayer} onChange={(event) => setSelectedLayer(event.target.value)}><option value="all">كل الطبقات</option>{layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label><label>التصنيف<select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="all">كل الأنواع</option>{filterOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label>البلدية<select value={selectedMunicipality} onChange={(event) => setSelectedMunicipality(event.target.value)}><option value="all">كل البلديات</option>{filterOptions.municipalities.map((municipality) => <option key={municipality} value={municipality}>{municipality}</option>)}</select></label><label>الحالة<select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}><option value="all">كل الحالات</option>{filterOptions.statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label></div></div>
          <div className="ai-panel"><div className="ai-panel-heading"><span><Sparkles size={14} /> البحث الذكي الموثق</span><select value={assistantMode} onChange={(event) => setAssistantMode(event.target.value as typeof assistantMode)}><option value="visitor">زائر</option><option value="tourist">سائح</option><option value="researcher">باحث</option></select></div><p>اسأل عن المواقع الظاهرة؛ الإجابة تعتمد على السجلات الموثقة المتاحة فقط.</p><div className="ai-question"><Input value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} placeholder="مثال: ما المواقع الأثرية المناسبة لزيارة قصيرة؟" aria-label="سؤال البحث الذكي" /><Button size="sm" disabled={!assistantQuestion.trim() || smartSearch.isPending} onClick={() => smartSearch.mutate({ question: assistantQuestion, mode: assistantMode })}>{smartSearch.isPending ? "يبحث..." : "اسأل"}</Button></div>{smartSearch.error && <div className="ai-answer"><strong>تعذر إكمال البحث الذكي حاليًا.</strong><small>يمكنك تضييق الفلاتر أو المحاولة مرة أخرى. لا يتم عرض معلومات غير موثقة.</small></div>}{smartSearch.data && <div className="ai-answer"><strong>{smartSearch.data.answer}</strong>{smartSearch.data.matchedIds.length > 0 && <small>السجلات المطابقة: {smartSearch.data.matchedIds.map((id) => activeSites.find((site) => site.id === id)?.name).filter(Boolean).join("، ")}</small>}{smartSearch.data.sources.length > 0 && <small>المصادر: {smartSearch.data.sources.join("، ")}</small>}{smartSearch.data.limitation && <small>{smartSearch.data.limitation}</small>}</div>}</div>
          <div className="route-panel"><div className="ai-panel-heading"><span><Route size={14} /> مسار مقترح</span><span className="route-note">بيانات موثقة</span></div><div className="route-controls"><label>المدة بالساعات<input value={routeHours} onChange={(event) => setRouteHours(event.target.value)} inputMode="numeric" /></label><label>الاهتمامات<input value={routeInterests} onChange={(event) => setRouteInterests(event.target.value)} placeholder="تراث، طبيعة" /></label></div><Button className="route-button" size="sm" disabled={routePlan.isPending || assistantSites.length < 2} onClick={() => routePlan.mutate({ mode: assistantMode, durationHours: Number(routeHours) || 8, interests: routeInterests.split("،").map((item) => item.trim()).filter(Boolean) })}>{routePlan.isPending ? "يبني المسار..." : "اقترح مسارًا"}</Button>{routePlan.error && <div className="route-result"><strong>تعذر بناء المسار حاليًا.</strong><small>تأكد من تفعيل طبقتين أو أكثر تحتويان على مواقع موثقة.</small></div>}{routePlan.data && <div className="route-result"><strong>{routePlan.data.title}</strong><p>{routePlan.data.rationale}</p><small>المحطات: {routePlan.data.orderedIds.map((id) => activeSites.find((site) => site.id === id)?.name).filter(Boolean).join(" ← ") || "لم يتم العثور على محطات كافية"}</small>{routePlan.data.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div>}</div>
          {!isAuthenticated && <Button className="add-point-button" onClick={startLogin}><MapPinPlus size={16} /> دخول فريق التوثيق</Button>}{isAuthenticated && user?.role === "admin" && <Button className="add-point-button" onClick={() => setEditorOpen(true)}><MapPinPlus size={16} /> إضافة نقطة إلى الأطلس</Button>}
          <div className="panel-heading"><div><span className="section-eyebrow">الطبقات الوطنية</span><h3>ماذا تريد أن ترى؟</h3></div><div className="panel-heading-actions"><button type="button" className="favorites-quick-action" onClick={() => toggleLayer("favorites", true)}>★ المفضلة</button><Badge variant="secondary">{activeLayers.length} نشطة</Badge></div></div>
          <div className="layer-list">{layers.map((layer) => { const count = loaded[layer.id]?.length; const active = activeLayers.includes(layer.id); return <div className={`layer-row ${active ? "is-active" : ""}`} key={layer.id} role="button" tabIndex={0} aria-pressed={active} onClick={() => toggleLayer(layer.id, !active)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleLayer(layer.id, !active); } }}><div className="layer-mark" style={{ background: `${layer.color}16`, color: layer.color }}>{layer.icon}</div><div className="layer-copy"><strong>{layer.name}</strong><span>{layer.short}</span><small>{count !== undefined ? `${count.toLocaleString("ar-LY")} موقعًا` : layer.id === "favorites" ? "مختارات موثقة تُحمّل عند الطلب" : "تُحمّل عند الطلب"}</small></div><Switch checked={active} onClick={(event) => event.stopPropagation()} onCheckedChange={(checked) => toggleLayer(layer.id, checked)} aria-label={`تفعيل ${layer.name}`} /></div>; })}</div>
          <div className="panel-foot"><div><Database size={15} /><span>السجلات المعروضة</span><strong>{visibleSites.length.toLocaleString("ar-LY")}</strong></div><button onClick={focusLibya}><ZoomIn size={14} /> إعادة تمركز الخريطة</button></div>
        </aside>

        <section className="map-stage"><div className="map-overlay-title"><span>المشهد الجغرافي الوطني</span><strong>استكشف ليبيا طبقةً بعد طبقة</strong></div><MapView className="atlas-map" initialCenter={INITIAL_CENTER} initialZoom={5} onMapReady={handleMapReady} /><div className="map-legend"><span><i style={{ background: "#B96D3B" }} /> مواقع موثقة</span><span><i style={{ background: "#AF7A24" }} /> فرص وتنمية</span><span><i style={{ background: "#287A70" }} /> موارد طبيعية</span>{activeLayers.includes("density") && <span className="density-legend"><i style={{ background: "#2FBEF0" }} /> تركّز منخفض <i style={{ background: "#D94B45" }} /> تركّز مرتفع</span>}</div><div className="map-count"><MapPinned size={15} /><strong>{visibleSites.length.toLocaleString("ar-LY")}</strong><span>موقع ظاهر</span></div></section>
      </section>

      <section className="story-strip"><div className="story-image" style={{ backgroundImage: `url(${DATA.heritage})` }} /><div className="story-copy"><span className="section-eyebrow">ذاكرة المكان</span><h2>الموقع ليس نقطة على الخريطة؛ إنه <i>قصة كاملة.</i></h2><p>نحوّل السجلات والطبقات والصور إلى معرفة مكانية تساعد على الحصر والتوثيق والتخطيط السياحي.</p><button onClick={() => { setActiveLayers(["heritage"]); window.scrollTo({ top: 0, behavior: "smooth" }); }}>ابدأ من التراث العالمي <ArrowLeft size={16} /></button></div><div className="story-stat"><strong>10</strong><span>مسارات بيانات<br />قابلة للاستكشاف</span></div></section>

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}><SheetContent side="left" className="detail-sheet point-editor" dir="rtl"><SheetHeader><div className="detail-top"><Badge>سجل جديد</Badge><ImagePlus size={18} /></div><SheetTitle>إضافة نقطة سياحية</SheetTitle></SheetHeader><div className="point-form"><p className="form-hint">اختر الطبقة، ثم استخدم زر تحديد الموقع للانتقال إلى الخريطة، أو أدخل الإحداثيات يدويًا.</p><Button type="button" variant="outline" className="pick-location-button" onClick={() => { setEditorOpen(false); setPickMode(true); }}><MapPinPlus size={15} /> تحديد الموقع من الخريطة</Button><label>الطبقة<select value={draftPoint.layerId} onChange={(event) => updateDraft("layerId", event.target.value)}>{layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label><label>اسم الموقع<Input value={draftPoint.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="مثال: واحة غدامس" /></label><label>الوصف<textarea value={draftPoint.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder="وصف موجز للموقع وقيمته السياحية..." /></label><div className="form-grid"><label>البلدية<Input value={draftPoint.municipality} onChange={(event) => updateDraft("municipality", event.target.value)} /></label><label>التصنيف<Input value={draftPoint.category} onChange={(event) => updateDraft("category", event.target.value)} /></label></div><div className="form-grid"><label>خط العرض<Input value={draftPoint.latitude} onChange={(event) => updateDraft("latitude", event.target.value)} inputMode="decimal" /></label><label>خط الطول<Input value={draftPoint.longitude} onChange={(event) => updateDraft("longitude", event.target.value)} inputMode="decimal" /></label></div><label>مصدر البيانات<Input value={draftPoint.source} onChange={(event) => updateDraft("source", event.target.value)} placeholder="جهة الحصر أو المرجع" /></label><label>البيانات الوصفية<textarea value={draftPoint.metadata} onChange={(event) => updateDraft("metadata", event.target.value)} placeholder={'سنة التوثيق: 2026\nحالة الوصول: متاح'} /></label><label className="file-picker"><span><ImagePlus size={16} /> صورة الموقع</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => updateDraft("imageDataUrl", String(reader.result)); reader.readAsDataURL(file); updateDraft("imageFileName", file.name); updateDraft("imageContentType", file.type); }} /></label><Button className="detail-action" disabled={createPoint.isPending || !draftPoint.name || !draftPoint.latitude || !draftPoint.longitude} onClick={submitPoint}>{createPoint.isPending ? "جارٍ الحفظ..." : "حفظ النقطة للمراجعة"}</Button></div></SheetContent></Sheet>
      <Sheet open={mobileOpen || Boolean(selected)} onOpenChange={(open) => { if (!open) { setMobileOpen(false); setSelected(null); } }}><SheetContent side={selected ? "left" : "bottom"} className={`detail-sheet ${!selected ? "mobile-layers-sheet" : ""}`} dir="rtl">{selected ? <><SheetHeader><div className="detail-top"><Badge style={{ background: layers.find((l) => l.id === selected.layerId)?.color }}>{layers.find((l) => l.id === selected.layerId)?.name}</Badge><ShieldCheck size={18} /></div><SheetTitle>{selected.name}</SheetTitle></SheetHeader><div className="detail-body">{selected.imageUrl && <img className="detail-image" src={selected.imageUrl} alt={`صورة ${selected.name}`} />}<p>{selected.description || "لا يوجد وصف منشور لهذا الموقع بعد."}</p><div className="detail-grid"><div><span>الإحداثيات</span><strong>{selected.lat.toFixed(4)}°N · {selected.lng.toFixed(4)}°E</strong></div><div><span>حالة السجل</span><strong>موقع موثق</strong></div>{selected.properties.source_layer && <div><span>مصدر الطبقة</span><strong>{selected.properties.source_layer} · {selected.properties.source_format || "بيانات أطلس"}</strong></div>}</div>{selected.properties.image_source && <small className="image-source-note">مصدر الصورة: <a href={selected.properties.image_source} target="_blank" rel="noreferrer">{selected.properties.image_source}</a>{selected.properties.image_author && <> · المؤلف: {selected.properties.image_author}</>}{selected.properties.image_license && <> · الترخيص: {selected.properties.image_license}</>}{selected.properties.image_license_note && <> · {selected.properties.image_license_note}</>}</small>}<Button className="detail-action" onClick={() => { map?.panTo([selected.lat, selected.lng]); map?.setZoom(13); }}><MapPinned size={16} /> ركّز على الموقع</Button></div></> : <><SheetHeader><div className="mobile-layer-heading"><SheetTitle>طبقات الأطلس</SheetTitle><button type="button" className="favorites-quick-action" onClick={() => { toggleLayer("favorites", true); setMobileOpen(false); }}>★ المفضلة</button></div></SheetHeader><div className="mobile-filter-panel"><div className="filter-heading"><span><SlidersHorizontal size={14} /> تصفية السجلات</span><button onClick={() => { setSelectedCategory("all"); setSelectedMunicipality("all"); setSelectedLayer("all"); setSelectedStatus("all"); }} type="button">إعادة ضبط</button></div><div className="filter-grid"><label>الطبقة<select value={selectedLayer} onChange={(event) => setSelectedLayer(event.target.value)}><option value="all">كل الطبقات</option>{layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label><label>التصنيف<select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="all">كل الأنواع</option>{filterOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label>البلدية<select value={selectedMunicipality} onChange={(event) => setSelectedMunicipality(event.target.value)}><option value="all">كل البلديات</option>{filterOptions.municipalities.map((municipality) => <option key={municipality} value={municipality}>{municipality}</option>)}</select></label><label>الحالة<select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}><option value="all">كل الحالات</option>{filterOptions.statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label></div></div><div className="mobile-layers">{layers.map((layer) => { const active = activeLayers.includes(layer.id); return <label key={layer.id} className={active ? "is-active" : ""} onClick={() => toggleLayer(layer.id, !active)}><span><i style={{ color: layer.color }}>{layer.icon}</i>{layer.name}</span><Switch checked={active} onClick={(event) => event.stopPropagation()} onCheckedChange={(checked) => toggleLayer(layer.id, checked)} aria-label={`تفعيل ${layer.name}`} /></label>; })}</div></>}</SheetContent></Sheet>
    </main>
  );
}
