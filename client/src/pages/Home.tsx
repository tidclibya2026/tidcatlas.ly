/**
 * Design reminder: National Memory Map — editorial institutional cartography.
 * Keep the map dominant, use atlas blue #123C52, sand surfaces, copper heritage accents,
 * Noto Kufi Arabic for headings, and IBM Plex Sans Arabic for data/UI.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { MapView } from "@/components/Map";
import L from "leaflet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronDown, Database, ExternalLink, Eye, EyeOff, Flag, ImagePlus, Layers3,
  MapPinned, MapPinPlus, Menu, Search, ShieldCheck, Sparkles, X, ZoomIn
} from "lucide-react";

type Site = { id: string; name: string; description: string; lat: number; lng: number; properties: Record<string, string>; layerId: string; imageUrl?: string | null };
type LayerConfig = { id: string; name: string; short: string; color: string; icon: string; url: string; kind: "kml" | "geojson"; description: string; featured?: boolean };

const DATA = {
  projectLogo: "/manus-storage/atlas-tourism-project_c75dcab1.png",
  ministryLogo: "/manus-storage/ministry-tourism_feb6f439.png",
  centerLogo: "/manus-storage/tourism-documentation-center_0d098924.png",
  hero: "/manus-storage/libya-atlas-hero_ebb8b2b9.jpg",
  desert: "/manus-storage/libya-atlas-desert_8d3e876d.jpg",
  heritage: "/manus-storage/libya-atlas-heritage_baefbb7e.jpg",
  cover: "/manus-storage/libya-atlas-cover-gis-landscape_22a918d0.png",
};

const INITIAL_CENTER: [number, number] = [27.2, 17.2];

const layers: LayerConfig[] = [
  { id: "heritage", name: "التراث العالمي", short: "مواقع أثرية وتاريخية", color: "#B96D3B", icon: "◈", url: "/manus-storage/world-heritage_ae1639b4.kml", kind: "kml", description: "مواقع التراث العالمي والمكونات التابعة لها", featured: true },
  { id: "natural", name: "الموارد الطبيعية", short: "مشاهد وجغرافيا طبيعية", color: "#287A70", icon: "⌁", url: "/manus-storage/natural-atlas-with-media_5ccb1fb0.geojson", kind: "geojson", description: "سجل أطلس الموارد الطبيعية الليبية" },
  { id: "akakus", name: "تادرارت أكاكوس", short: "الفن الصخري والصحراء", color: "#A76027", icon: "◇", url: "/manus-storage/akakus_60c47b41.kml", kind: "kml", description: "الفن الصخري والمشهد الصحراوي" },
  { id: "old-tripoli", name: "المدينة القديمة طرابلس", short: "معالم تاريخية", color: "#3E7183", icon: "⌂", url: "/manus-storage/old-tripoli_5c62867b.kml", kind: "kml", description: "مبانٍ ومعالم المدينة القديمة" },
  { id: "hotels", name: "الفنادق والإيواء", short: "خدمات الضيافة", color: "#B34B42", icon: "▣", url: "/manus-storage/hotels_b9547235.kml", kind: "kml", description: "الفنادق ومنشآت الإيواء" },
  { id: "resorts", name: "القرى والمنتجعات", short: "سياحة ساحلية", color: "#3D8C8A", icon: "≈", url: "/manus-storage/resorts_e4a8f065.kml", kind: "kml", description: "القرى والمنتجعات والشاليهات" },
  { id: "investment", name: "فرص الاستثمار", short: "مشاريع وتنمية", color: "#AF7A24", icon: "↗", url: "/manus-storage/investment_de22d4a0.kml", kind: "kml", description: "المشاريع والفرص الاستثمارية السياحية" },
  { id: "food", name: "المطاعم والمقاهي", short: "خدمات الطعام", color: "#855D42", icon: "•", url: "/manus-storage/restaurants_0642e048.kml", kind: "kml", description: "مطاعم ومقاهٍ في طرابلس" },
];

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
    return { id: `${layerId}-${index}`, name, description, lat, lng, properties, layerId };
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
    return [{ id: `${config.id}-${index}`, name: propertyName(feature.properties || {}), description: String(feature.properties?.description_ar || feature.properties?.description || ""), lat: point[1], lng: point[0], properties: feature.properties || {}, layerId: config.id }];
  });
}

export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  const [activeLayers, setActiveLayers] = useState<string[]>(["heritage"]);
  const [loaded, setLoaded] = useState<Record<string, Site[]>>({});
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Site | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [map, setMap] = useState<L.Map | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [draftPoint, setDraftPoint] = useState({ layerId: "heritage", name: "", description: "", municipality: "", category: "", source: "", latitude: "", longitude: "", metadata: "", imageDataUrl: "", imageFileName: "", imageContentType: "" });
  const markers = useRef<Record<string, L.CircleMarker[]>>({});
  const publishedPoints = trpc.atlas.published.useQuery({});
  const adminPoints = trpc.atlas.mine.useQuery(undefined, { enabled: Boolean(isAuthenticated && user?.role === "admin") });
  const trpcUtils = trpc.useUtils();
  const handleMapReady = useCallback((instance: L.Map) => setMap(instance), []);
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
  const visibleSites = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return activeSites;
    return activeSites.filter((site) => `${site.name} ${site.description}`.toLocaleLowerCase().includes(normalized));
  }, [activeSites, query]);

  const clearMarkers = useCallback((id: string) => {
    markers.current[id]?.forEach((marker) => marker.remove());
    markers.current[id] = [];
  }, []);

  const renderMarkers = useCallback((config: LayerConfig, sites: Site[]) => {
    if (!map) return;
    clearMarkers(config.id);
    markers.current[config.id] = sites.map((site) => {
      const marker = L.circleMarker([site.lat, site.lng], { radius: 7, color: "#fff", weight: 2, fillColor: config.color, fillOpacity: 1 });
      marker.addTo(map);
      marker.bindTooltip(site.name, { direction: "top", offset: [0, -7], opacity: 0.95 });
      marker.on("click", () => { setSelected(site); setMobileOpen(false); });
      return marker;
    });
  }, [clearMarkers, map]);

  useEffect(() => {
    if (!map) return;
    activeLayers.forEach(async (id) => {
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
  }, [activeLayers, map, loaded, renderMarkers, clearMarkers]);

  useEffect(() => {
    if (!map || !pickMode) return;
    const chooseLocation = (event: L.LeafletMouseEvent) => { setDraftPoint((current) => ({ ...current, latitude: event.latlng.lat.toFixed(6), longitude: event.latlng.lng.toFixed(6) })); setPickMode(false); setEditorOpen(true); toast.success("تم تحديد الإحداثيات من الخريطة"); };
    map.on("click", chooseLocation);
    return () => { map.off("click", chooseLocation); };
  }, [pickMode, map]);

  useEffect(() => {
    if (!map || !pointFeed?.length) return;
    renderMarkers({ id: "managed", name: "النقاط المضافة", short: "سجلات الأطلس", color: "#7B4F35", icon: "✦", url: "", kind: "geojson", description: "النقاط المضافة من فريق التوثيق" }, managedSites);
  }, [map, pointFeed, managedSites, renderMarkers]);

  useEffect(() => {
    if (!map || !query) return;
    const first = visibleSites[0];
    if (first) map.panTo([first.lat, first.lng]);
  }, [query, map, visibleSites]);

  const toggleLayer = (id: string, checked: boolean) => setActiveLayers((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));
  const focusLibya = () => map?.panTo(INITIAL_CENTER);
  const updateDraft = (field: keyof typeof draftPoint, value: string) => setDraftPoint((current) => ({ ...current, [field]: value }));
  const submitPoint = () => {
    const metadata: Record<string, string> = {};
    draftPoint.metadata.split("\n").map((line) => line.split(":")).filter(([key, value]) => key?.trim() && value?.trim()).forEach(([key, value]) => { metadata[key.trim()] = value.trim(); });
    createPoint.mutate({ ...draftPoint, latitude: Number(draftPoint.latitude), longitude: Number(draftPoint.longitude), metadata, imageDataUrl: draftPoint.imageDataUrl || undefined, imageFileName: draftPoint.imageFileName || undefined, imageContentType: draftPoint.imageContentType || undefined });
  };

  return (
    <main dir="rtl" className="atlas-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="project-mark"><img className="project-logo" src={DATA.projectLogo} alt="شعار مشروع أطلس ليبيا السياحي" /></div><div className="brand-title"><span className="eyebrow">مركز المعلومات والتوثيق السياحي</span><h1>أطلس ليبيا <em>السياحي</em></h1></div><div className="official-logos" aria-label="الجهات الرسمية المشرفة على المشروع"><div className="official-logo-cell"><img src={DATA.ministryLogo} alt="شعار وزارة السياحة والصناعات التقليدية" /><span>وزارة السياحة والصناعات التقليدية</span></div><span className="logo-divider" /><div className="official-logo-cell"><img src={DATA.centerLogo} alt="شعار مركز المعلومات والتوثيق السياحي" /><span>مركز المعلومات والتوثيق</span></div></div></div>
        <div className="topbar-actions"><span className="edition"><span className="status-dot" /> نسخة العرض المؤسسية · 2026</span><Button variant="ghost" size="icon" className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="فتح قائمة الطبقات"><Menu /></Button></div>
      </header>

      <section className="atlas-cover" aria-label="الغلاف الافتتاحي لأطلس ليبيا السياحي">
        <div className="atlas-cover-frame">
          <img src={DATA.cover} alt="غلاف مشروع أطلس ليبيا السياحي بهوية نظم المعلومات الجغرافية" />
        </div>
      </section>

      <section className="atlas-main">
        <aside className="control-panel">
          <div className="panel-intro"><div className="intro-kicker"><Sparkles size={14} /> من المعلومة إلى القرار</div><h2>ليبيا، كما تُروى عبر المكان.</h2><p>منصة جغرافية لتوثيق المقومات السياحية والتاريخية والطبيعية والخدمية، وربطها بمشهد واحد قابل للاستكشاف.</p></div>
          <div className="search-box"><Search size={18} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم موقع أو مدينة…" aria-label="البحث داخل المواقع" />{query && <button onClick={() => setQuery("")} aria-label="مسح البحث"><X size={15} /></button>}</div>
          {!isAuthenticated && <Button className="add-point-button" onClick={startLogin}><MapPinPlus size={16} /> دخول فريق التوثيق</Button>}{isAuthenticated && user?.role === "admin" && <Button className="add-point-button" onClick={() => setEditorOpen(true)}><MapPinPlus size={16} /> إضافة نقطة إلى الأطلس</Button>}
          <div className="panel-heading"><div><span className="section-eyebrow">الطبقات الوطنية</span><h3>ماذا تريد أن ترى؟</h3></div><Badge variant="secondary">{activeLayers.length} نشطة</Badge></div>
          <div className="layer-list">{layers.map((layer) => { const count = loaded[layer.id]?.length; const active = activeLayers.includes(layer.id); return <div className={`layer-row ${active ? "is-active" : ""}`} key={layer.id}><div className="layer-mark" style={{ background: `${layer.color}16`, color: layer.color }}>{layer.icon}</div><div className="layer-copy"><strong>{layer.name}</strong><span>{layer.short}</span><small>{count !== undefined ? `${count.toLocaleString("ar-LY")} موقعًا` : "تُحمّل عند الطلب"}</small></div><Switch checked={active} onCheckedChange={(checked) => toggleLayer(layer.id, checked)} aria-label={`تفعيل ${layer.name}`} /></div>; })}</div>
          <div className="panel-foot"><div><Database size={15} /><span>السجلات المعروضة</span><strong>{activeSites.length.toLocaleString("ar-LY")}</strong></div><button onClick={focusLibya}><ZoomIn size={14} /> إعادة تمركز الخريطة</button></div>
        </aside>

        <section className="map-stage"><div className="map-overlay-title"><span>المشهد الجغرافي الوطني</span><strong>استكشف ليبيا طبقةً بعد طبقة</strong></div><MapView className="atlas-map" initialCenter={INITIAL_CENTER} initialZoom={5} onMapReady={handleMapReady} /><div className="map-legend"><span><i style={{ background: "#B96D3B" }} /> مواقع موثقة</span><span><i style={{ background: "#AF7A24" }} /> فرص وتنمية</span><span><i style={{ background: "#287A70" }} /> موارد طبيعية</span></div><div className="map-count"><MapPinned size={15} /><strong>{visibleSites.length.toLocaleString("ar-LY")}</strong><span>موقع ظاهر</span></div></section>
      </section>

      <section className="story-strip"><div className="story-image" style={{ backgroundImage: `url(${DATA.heritage})` }} /><div className="story-copy"><span className="section-eyebrow">ذاكرة المكان</span><h2>الموقع ليس نقطة على الخريطة؛ إنه <i>قصة كاملة.</i></h2><p>نحوّل السجلات والطبقات والصور إلى معرفة مكانية تساعد على الحصر والتوثيق والتخطيط السياحي.</p><button onClick={() => { setActiveLayers(["heritage"]); window.scrollTo({ top: 0, behavior: "smooth" }); }}>ابدأ من التراث العالمي <ArrowLeft size={16} /></button></div><div className="story-stat"><strong>10</strong><span>مسارات بيانات<br />قابلة للاستكشاف</span></div></section>

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}><SheetContent side="left" className="detail-sheet point-editor" dir="rtl"><SheetHeader><div className="detail-top"><Badge>سجل جديد</Badge><ImagePlus size={18} /></div><SheetTitle>إضافة نقطة سياحية</SheetTitle></SheetHeader><div className="point-form"><p className="form-hint">اختر الطبقة، ثم استخدم زر تحديد الموقع للانتقال إلى الخريطة، أو أدخل الإحداثيات يدويًا.</p><Button type="button" variant="outline" className="pick-location-button" onClick={() => { setEditorOpen(false); setPickMode(true); }}><MapPinPlus size={15} /> تحديد الموقع من الخريطة</Button><label>الطبقة<select value={draftPoint.layerId} onChange={(event) => updateDraft("layerId", event.target.value)}>{layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></label><label>اسم الموقع<Input value={draftPoint.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="مثال: واحة غدامس" /></label><label>الوصف<textarea value={draftPoint.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder="وصف موجز للموقع وقيمته السياحية..." /></label><div className="form-grid"><label>البلدية<Input value={draftPoint.municipality} onChange={(event) => updateDraft("municipality", event.target.value)} /></label><label>التصنيف<Input value={draftPoint.category} onChange={(event) => updateDraft("category", event.target.value)} /></label></div><div className="form-grid"><label>خط العرض<Input value={draftPoint.latitude} onChange={(event) => updateDraft("latitude", event.target.value)} inputMode="decimal" /></label><label>خط الطول<Input value={draftPoint.longitude} onChange={(event) => updateDraft("longitude", event.target.value)} inputMode="decimal" /></label></div><label>مصدر البيانات<Input value={draftPoint.source} onChange={(event) => updateDraft("source", event.target.value)} placeholder="جهة الحصر أو المرجع" /></label><label>البيانات الوصفية<textarea value={draftPoint.metadata} onChange={(event) => updateDraft("metadata", event.target.value)} placeholder={'سنة التوثيق: 2026\nحالة الوصول: متاح'} /></label><label className="file-picker"><span><ImagePlus size={16} /> صورة الموقع</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => updateDraft("imageDataUrl", String(reader.result)); reader.readAsDataURL(file); updateDraft("imageFileName", file.name); updateDraft("imageContentType", file.type); }} /></label><Button className="detail-action" disabled={createPoint.isPending || !draftPoint.name || !draftPoint.latitude || !draftPoint.longitude} onClick={submitPoint}>{createPoint.isPending ? "جارٍ الحفظ..." : "حفظ النقطة للمراجعة"}</Button></div></SheetContent></Sheet>
      <Sheet open={mobileOpen || Boolean(selected)} onOpenChange={(open) => { if (!open) { setMobileOpen(false); setSelected(null); } }}><SheetContent side={selected ? "left" : "bottom"} className="detail-sheet" dir="rtl">{selected ? <><SheetHeader><div className="detail-top"><Badge style={{ background: layers.find((l) => l.id === selected.layerId)?.color }}>{layers.find((l) => l.id === selected.layerId)?.name}</Badge><ShieldCheck size={18} /></div><SheetTitle>{selected.name}</SheetTitle></SheetHeader><div className="detail-body">{selected.imageUrl && <img className="detail-image" src={selected.imageUrl} alt={`صورة ${selected.name}`} />}<p>{selected.description || "لا يوجد وصف منشور لهذا الموقع بعد."}</p><div className="detail-grid"><div><span>الإحداثيات</span><strong>{selected.lat.toFixed(4)}°N · {selected.lng.toFixed(4)}°E</strong></div><div><span>حالة السجل</span><strong>موقع موثق</strong></div></div><Button className="detail-action" onClick={() => { map?.panTo([selected.lat, selected.lng]); map?.setZoom(13); }}><MapPinned size={16} /> ركّز على الموقع</Button></div></> : <><SheetHeader><SheetTitle>طبقات الأطلس</SheetTitle></SheetHeader><div className="mobile-layers">{layers.map((layer) => <label key={layer.id}><span><i style={{ color: layer.color }}>{layer.icon}</i>{layer.name}</span><Switch checked={activeLayers.includes(layer.id)} onCheckedChange={(checked) => toggleLayer(layer.id, checked)} /></label>)}</div></>}</SheetContent></Sheet>
    </main>
  );
}
