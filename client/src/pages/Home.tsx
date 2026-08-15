/**
 * Design reminder: National Memory Map — editorial institutional cartography.
 * Keep the map dominant, use atlas blue #123C52, sand surfaces, copper heritage accents,
 * Noto Kufi Arabic for headings, and IBM Plex Sans Arabic for data/UI.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getManagementUrl, startLogin } from "@/const";
import { MapView } from "@/components/Map";
import { useTheme } from "@/contexts/ThemeContext";
import { atlasCategoryFamilies, filterAtlasSites, inferAtlasCategory } from "@shared/atlasFilters";
import { isFavoriteSiteName } from "@shared/favoriteSites";
import { nearbyPoints, type GeoViewport } from "@shared/geoViewport";
import { FAVORITE_IMAGE, favoriteImageMetadata } from "@shared/favoriteImage";
import { routeCoordinates } from "@shared/atlasRoute";
import { buildDensityBins, densityColor } from "@shared/density";
import { extractKmlImageUrls, normalizeKmlImageRights, toDisplayImageUrl, toFallbackImageUrl } from "@shared/kmlImage";
import { cleanUserFacingKmlDescription, descriptionSourceText } from "@shared/kmlDescription";
import { verifiedSiteImageFallback } from "@shared/siteImageFallback";
import { normalizeRecordStatus } from "@shared/recordStatus";
import L from "leaflet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Activity, ArrowLeft, Building2, ChevronDown, Database, ExternalLink, Eye, EyeOff, Flag, Hotel, ImagePlus, ImageOff, Landmark, Languages, Layers3, MessageSquarePlus,
  MapPinned, MapPinPlus, Menu, Moon, Mountain, Route, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, Sun, Trees, TrendingUp, Utensils, Waves, X, ZoomIn
} from "lucide-react";

type Site = { id: string; name: string; description: string; lat: number; lng: number; properties: Record<string, string>; layerId: string; imageUrl?: string | null };
type AtlasViewport = GeoViewport;
type LayerConfig = { id: string; name: string; short: string; color: string; icon: ReactNode; url: string; kind: "kml" | "geojson"; description: string; featured?: boolean };

const PAGES_BASE = import.meta.env.BASE_URL || "/";
  const isPublicRoute = typeof window !== "undefined" && (window.location.pathname.includes("/public") || window.location.pathname === "/");
  const canUsePublicEditor = false;
const pagesAsset = (name: string) => `${PAGES_BASE}${name}`;
const dataAsset = (name: string) => `${PAGES_BASE}data/${name}`;

const DATA = {
  projectLogo: pagesAsset("assets/atlas-project-logo-approved.png"),
  ministryLogo: pagesAsset("assets/ministry-logo-approved.png"),
  centerLogo: pagesAsset("assets/tidc-logo.png"),
  hero: pagesAsset("libya-atlas-hero_ebb8b2b9.jpg"),
  desert: pagesAsset("libya-atlas-desert_8d3e876d.jpg"),
  heritage: pagesAsset("libya-atlas-heritage_baefbb7e.jpg"),
  cover: pagesAsset("libya-atlas-cover-gis-landscape_22a918d0.png"),
  intro: pagesAsset("assets/atlas-intro-cover.webp"),
};

const INITIAL_CENTER: [number, number] = [27.2, 17.2];

const layerIconRegistry: Record<string, ReactNode> = {
  landmark: <Landmark size={19} strokeWidth={1.8} />,
  nature: <Trees size={19} strokeWidth={1.8} />,
  mountain: <Mountain size={19} strokeWidth={1.8} />,
  hotel: <Hotel size={19} strokeWidth={1.8} />,
  food: <Utensils size={19} strokeWidth={1.8} />,
  beach: <Waves size={19} strokeWidth={1.8} />,
  investment: <TrendingUp size={19} strokeWidth={1.8} />,
  city: <Building2 size={19} strokeWidth={1.8} />,
  layer: <Layers3 size={19} strokeWidth={1.8} />,
};

const layers: LayerConfig[] = [
  { id: "heritage", name: "التراث العالمي", short: "مواقع أثرية وتاريخية", color: "#B96D3B", icon: <Landmark size={19} strokeWidth={1.8} />, url: dataAsset("world-heritage_ae1639b4.kml"), kind: "kml", description: "مواقع التراث العالمي والمكونات التابعة لها", featured: true },
  { id: "natural", name: "الموارد الطبيعية", short: "مشاهد وجغرافيا طبيعية", color: "#287A70", icon: <Trees size={19} strokeWidth={1.8} />, url: dataAsset("natural-atlas-with-media_5ccb1fb0.geojson"), kind: "geojson", description: "سجل أطلس الموارد الطبيعية الليبية" },
  { id: "akakus", name: "تادرارت أكاكوس", short: "الفن الصخري والصحراء", color: "#A76027", icon: <Mountain size={19} strokeWidth={1.8} />, url: dataAsset("akakus_60c47b41.kml"), kind: "kml", description: "الفن الصخري والمشهد الصحراوي" },
  { id: "old-tripoli", name: "المدينة القديمة طرابلس", short: "معالم تاريخية", color: "#3E7183", icon: <Building2 size={19} strokeWidth={1.8} />, url: dataAsset("old-tripoli_5c62867b.kml"), kind: "kml", description: "مبانٍ ومعالم المدينة القديمة" },
  { id: "hotels", name: "الفنادق والإيواء", short: "خدمات الضيافة", color: "#B34B42", icon: <Hotel size={19} strokeWidth={1.8} />, url: dataAsset("hotels_b9547235.kml"), kind: "kml", description: "الفنادق ومنشآت الإيواء" },
  { id: "resorts", name: "القرى والمنتجعات", short: "سياحة ساحلية", color: "#3D8C8A", icon: <Waves size={19} strokeWidth={1.8} />, url: dataAsset("resorts_e4a8f065.kml"), kind: "kml", description: "القرى والمنتجعات والشاليهات" },
  { id: "density", name: "كثافة التجمعات السياحية", short: "فنادق وقرى ومنتجعات", color: "#D04C45", icon: <Activity size={19} strokeWidth={1.8} />, url: "", kind: "geojson", description: "توزيع مكاني محسوب من سجلات الفنادق والقرى والمنتجعات" },
  { id: "investment", name: "فرص الاستثمار", short: "مشاريع وتنمية", color: "#AF7A24", icon: <TrendingUp size={19} strokeWidth={1.8} />, url: dataAsset("investment_de22d4a0.kml"), kind: "kml", description: "المشاريع والفرص الاستثمارية السياحية" },
  { id: "food", name: "المطاعم والمقاهي", short: "خدمات الطعام", color: "#855D42", icon: <Utensils size={19} strokeWidth={1.8} />, url: dataAsset("restaurants_0642e048.kml"), kind: "kml", description: "مطاعم ومقاهٍ في طرابلس" },
  { id: "favorites", name: "المواقع المفضلة", short: "مختارات الأطلس", color: "#C08A2E", icon: <Star size={19} strokeWidth={1.8} />, url: "", kind: "geojson", description: "مختارات من المواقع الطبيعية والتراثية المميزة" },
];

const layerMarkerGlyphs: Record<string, string> = {
  heritage: "♜",
  natural: "✿",
  akakus: "◇",
  "old-tripoli": "⌂",
  hotels: "▣",
  resorts: "≈",
  density: "◎",
  investment: "◆",
  food: "✦",
  favorites: "★",
};

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

function parseKmlDocument(text: string) {
  const parser = new DOMParser();
  const initial = parser.parseFromString(text, "text/xml");
  if (!initial.querySelector("parsererror")) return initial;
  const sanitized = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/gi, "&amp;");
  return parser.parseFromString(sanitized, "text/xml");
}

function parseKml(text: string, layerId: string): Site[] {
  const xml = parseKmlDocument(text);
  return Array.from(xml.querySelectorAll("Placemark")).map((node, index) => {
    const name = node.querySelector("name")?.textContent?.trim() || `موقع ${index + 1}`;
    const descriptionNode = node.querySelector("description");
    const rawDescription = descriptionSourceText(descriptionNode?.textContent, descriptionNode?.innerHTML);
    const description = cleanUserFacingKmlDescription(rawDescription);
    const coordinateText = node.querySelector("Point coordinates, coordinates")?.textContent?.trim() || node.querySelector("coordinates")?.textContent?.trim() || "";
    const [lng, lat] = coordinateText.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const properties: Record<string, string> = {};
    node.querySelectorAll("ExtendedData Data").forEach((item) => {
      const key = item.getAttribute("name");
      if (key) properties[key] = item.querySelector("value")?.textContent?.trim() || "";
    });
    const imageRights = normalizeKmlImageRights(properties);
    if (imageRights.author) properties.image_author = imageRights.author;
    if (imageRights.license) properties.image_license = imageRights.license;
    if (imageRights.note) properties.image_license_note = imageRights.note;
    const extractedImageSources = extractKmlImageUrls(rawDescription, properties);
    const verifiedFallback = extractedImageSources.length ? undefined : verifiedSiteImageFallback(name);
    const imageSources = extractedImageSources.length ? extractedImageSources : (verifiedFallback?.image_source ? [verifiedFallback.image_source] : []);
    const imageSource = imageSources[0];
    const imageUrl = toDisplayImageUrl(imageSource);
    if (imageSource) properties.image_source = imageSource;
    if (imageSources.length) {
      properties.image_sources = JSON.stringify(imageSources);
      properties.image_urls = JSON.stringify(imageSources.map(toDisplayImageUrl).filter(Boolean));
    }
    if (imageUrl) properties.image_url = imageUrl;
    if (verifiedFallback) {
      properties.image_author = verifiedFallback.image_author;
      properties.image_license = verifiedFallback.image_license;
      properties.image_license_note = verifiedFallback.image_license_note;
      properties.image_source_type = "verified_commons_fallback";
    }
    properties.source_layer = layerId;
    properties.source_format = "KML";
    const normalizedProperties = normalizeRecordStatus(properties);
    return { id: `${layerId}-${index}`, name, description, lat, lng, imageUrl, properties: normalizedProperties, layerId };
  }).filter(Boolean) as Site[];
}

function propertyName(properties: Record<string, unknown>) {
  return String(properties.name_ar || properties.name || properties.title || properties.name_en || "موقع موثق");
}

function parseMetadata(raw: string | null) {
  if (!raw) return {} as Record<string, string>;
  try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
}

function imageSourcesForSite(site: Site) {

  const raw = site.properties.image_sources;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://")));
    } catch { /* keep the single-source fallback */ }
  }
  return [site.properties.image_source || site.imageUrl].filter((value): value is string => Boolean(value));
}

