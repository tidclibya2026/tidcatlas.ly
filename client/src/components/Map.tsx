/* Design reminder: National Memory Map — the map must feel like a living atlas, with quiet basemap, readable layers, and no visual competition with the data. */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

interface MapViewProps { className?: string; initialCenter?: [number, number]; initialZoom?: number; onMapReady?: (map: L.Map) => void; }

export function MapView({ className, initialCenter = [27.2, 17.2], initialZoom = 5, onMapReady }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const libyaBounds = L.latLngBounds([18.8, 8.2], [34.2, 25.6]);
    const map = L.map(container.current, { zoomControl: false, minZoom: 5, maxZoom: 18, maxBounds: libyaBounds, maxBoundsViscosity: 0.92, worldCopyJump: false, attributionControl: true }).setView(initialCenter, initialZoom);
    const zoomControl = L.control.zoom({ position: "topright" }).addTo(map);
    zoomControl.getContainer()?.setAttribute("aria-label", "أدوات تكبير وتصغير الخريطة");
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, attribution: "© OpenStreetMap © CARTO" }).addTo(map);
    mapRef.current = map;
    onMapReady?.(map);
    const resize = () => map.invalidateSize();
    window.addEventListener("resize", resize);
    const timer = window.setTimeout(resize, 180);
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", resize); map.remove(); mapRef.current = null; };
  }, [initialCenter, initialZoom, onMapReady]);
  return <div ref={container} className={cn("w-full h-[500px]", className)} aria-label="الخريطة التفاعلية لأطلس ليبيا السياحي" />;
}