function imageCandidates(source: string) {
  return Array.from(new Set([toDisplayImageUrl(source), toFallbackImageUrl(source), source].filter((value): value is string => Boolean(value))));
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
    const imageSource = String(properties.image_source || properties.imageUrl || properties.image || properties.photo || properties.photo_URL || "").trim() || undefined;
    const imageUrl = toDisplayImageUrl(imageSource);
    if (imageSource) properties.image_source = imageSource;
    if (imageUrl) properties.image_url = imageUrl;
    properties.source_layer = config.id;
    properties.source_format = "GeoJSON";
    const normalizedProperties = normalizeRecordStatus(properties);
    return [{ id: `${config.id}-${index}`, name: propertyName(normalizedProperties), description: String(normalizedProperties.description_ar || normalizedProperties.description || ""), lat: point[1], lng: point[0], imageUrl, properties: normalizedProperties, layerId: config.id }];
  });
}

export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  let { user, loading, error, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [hasEnteredAtlas, setHasEnteredAtlas] = useState(false);
  const [language, setLanguage] = useState<"ar" | "en">(() => (typeof window !== "undefined" && window.localStorage.getItem("atlas-language") === "en" ? "en" : "ar"));
  const [headerSearch, setHeaderSearch] = useState("");
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const [activeLayers, setActiveLayers] = useState<string[]>([]);
  const persistedDocumentationLayers = trpc.atlas.layers.useQuery();
  const customDocumentationLayers = persistedDocumentationLayers.data ?? [];
  const customLayerConfigs = useMemo<LayerConfig[]>(() => customDocumentationLayers.map((layer) => ({
    id: layer.id,
    name: layer.label,
    short: layer.description || "طبقة مضافة من مسؤول النظام",
    color: layer.color,
    icon: layerIconRegistry[layer.icon] || layerIconRegistry.layer,
    url: "",
    kind: "geojson",
    description: layer.description || layer.label,
  })), [customDocumentationLayers]);
  const allLayerConfigs = useMemo(() => [...layers, ...customLayerConfigs], [customLayerConfigs]);
  const managedLayerIds = useMemo(() => new Set(customLayerConfigs.map((layer) => layer.id)), [customLayerConfigs]);
  const [loaded, setLoaded] = useState<Record<string, Site[]>>({});
  const [query, setQuery] = useState("");
  useEffect(() => {
    const onScroll = () => setHeaderCompact(window.scrollY > 34);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    window.localStorage.setItem("atlas-language", language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);
  const selectedLanguageLabels = language === "ar" ? { project: "أطلس ليبيا", tourism: "السياحي", eyebrow: "مشروع وطني للتوثيق والاستكشاف", slogan: "ليبيا ... مهد الحضارات وموطن السحر والجمال", official1: "وزارة السياحة والصناعات التقليدية", official2: "مركز المعلومات والتوثيق السياحي", supervised: "الجهة المشرفة", implemented: "الجهة المنفذة", search: "ابحث عن معلم أو مدينة ليبية…", edition: "نسخة العرض المؤسسية · 2026", gis: "خريطة وطنية" } : { project: "Libya Tourism", tourism: "Atlas", eyebrow: "National documentation and discovery project", slogan: "Libya ... cradle of civilizations and home of magic and beauty", official1: "Ministry of Tourism and Traditional Industries", official2: "Tourism Information and Documentation Center", supervised: "Supervising authority", implemented: "Implementing authority", search: "Search a landmark or Libyan city…", edition: "Institutional edition · 2026", gis: "National map" };
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMunicipality, setSelectedMunicipality] = useState("all");
  const [selectedLayer, setSelectedLayer] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedHeritageCategory, setSelectedHeritageCategory] = useState("all");
  const [selectedNaturalCategory, setSelectedNaturalCategory] = useState("all");
  const [selectedInvestmentCategory, setSelectedInvestmentCategory] = useState("all");
  const [selectedResortCategory, setSelectedResortCategory] = useState("all");
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionType, setSuggestionType] = useState<"edit" | "image">("edit");
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionCategory, setSuggestionCategory] = useState("");
  const [suggestionImageDataUrl, setSuggestionImageDataUrl] = useState("");
  const [suggestionImageName, setSuggestionImageName] = useState("");
  const [suggestionImageType, setSuggestionImageType] = useState("");
  const [suggestionSourceUrl, setSuggestionSourceUrl] = useState("");
  const [suggestionSourceKind, setSuggestionSourceKind] = useState("custom");
  const [suggestionRightsNote, setSuggestionRightsNote] = useState("");
  const [assistantMode, setAssistantMode] = useState<"researcher" | "tourist" | "visitor">("visitor");
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [nearbyLayerFilter, setNearbyLayerFilter] = useState("all");
  const [nearbyCategoryFilter, setNearbyCategoryFilter] = useState("all");
  const [nearbyFocusedId, setNearbyFocusedId] = useState<string | null>(null);
  const [routeHours, setRouteHours] = useState("8");
  const [routeInterests, setRouteInterests] = useState("تراث، طبيعة");
  const [selected, setSelected] = useState<Site | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageDisplayUrl, setImageDisplayUrl] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [map, setMap] = useState<L.Map | null>(null);
  const [mapViewport, setMapViewport] = useState<AtlasViewport | null>(null);
  const [clusterGroup, setClusterGroup] = useState<L.MarkerClusterGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadingLayers, setLoadingLayers] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [draftPoint, setDraftPoint] = useState({ layerId: "heritage", name: "", description: "", municipality: "", category: "", source: "", latitude: "", longitude: "", metadata: "", imageDataUrl: "", imageFileName: "", imageContentType: "" });
  const markers = useRef<Record<string, L.Layer[]>>({});
  const assistantHighlightLayer = useRef<L.LayerGroup | null>(null);
  const routeLine = useRef<L.Polyline | null>(null);
  const publishedPoints = trpc.atlas.published.useQuery({});
  const pendingTop150 = trpc.atlas.top150PendingMarkers.useQuery(undefined, { enabled: !isPublicRoute && Boolean(isAuthenticated && user?.role === "admin") });
  const adminPoints = trpc.atlas.mine.useQuery(undefined, { enabled: Boolean(isAuthenticated && user?.role === "admin") });
  const trpcUtils = trpc.useUtils();
  const handleMapReady = useCallback((instance: L.Map) => { setMap(instance); setMapReady(true); }, []);
  const handleClusterReady = useCallback((cluster: L.MarkerClusterGroup) => { setClusterGroup(cluster); }, []);
  useEffect(() => {
    if (!map) return;
    const updateViewport = () => { const bounds = map.getBounds(); setMapViewport({ south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast(), zoom: map.getZoom() }); };
    updateViewport();
    map.on("moveend zoomend", updateViewport);
    return () => { map.off("moveend zoomend", updateViewport); };
  }, [map]);
  const smartSearch = trpc.atlas.smartSearch.useMutation();
  const routePlan = trpc.atlas.routePlan.useMutation();
  const submitSuggestion = trpc.atlas.submitSuggestion.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال الاقتراح للمراجعة قبل النشر");
      setSuggestionOpen(false);
      setSuggestionText(""); setSuggestionCategory(""); setSuggestionImageDataUrl(""); setSuggestionImageName(""); setSuggestionImageType(""); setSuggestionSourceUrl(""); setSuggestionRightsNote("");
    },
    onError: (error) => toast.error(error.message || "تعذر إرسال الاقتراح"),
  });
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
  const headerSearchResults = useMemo(() => {
    const needle = headerSearch.trim().toLocaleLowerCase();
    if (!needle) return [];
    return activeSites.filter((site) => `${site.name} ${Object.values(site.properties).join(" ")}`.toLocaleLowerCase().includes(needle)).slice(0, 6);
  }, [activeSites, headerSearch]);
  const siteValue = (site: Site, keys: string[]) => keys.map((key) => site.properties[key] || site.properties[key.toLowerCase()]).find(Boolean) || "";
  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const municipalities = new Set<string>();
    const statuses = new Set<string>();
    activeSites.forEach((site) => {
      const category = inferAtlasCategory(site);
      const municipality = siteValue(site, ["municipality", "municipality_name", "بلدية", "البلدية", "city"]);
      const status = siteValue(site, ["status", "حالة السجل", "الحالة"]) || "منشور";
      if (category) categories.add(category);
      if (municipality) municipalities.add(municipality);
      statuses.add(status);
    });
    return { categories: Array.from(new Set(atlasCategoryFamilies().concat(Array.from(categories)))).sort((a, b) => a.localeCompare(b, "ar")), municipalities: Array.from(municipalities).sort((a, b) => a.localeCompare(b, "ar")), statuses: Array.from(statuses).sort((a, b) => a.localeCompare(b, "ar")) };
  }, [activeSites]);
  const assistantSites = useMemo(() => activeSites.slice(0, 120).map((site) => ({ id: site.id, name: site.name, description: site.description, latitude: site.lat, longitude: site.lng, layerId: site.layerId, category: siteValue(site, ["category", "type", "classification", "التصنيف"]), municipality: siteValue(site, ["municipality", "municipality_name", "بلدية", "البلدية", "city"]), source: siteValue(site, ["source", "المصدر"]) || "سجلات أطلس ليبيا السياحي" })), [activeSites]);
  const categoryOptionsForLayer = useCallback((layerId: string) => Array.from(new Set(activeSites.filter((site) => site.layerId === layerId).map((site) => siteValue(site, ["category", "type", "classification", "التصنيف", "Subcategory_التصنيف الفرعي", "primary_category", "category_enriched"])).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [activeSites]);
  const heritageCategoryOptions = useMemo(() => categoryOptionsForLayer("heritage"), [categoryOptionsForLayer]);
  const naturalCategoryOptions = useMemo(() => categoryOptionsForLayer("natural"), [categoryOptionsForLayer]);
  const investmentCategoryOptions = useMemo(() => categoryOptionsForLayer("investment"), [categoryOptionsForLayer]);
  const resortCategoryOptions = useMemo(() => categoryOptionsForLayer("resorts"), [categoryOptionsForLayer]);
  const visibleSites = useMemo(() => {
    const filtered = filterAtlasSites(activeSites, { query, category: selectedCategory, municipality: selectedMunicipality, layerId: selectedLayer, status: selectedStatus });
    return filtered.filter((site) => {
      const siteCategory = siteValue(site, ["category", "type", "classification", "التصنيف", "Subcategory_التصنيف الفرعي", "primary_category", "category_enriched"]);
      if (site.layerId === "heritage" && selectedHeritageCategory !== "all" && !siteCategory.includes(selectedHeritageCategory)) return false;
      if (site.layerId === "natural" && selectedNaturalCategory !== "all" && !siteCategory.includes(selectedNaturalCategory)) return false;
      if (site.layerId === "investment" && selectedInvestmentCategory !== "all" && !siteCategory.includes(selectedInvestmentCategory)) return false;
      if (site.layerId === "resorts" && selectedResortCategory !== "all" && !siteCategory.includes(selectedResortCategory)) return false;
      return true;
    });
  }, [activeSites, query, selectedCategory, selectedMunicipality, selectedLayer, selectedStatus, selectedHeritageCategory, selectedNaturalCategory, selectedInvestmentCategory, selectedResortCategory]);
  const nearbySites = useMemo(() => {
    if (!mapViewport) return [] as Array<Site & { distanceKm: number }>;
    return nearbyPoints(visibleSites, mapViewport, 12);
  }, [mapViewport, visibleSites]);
  const nearbyLayerOptions = useMemo(() => Array.from(new Set(nearbySites.map((site) => site.layerId))).sort(), [nearbySites]);
  const nearbyCategoryOptions = useMemo(() => Array.from(new Set(nearbySites.map((site) => siteValue(site, ["category", "type", "classification", "التصنيف", "category_enriched"])).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar")), [nearbySites]);
  const filteredNearbySites = useMemo(() => nearbySites.filter((site) => {
    const category = siteValue(site, ["category", "type", "classification", "التصنيف", "category_enriched"]);
    return (nearbyLayerFilter === "all" || site.layerId === nearbyLayerFilter) && (nearbyCategoryFilter === "all" || category === nearbyCategoryFilter);
  }), [nearbySites, nearbyLayerFilter, nearbyCategoryFilter]);
  const nearbyFocused = useMemo(() => filteredNearbySites.find((site) => site.id === nearbyFocusedId) || null, [filteredNearbySites, nearbyFocusedId]);
  const assistantMentionedSites = useMemo(() => {
    const ids = smartSearch.data?.matchedIds || [];
    return activeSites.filter((site) => ids.some((id) => id === site.id || id === site.id.replace(/^managed-/, "")));
  }, [activeSites, smartSearch.data?.matchedIds]);
  const siteSummary = (site: Site) => site.description || siteValue(site, ["historical_summary", "summary", "الوصف", "نبذة", "description"]) || `موقع موثق ضمن طبقة ${site.layerId}.`;
  const dataPending = activeLayers.some((id) => !managedLayerIds.has(id) && id !== "density" && id !== "favorites" && !loaded[id]) || (activeLayers.includes("density") && (!loaded.hotels || !loaded.resorts)) || (activeLayers.includes("favorites") && !loaded.favorites);
  const isAtlasLoading = !mapReady || dataPending || loadingLayers.length > 0;

  useEffect(() => {
    if (!map) return;
    assistantHighlightLayer.current?.removeFrom(map);
    assistantHighlightLayer.current = null;
    if (!assistantMentionedSites.length) return;
    const layer = L.layerGroup();
    assistantMentionedSites.forEach((site) => {
      const marker = L.marker([site.lat, site.lng], { icon: L.divIcon({ className: "assistant-highlight-marker-wrap", html: `<span class="assistant-highlight-marker" aria-label="موقع مقترح من مساعد أطلس">✦</span>`, iconSize: [42, 42], iconAnchor: [21, 21] }), zIndexOffset: 900 });
      marker.bindTooltip(`اقتراح مساعد أطلس: ${site.name}`, { direction: "top", opacity: 0.98 });
      marker.on("click", () => { setSelected(site); setNearbyFocusedId(site.id); });
      marker.addTo(layer);
    });
    layer.addTo(map);
    assistantHighlightLayer.current = layer;
    return () => { layer.removeFrom(map); if (assistantHighlightLayer.current === layer) assistantHighlightLayer.current = null; };
  }, [map, assistantMentionedSites]);

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
      const marker = L.marker([site.lat, site.lng], { icon: L.divIcon({ className: "atlas-layer-marker-wrap", html: `<span class="atlas-layer-marker" style="--marker-color:${config.color}">${layerMarkerGlyphs[config.id] || "•"}</span>`, iconSize: [34, 38], iconAnchor: [17, 34] }) });
      marker.addTo(clusterGroup || map);
      marker.bindTooltip(site.name, { direction: "top", offset: [0, -7], opacity: 0.95 });
      marker.on("click", () => { setSelected(site); setMobileOpen(false); });
      return [halo, marker];
    });
  }, [clearMarkers, map, clusterGroup]);

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
    const pendingIds = activeLayers.filter((id) => !managedLayerIds.has(id) && id !== "density" && id !== "favorites" && !loaded[id]);
    if (activeLayers.includes("density") && (!loaded.hotels || !loaded.resorts)) pendingIds.push("density");
    if (activeLayers.includes("favorites") && !loaded.favorites) pendingIds.push("favorites");
    setLoadingLayers(Array.from(new Set(pendingIds)));
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
    activeLayers.filter((id) => !managedLayerIds.has(id) && id !== "density").forEach(async (id) => {
      const config = layers.find((item) => item.id === id);
      if (!config || loaded[id]) { if (config && loaded[id]) renderMarkers(config, loaded[id]); return; }
      try {
        const sites = await loadLayer(config);
        setLoaded((current) => ({ ...current, [id]: sites }));
        renderMarkers(config, sites);
      } catch (error) {
        toast.error(`تعذر تحميل طبقة ${config.name}`);
      } finally {
        setLoadingLayers((current) => current.filter((item) => item !== id));
      }
    });
    Object.keys(markers.current).filter((id) => id !== "managed" && !activeLayers.includes(id)).forEach(clearMarkers);
  }, [activeLayers, map, loaded, renderMarkers, renderDensity, clearMarkers, managedLayerIds]);

  useEffect(() => {
    if (!map) return;
    clearMarkers("pendingTop150");
    markers.current.pendingTop150 = (pendingTop150.data ?? []).map((item) => {
      const marker = L.marker([item.lat, item.lng], { icon: L.divIcon({ className: "atlas-pending-marker", html: '<span style="display:grid;place-items:center;width:28px;height:28px;border:2px solid #fff;border-radius:999px;background:#b34b42;color:#fff;font-size:16px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.28)">!</span>', iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(clusterGroup || map);
      marker.bindTooltip(`بانتظار الاعتماد اليدوي · ${item.name} · ${item.region}`, { direction: "top", opacity: 0.96 });
      marker.on("click", () => toast.info(`هذا الموقع بانتظار مراجعة فريق التوثيق: ${item.name}`));
      return marker;
    });
    return () => clearMarkers("pendingTop150");
  }, [map, clusterGroup, pendingTop150.data, clearMarkers]);

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
    setImageFailed(false);
    setImageDisplayUrl(selected?.properties.image_source || selected?.imageUrl || null);
  }, [selected?.id, selected?.imageUrl, selected?.properties.image_source]);

  useEffect(() => {
    if (!map || visibleSites.length === 0) return;
    if (!query && selectedMunicipality === "all" && selectedLayer === "all" && selectedCategory === "all" && selectedStatus === "all") return;
    const bounds = L.latLngBounds(visibleSites.map((site) => [site.lat, site.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [42, 42], maxZoom: visibleSites.length === 1 ? 13 : 10, animate: true });
  }, [query, selectedMunicipality, selectedLayer, selectedCategory, selectedStatus, map, visibleSites]);

  const toggleLayer = (id: string, checked: boolean) => {
    setQuery("");
    setSelectedCategory("all");
    setSelectedMunicipality("all");
    setSelectedStatus("all");
    setSelectedLayer(checked ? id : "all");
    setActiveLayers((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));
  };
  const focusLibya = () => map?.flyTo(INITIAL_CENTER, 5, { duration: 0.8, easeLinearity: 0.25 });
  const focusSite = useCallback((site: Site, zoom = 13) => map?.flyTo([site.lat, site.lng], zoom, { duration: 0.75, easeLinearity: 0.25 }), [map]);
  const submitVisitorSuggestion = () => {
    if (!isAuthenticated) { startLogin(); return; }
    if (!selected) return;
    submitSuggestion.mutate({ pointId: Number(selected.id.replace(/^managed-/, "")) || undefined, suggestionType, proposedDescription: suggestionText || undefined, proposedCategory: suggestionCategory || undefined, imageDataUrl: suggestionImageDataUrl || undefined, fileName: suggestionImageName || undefined, contentType: suggestionImageType || undefined, sourceUrl: suggestionSourceUrl || undefined, sourceKind: suggestionSourceKind as any, rightsNote: suggestionRightsNote || "مصدر الصورة وحقوق استخدامها قيد مراجعة فريق الأطلس." });
  };
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
    <main dir={language === "ar" ? "rtl" : "ltr"} className="atlas-shell">
      <header className={`topbar ${headerCompact ? "is-compact" : ""}`} data-visual-language="national-institutional">
        <div className="brand-lockup"><div className="project-mark"><img className="project-logo" src={DATA.projectLogo} alt="شعار مشروع أطلس ليبيا السياحي" /></div><div className="brand-title"><span className="eyebrow">{selectedLanguageLabels.eyebrow}</span><h1>{selectedLanguageLabels.project} <em>{selectedLanguageLabels.tourism}</em></h1><small className="brand-slogan">{selectedLanguageLabels.slogan}</small></div><div className="official-logos" aria-label="الجهات الرسمية المشرفة على المشروع"><div className="official-logo-cell"><img src={DATA.ministryLogo} alt="شعار وزارة السياحة والصناعات التقليدية" /><div><span className="official-kicker">{selectedLanguageLabels.supervised}</span><strong>{selectedLanguageLabels.official1}</strong></div></div><div className="official-logo-cell"><img src={DATA.centerLogo} alt="شعار مركز المعلومات والتوثيق السياحي" /><div><span className="official-kicker">{selectedLanguageLabels.implemented}</span><strong>{selectedLanguageLabels.official2}</strong></div></div></div></div>
        <div className="topbar-quick-search"><Search size={16} aria-hidden="true" /><input value={headerSearch} onFocus={() => setHeaderSearchOpen(true)} onChange={(event) => { setHeaderSearch(event.target.value); setHeaderSearchOpen(true); }} placeholder={selectedLanguageLabels.search} aria-label={selectedLanguageLabels.search} />{headerSearch && <button type="button" onClick={() => { setHeaderSearch(""); setHeaderSearchOpen(false); }} aria-label={language === "ar" ? "مسح البحث" : "Clear search"}><X size={14} /></button>}{headerSearchOpen && headerSearch.trim() && <div className="topbar-search-results">{headerSearchResults.length ? headerSearchResults.map((site) => <button type="button" key={site.id} onClick={() => { setQuery(site.name); setHeaderSearch(site.name); setHeaderSearchOpen(false); setSelected(site); focusSite(site, 12); }}>{site.name}<small>{siteValue(site, ["municipality", "city", "البلدية"]) || (language === "ar" ? "معلم موثق" : "Documented site")}</small></button>) : <span>{language === "ar" ? "لا توجد نتائج ضمن الطبقات النشطة" : "No results in active layers"}</span>}</div>}</div>
        <div className="topbar-actions"><Button type="button" variant="ghost" size="sm" className="language-toggle" onClick={() => setLanguage((current) => current === "ar" ? "en" : "ar")} aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}><Languages size={15} /><span>{language === "ar" ? "EN" : "عربي"}</span></Button><Button type="button" variant="ghost" size="icon" className="theme-toggle" onClick={() => toggleTheme?.()} aria-label={theme === "dark" ? "التبديل إلى الوضع النهاري" : "التبديل إلى الوضع الليلي"} title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</Button><div className="header-gis-badge"><Layers3 size={14} /><span>GIS</span><small>{selectedLanguageLabels.gis}</small></div><span className="edition"><span className="status-dot" /> {selectedLanguageLabels.edition}</span>{!isPublicRoute && <Button className="system-admin-topbar-button" variant="outline" size="sm" onClick={() => { if (isAuthenticated && user?.role === "admin") { window.location.href = `${import.meta.env.BASE_URL}management`; } else { startLogin(); } }}><ShieldCheck size={15} /> مسؤول النظام</Button>}<Button variant="ghost" size="icon" className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="فتح قائمة الطبقات"><Menu /></Button></div>
      </header>


      <section className="atlas-main">
        <aside className="control-panel">
          <div className="panel-intro"><div className="intro-kicker"><Sparkles size={14} /> من المعلومة إلى القرار</div><h2>ليبيا، كما تُروى عبر المكان.</h2><p>منصة جغرافية لتوثيق المقومات السياحية والتاريخية والطبيعية والخدمية، وربطها بمشهد واحد قابل للاستكشاف.</p></div>
          <div className="search-box"><Search size={18} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم موقع أو مدينة…" aria-label="البحث داخل المواقع" />{query && <button onClick={() => setQuery("")} aria-label="مسح البحث"><X size={15} /></button>}</div>
          {(query || selectedCategory !== "all" || selectedMunicipality !== "all" || selectedLayer !== "all" || selectedStatus !== "all" || selectedHeritageCategory !== "all" || selectedNaturalCategory !== "all" || selectedInvestmentCategory !== "all" || selectedResortCategory !== "all") && <div className="search-results" aria-live="polite"><div className="search-results-heading"><span>نتائج البحث</span><strong>{visibleSites.length.toLocaleString("ar-LY")}</strong></div>{visibleSites.length === 0 ? <p className="search-empty">لا توجد سجلات مطابقة ضمن الطبقات النشطة.</p> : <div className="search-result-list">{visibleSites.slice(0, 8).map((site) => <button type="button" key={site.id} onClick={() => { setSelected(site); focusSite(site, 12); }}><span>{site.name}</span><small>{siteValue(site, ["municipality", "municipality_name", "بلدية", "البلدية", "city"]) || "موقع موثق"}</small></button>)}</div>}</div>}
          <div className="filter-panel" aria-label="الفلاتر المتقدمة"><div className="filter-heading"><span><SlidersHorizontal size={14} /> تصفية السجلات</span><button onClick={() => { setSelectedCategory("all"); setSelectedMunicipality("all"); setSelectedLayer("all"); setSelectedStatus("all"); setSelectedHeritageCategory("all"); setSelectedNaturalCategory("all"); setSelectedInvestmentCategory("all"); setSelectedResortCategory("all"); }} type="button">إعادة ضبط</button></div><div className="category-filter-chips" aria-label="تصفية سريعة حسب الفئة"><button type="button" className={selectedCategory === "all" ? "is-selected" : ""} aria-pressed={selectedCategory === "all"} onClick={() => setSelectedCategory("all")}>الكل</button>{filterOptions.categories.map((category) => <button type="button" key={category} className={selectedCategory === category ? "is-selected" : ""} aria-pressed={selectedCategory === category} onClick={() => setSelectedCategory(category)}>{category}</button>)}</div><div className="filter-grid"><label>الطبقة<select value={selectedLayer} onChange={(event) => setSelectedLayer(event.target.value)}><option value="all">كل الطبقات</option>{layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}{customDocumentationLayers.map((layer) => <option key={layer.id} value={layer.id}>{layer.icon} {layer.label}</option>)}</select></label><label>التصنيف<select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="all">كل الأنواع</option>{filterOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label>البلدية<select value={selectedMunicipality} onChange={(event) => setSelectedMunicipality(event.target.value)}><option value="all">كل البلديات</option>{filterOptions.municipalities.map((municipality) => <option key={municipality} value={municipality}>{municipality}</option>)}</select></label><label>الحالة<select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}><option value="all">كل الحالات</option>{filterOptions.statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label></div>{activeLayers.includes("heritage") && heritageCategoryOptions.length > 0 && <label className="heritage-category-filter">تصنيف مواقع التراث العالمي<select value={selectedHeritageCategory} onChange={(event) => setSelectedHeritageCategory(event.target.value)}><option value="all">كل التصنيفات التاريخية</option>{heritageCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>}{activeLayers.includes("natural") && naturalCategoryOptions.length > 0 && <label className="heritage-category-filter">تصنيف المواقع الطبيعية<select value={selectedNaturalCategory} onChange={(event) => setSelectedNaturalCategory(event.target.value)}><option value="all">كل المواقع الطبيعية</option>{naturalCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>}{activeLayers.includes("investment") && investmentCategoryOptions.length > 0 && <label className="heritage-category-filter">تصنيف فرص الاستثمار<select value={selectedInvestmentCategory} onChange={(event) => setSelectedInvestmentCategory(event.target.value)}><option value="all">كل فرص الاستثمار</option>{investmentCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>}{activeLayers.includes("resorts") && resortCategoryOptions.length > 0 && <label className="heritage-category-filter">تصنيف القرى والمنتجعات<select value={selectedResortCategory} onChange={(event) => setSelectedResortCategory(event.target.value)}><option value="all">كل القرى والمنتجعات</option>{resortCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>}</div>
          <div className="ai-panel"><div className="ai-panel-heading"><span><Sparkles size={14} /> البحث الذكي الموثق</span><select value={assistantMode} onChange={(event) => setAssistantMode(event.target.value as typeof assistantMode)}><option value="visitor">زائر</option><option value="tourist">سائح</option><option value="researcher">باحث</option></select></div><p>مساعد معرفي يجيب من السجلات المنشورة فقط، ويعرض المواقع المطابقة ومصادرها وحدود الثقة.</p>{mapViewport && <div className="nearby-context"><span><MapPinned size={13} /> النطاق الحالي · {filteredNearbySites.length.toLocaleString("ar-LY")} نقاط مقترحة</span><div className="nearby-filters"><label>الطبقة<select value={nearbyLayerFilter} onChange={(event) => setNearbyLayerFilter(event.target.value)}><option value="all">كل الطبقات</option>{nearbyLayerOptions.map((layerId) => <option key={layerId} value={layerId}>{layerId}</option>)}</select></label><label>الفئة<select value={nearbyCategoryFilter} onChange={(event) => setNearbyCategoryFilter(event.target.value)}><option value="all">كل الفئات</option>{nearbyCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label></div>{filteredNearbySites.slice(0, 4).map((site) => <button type="button" className={nearbyFocusedId === site.id ? "is-focused" : ""} key={site.id} onClick={() => { setNearbyFocusedId(site.id); setSelected(site); focusSite(site, Math.max(12, mapViewport.zoom + 2)); }} title={`تبعد نحو ${site.distanceKm.toFixed(1)} كم عن مركز العرض`}>{site.name}<small>{site.distanceKm < 1 ? "أقل من 1 كم" : `${Math.round(site.distanceKm).toLocaleString("ar-LY")} كم`}</small></button>)}{nearbyFocused && <div className="nearby-summary"><strong>{nearbyFocused.name}</strong><p>{siteSummary(nearbyFocused)}</p><small>ملخص مستند إلى سجل الأطلس المنشور · {siteValue(nearbyFocused, ["category", "type", "classification", "التصنيف"]) || "معلم موثق"}</small></div>}</div>}<div className="ai-quick-prompts" aria-label="أسئلة مقترحة"><button type="button" onClick={() => setAssistantQuestion("ما أبرز المواقع الأثرية المناسبة للزيارة؟")}>أبرز المواقع الأثرية</button><button type="button" onClick={() => setAssistantQuestion("ما أفضل مسار يجمع الطبيعة والتراث؟")}>مسار طبيعة وتراث</button><button type="button" onClick={() => setAssistantQuestion("ما المواقع المناسبة للباحثين؟")}>وضع الباحث</button><button type="button" onClick={() => setAssistantQuestion("ما نقاط الاهتمام القريبة من النطاق الظاهر حاليًا؟")}>القريب من الخريطة</button></div><div className="ai-question"><Input value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} placeholder="مثال: ما المواقع الأثرية المناسبة لزيارة قصيرة؟" aria-label="سؤال البحث الذكي" /><Button size="sm" disabled={!assistantQuestion.trim() || smartSearch.isPending} onClick={() => smartSearch.mutate({ question: assistantQuestion, mode: assistantMode, viewport: mapViewport || undefined, nearbyIds: filteredNearbySites.map((site) => site.id), nearbyNames: filteredNearbySites.map((site) => site.name) })}>{smartSearch.isPending ? "يبحث..." : "اسأل"}</Button></div>{smartSearch.error && <div className="ai-answer"><strong>تعذر إكمال البحث الذكي حاليًا.</strong><small>يمكنك تضييق الفلاتر أو المحاولة مرة أخرى. لا يتم عرض معلومات غير موثقة.</small></div>}{smartSearch.data && <div className="ai-answer"><div className="ai-answer-meta"><span className={`ai-confidence ai-confidence-${smartSearch.data.confidence}`}>{smartSearch.data.confidence === "high" ? "ثقة مرتفعة" : smartSearch.data.confidence === "medium" ? "ثقة متوسطة" : "ثقة محدودة"}</span><span>مصدرها سجلات الأطلس المنشورة</span></div><strong>{smartSearch.data.answer}</strong>{smartSearch.data.matchedIds.length > 0 && <small>السجلات المطابقة: {smartSearch.data.matchedIds.map((id) => activeSites.find((site) => site.id === id)?.name).filter(Boolean).join("، ")}</small>}{smartSearch.data.sources.length > 0 && <small>المصادر: {smartSearch.data.sources.join("، ")}</small>}{smartSearch.data.limitation && <small>{smartSearch.data.limitation}</small>}</div>}</div>
          <div className="route-panel"><div className="ai-panel-heading"><span><Route size={14} /> تخطيط مسار بالذكاء الاصطناعي</span><span className="route-note">بيانات موثقة</span></div><div className="route-controls"><label>المدة بالساعات<input value={routeHours} onChange={(event) => setRouteHours(event.target.value)} inputMode="numeric" /></label><label>الاهتمامات<input value={routeInterests} onChange={(event) => setRouteInterests(event.target.value)} placeholder="تراث، طبيعة" /></label></div><Button className="route-button" size="sm" disabled={routePlan.isPending || assistantSites.length < 2} onClick={() => routePlan.mutate({ mode: assistantMode, durationHours: Number(routeHours) || 8, interests: routeInterests.split("،").map((item) => item.trim()).filter(Boolean) })}>{routePlan.isPending ? "يبني المسار..." : "اقترح مسارًا"}</Button>{routePlan.error && <div className="route-result"><strong>تعذر بناء المسار حاليًا.</strong><small>تأكد من تفعيل طبقتين أو أكثر تحتويان على مواقع موثقة.</small></div>}{routePlan.data && <div className="route-result"><strong>{routePlan.data.title}</strong><p>{routePlan.data.rationale}</p><small>المحطات: {routePlan.data.orderedIds.map((id) => activeSites.find((site) => site.id === id)?.name).filter(Boolean).join(" ← ") || "لم يتم العثور على محطات كافية"}</small>{routePlan.data.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div>}</div>
          {!isPublicRoute && !isAuthenticated && <Button className="add-point-button" onClick={() => { window.location.href = getManagementUrl(); }}><ShieldCheck size={16} /> دخول الإدارة الداخلية</Button>}{!isPublicRoute && isAuthenticated && user?.role === "admin" && <Button className="add-point-button" variant="outline" onClick={() => { window.location.href = `${import.meta.env.BASE_URL}management`; }}><ShieldCheck size={16} /> بوابة الإدارة</Button>}
          <div className="panel-heading"><div><span className="section-eyebrow">الطبقات الوطنية</span><h3>ماذا تريد أن ترى؟</h3></div><div className="panel-heading-actions"><button type="button" className="favorites-quick-action" onClick={() => toggleLayer("favorites", true)}>★ المفضلة</button><Badge variant="secondary">{activeLayers.length} نشطة</Badge></div></div>
          <div className="layer-list">{allLayerConfigs.map((layer) => { const count = loaded[layer.id]?.length ?? (managedSites.filter((site) => site.layerId === layer.id).length || undefined); const active = activeLayers.includes(layer.id); return <div className={`layer-row ${active ? "is-active" : ""}`} key={layer.id} role="button" tabIndex={0} aria-pressed={active} onClick={() => toggleLayer(layer.id, !active)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleLayer(layer.id, !active); } }}><div className="layer-mark" style={{ background: `${layer.color}12`, color: layer.color }} aria-hidden="true"><span className="layer-mark-glyph">{layer.icon}</span></div><div className="layer-copy"><strong>{layer.name}</strong><span>{layer.short}</span><small>{count !== undefined ? `${count.toLocaleString("ar-LY")} موقعًا` : layer.id === "favorites" ? "مختارات موثقة تُحمّل عند الطلب" : "تُحمّل عند الطلب"}</small></div><Switch checked={active} onClick={(event) => event.stopPropagation()} onCheckedChange={(checked) => toggleLayer(layer.id, checked)} aria-label={`تفعيل ${layer.name}`} /></div>; })}</div>
          <div className="panel-foot"><div><Database size={15} /><span>السجلات المعروضة</span><strong>{visibleSites.length.toLocaleString("ar-LY")}</strong></div><button onClick={focusLibya}><ZoomIn size={14} /> إعادة تمركز الخريطة</button></div>
        </aside>

        <section className="map-stage"><div className={`map-loading-overlay ${isAtlasLoading ? "is-visible" : ""}`} aria-live="polite" aria-busy={isAtlasLoading}><div className="loading-orbit"><span /><span /><span /></div><strong>{!mapReady ? "جارٍ تهيئة الخريطة" : "جارٍ تحميل الطبقات"}</strong><small>{loadingLayers.length ? `يتم تجهيز ${loadingLayers.length.toLocaleString("ar-LY")} طبقة` : "لحظات ونبدأ الاستكشاف"}</small></div><div className="map-overlay-title"><span>المشهد الجغرافي الوطني</span><strong>استكشف ليبيا طبقةً بعد طبقة</strong></div><MapView className="atlas-map" initialCenter={INITIAL_CENTER} initialZoom={5} onMapReady={handleMapReady} onClusterReady={handleClusterReady} /><div className="map-legend"><span><i style={{ background: "#B96D3B" }} /> مواقع موثقة</span><span><i style={{ background: "#AF7A24" }} /> فرص وتنمية</span><span><i style={{ background: "#287A70" }} /> موارد طبيعية</span>{activeLayers.includes("density") && <span className="density-legend"><i style={{ background: "#2FBEF0" }} /> تركّز منخفض <i style={{ background: "#D94B45" }} /> تركّز مرتفع</span>}</div><div className="map-count"><MapPinned size={15} /><strong>{visibleSites.length.toLocaleString("ar-LY")}</strong><span>موقع ظاهر</span></div></section>
      </section>

      <section className="story-strip"><div className="story-image" style={{ backgroundImage: `url(${DATA.heritage})` }} /><div className="story-copy"><span className="section-eyebrow">ذاكرة المكان</span><h2>الموقع ليس نقطة على الخريطة؛ إنه <i>قصة كاملة.</i></h2><p>نحوّل السجلات والطبقات والصور إلى معرفة مكانية تساعد على الحصر والتوثيق والتخطيط السياحي.</p><button onClick={() => { setActiveLayers(["heritage"]); window.scrollTo({ top: 0, behavior: "smooth" }); }}>ابدأ من التراث العالمي <ArrowLeft size={16} /></button></div><div className="story-stat"><strong>10</strong><span>مسارات بيانات<br />قابلة للاستكشاف</span></div></section>

      {canUsePublicEditor && <Sheet open={editorOpen} onOpenChange={setEditorOpen}><SheetContent side="left" className="detail-sheet point-editor" dir="rtl"><SheetHeader><div className="detail-top"><Badge>سجل جديد</Badge><ImagePlus size={18} /></div><SheetTitle>إضافة نقطة سياحية</SheetTitle></SheetHeader><div className="point-form"><p className="form-hint">اختر الطبقة، ثم استخدم زر تحديد الموقع للانتقال إلى الخريطة، أو أدخل الإحداثيات يدويًا.</p><Button type="button" variant="outline" className="pick-location-button" onClick={() => { setEditorOpen(false); setPickMode(true); }}><MapPinPlus size={15} /> تحديد الموقع من الخريطة</Button><label>الطبقة<select value={draftPoint.layerId} onChange={(event) => updateDraft("layerId", event.target.value)}>{layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label><label>اسم الموقع<Input value={draftPoint.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="مثال: واحة غدامس" /></label><label>الوصف<textarea value={draftPoint.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder="وصف موجز للموقع وقيمته السياحية..." /></label><div className="form-grid"><label>البلدية<Input value={draftPoint.municipality} onChange={(event) => updateDraft("municipality", event.target.value)} /></label><label>التصنيف<Input value={draftPoint.category} onChange={(event) => updateDraft("category", event.target.value)} /></label></div><div className="form-grid"><label>خط العرض<Input value={draftPoint.latitude} onChange={(event) => updateDraft("latitude", event.target.value)} inputMode="decimal" /></label><label>خط الطول<Input value={draftPoint.longitude} onChange={(event) => updateDraft("longitude", event.target.value)} inputMode="decimal" /></label></div><label>مصدر البيانات<Input value={draftPoint.source} onChange={(event) => updateDraft("source", event.target.value)} placeholder="جهة الحصر أو المرجع" /></label><label>البيانات الوصفية<textarea value={draftPoint.metadata} onChange={(event) => updateDraft("metadata", event.target.value)} placeholder={'سنة التوثيق: 2026\nحالة الوصول: متاح'} /></label><label className="file-picker"><span><ImagePlus size={16} /> صورة الموقع</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => updateDraft("imageDataUrl", String(reader.result)); reader.readAsDataURL(file); updateDraft("imageFileName", file.name); updateDraft("imageContentType", file.type); }} /></label><Button className="detail-action" disabled={createPoint.isPending || !draftPoint.name || !draftPoint.latitude || !draftPoint.longitude} onClick={submitPoint}>{createPoint.isPending ? "جارٍ الحفظ..." : "حفظ النقطة للمراجعة"}</Button></div></SheetContent></Sheet>}
      <Sheet open={suggestionOpen} onOpenChange={setSuggestionOpen}><SheetContent side="left" className="detail-sheet point-editor" dir="rtl"><SheetHeader><div className="detail-top"><Badge>مراجعة قبل النشر</Badge><MessageSquarePlus size={18} /></div><SheetTitle>اقتراح تحديث للموقع</SheetTitle></SheetHeader><div className="point-form"><p className="form-hint">اقتراحك لا يظهر للعامة مباشرة؛ يراجعه فريق الأطلس ويتحقق من المصدر وحقوق الصورة أولًا.</p><label>نوع الاقتراح<select value={suggestionType} onChange={(event) => setSuggestionType(event.target.value as "edit" | "image")}><option value="edit">تعديل وصف أو تصنيف</option><option value="image">رفع صورة إضافية</option></select></label><label>التصنيف المقترح<Input value={suggestionCategory} onChange={(event) => setSuggestionCategory(event.target.value)} placeholder="مثال: مسرح روماني" /></label><label>الوصف أو ملاحظة التصحيح<textarea value={suggestionText} onChange={(event) => setSuggestionText(event.target.value)} placeholder="اكتب التصحيح المقترح أو وصف الصورة..." /></label>{suggestionType === "image" && <><label className="file-picker"><span><ImagePlus size={16} /> اختيار صورة</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setSuggestionImageDataUrl(String(reader.result)); reader.readAsDataURL(file); setSuggestionImageName(file.name); setSuggestionImageType(file.type); }} /></label><label>رابط المصدر إن وجد<Input type="url" value={suggestionSourceUrl} onChange={(event) => setSuggestionSourceUrl(event.target.value)} placeholder="https://..." /></label><label>نوع المصدر<select value={suggestionSourceKind} onChange={(event) => setSuggestionSourceKind(event.target.value)}><option value="agency">جهة مالكة</option><option value="photographer">مصور</option><option value="web_page">صفحة ويب</option><option value="facebook">Facebook</option><option value="wikimedia">Wikimedia</option><option value="kml">KML</option><option value="custom">مصدر مخصص</option></select></label><label>ملاحظة الملكية والترخيص<textarea value={suggestionRightsNote} onChange={(event) => setSuggestionRightsNote(event.target.value)} placeholder="اذكر الجهة المالكة أو المصور أو شروط الاستخدام" /></label></>}<Button className="detail-action" disabled={submitSuggestion.isPending || (suggestionType === "image" && !suggestionImageDataUrl && !suggestionSourceUrl)} onClick={submitVisitorSuggestion}>{submitSuggestion.isPending ? "جارٍ الإرسال..." : "إرسال للمراجعة"}</Button></div></SheetContent></Sheet>
      <Sheet open={mobileOpen || Boolean(selected)} onOpenChange={(open) => { if (!open) { setMobileOpen(false); setSelected(null); } }}><SheetContent side={selected ? "left" : "right"} className={`detail-sheet ${!selected ? "mobile-layers-sheet" : ""}`} dir="rtl">{selected ? <><SheetHeader><div className="detail-top"><Badge style={{ background: allLayerConfigs.find((l) => l.id === selected.layerId)?.color }}>{allLayerConfigs.find((l) => l.id === selected.layerId)?.name}</Badge><ShieldCheck size={18} /></div><SheetTitle>{selected.name}</SheetTitle></SheetHeader><div className="detail-body">{imageDisplayUrl && !imageFailed ? <img className="detail-image" src={imageDisplayUrl} alt={`صورة ${selected.name}`} referrerPolicy="no-referrer" onError={() => { const sourceUrl = selected.properties.image_source || selected.imageUrl || undefined; const proxyUrl = toDisplayImageUrl(sourceUrl); const fallbackUrl = toFallbackImageUrl(sourceUrl); if (proxyUrl && imageDisplayUrl !== proxyUrl) setImageDisplayUrl(proxyUrl); else if (fallbackUrl && imageDisplayUrl !== fallbackUrl) setImageDisplayUrl(fallbackUrl); else setImageFailed(true); }} /> : <div className="detail-image-placeholder"><ImageOff size={22} /><span>لا توجد صورة قابلة للعرض لهذا السجل</span>{selected.properties.image_source && /^https?:\/\//i.test(selected.properties.image_source) && <a href={selected.properties.image_source} target="_blank" rel="noreferrer">فتح الصورة الأصلية</a>}</div>}{imageSourcesForSite(selected).length > 1 && <div className="detail-gallery" aria-label="صور الموقع"><strong>صور الموقع ({imageSourcesForSite(selected).length.toLocaleString("ar-LY")})</strong><div className="detail-gallery-grid">{imageSourcesForSite(selected).map((source, index) => <a key={`${source}-${index}`} href={source} target="_blank" rel="noreferrer"><img src={imageCandidates(source)[0]} alt={`${selected.name} — صورة ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { const image = event.currentTarget; const candidates = imageCandidates(source); const attempt = Number(image.dataset.attempt || "0") + 1; image.dataset.attempt = String(attempt); if (attempt < candidates.length) image.src = candidates[attempt]; else image.style.display = "none"; }} /></a>)}</div></div>}<p>{selected.description || "لا يوجد وصف منشور لهذا الموقع بعد."}</p><div className="detail-grid"><div><span>الإحداثيات</span><strong>{selected.lat.toFixed(4)}°N · {selected.lng.toFixed(4)}°E</strong></div><div><span>حالة السجل</span><strong>{selected.properties.record_status || "مراجعة مطلوبة"}{selected.properties.draft === "true" ? " · مسودة" : ""}</strong></div>{selected.properties.source_layer && <div><span>مصدر الطبقة</span><strong>{selected.properties.source_layer} · {selected.properties.source_format || "بيانات أطلس"}</strong></div>}</div>{selected.properties.image_source && <small className="image-source-note">مصدر الصورة: <a href={selected.properties.image_source} target="_blank" rel="noreferrer" title={selected.properties.image_source}>فتح المصدر</a>{selected.properties.image_author && <> · المؤلف: {selected.properties.image_author}</>}{selected.properties.image_license && <> · الترخيص: {selected.properties.image_license}</>}{selected.properties.image_license_note && <> · {selected.properties.image_license_note}</>}</small>}<Button className="detail-action" onClick={() => focusSite(selected, 13)}><MapPinned size={16} /> ركّز على الموقع</Button><Button className="detail-action suggestion-open-button" variant="outline" onClick={() => setSuggestionOpen(true)}><MessageSquarePlus size={16} /> اقتراح تعديل أو صورة</Button></div></> : <><SheetHeader><div className="mobile-layer-heading"><SheetTitle>طبقات الأطلس</SheetTitle><button type="button" className="favorites-quick-action" onClick={() => { toggleLayer("favorites", true); setMobileOpen(false); }}>★ المفضلة</button></div></SheetHeader><div className="mobile-filter-panel"><div className="filter-heading"><span><SlidersHorizontal size={14} /> تصفية السجلات</span><button onClick={() => { setSelectedCategory("all"); setSelectedMunicipality("all"); setSelectedLayer("all"); setSelectedStatus("all"); setSelectedHeritageCategory("all"); }} type="button">إعادة ضبط</button></div><div className="filter-grid"><label>الطبقة<select value={selectedLayer} onChange={(event) => setSelectedLayer(event.target.value)}><option value="all">كل الطبقات</option>{layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}{customDocumentationLayers.map((layer) => <option key={layer.id} value={layer.id}>{layer.icon} {layer.label}</option>)}</select></label><label>التصنيف<select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="all">كل الأنواع</option>{filterOptions.categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label>البلدية<select value={selectedMunicipality} onChange={(event) => setSelectedMunicipality(event.target.value)}><option value="all">كل البلديات</option>{filterOptions.municipalities.map((municipality) => <option key={municipality} value={municipality}>{municipality}</option>)}</select></label><label>الحالة<select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}><option value="all">كل الحالات</option>{filterOptions.statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label></div></div><div className="mobile-layers">{allLayerConfigs.map((layer) => { const active = activeLayers.includes(layer.id); return <label key={layer.id} className={active ? "is-active" : ""} onClick={() => toggleLayer(layer.id, !active)}><span><i style={{ color: layer.color }}>{layer.icon}</i>{layer.name}</span><Switch checked={active} onClick={(event) => event.stopPropagation()} onCheckedChange={(checked) => toggleLayer(layer.id, checked)} aria-label={`تفعيل ${layer.name}`} /></label>; })}</div></>}</SheetContent></Sheet>
    </main>
  );
}
