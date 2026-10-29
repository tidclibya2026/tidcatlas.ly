
import { useEffect, useRef } from "react";
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { cn } from "@/lib/utils";

interface MapViewProps {
  className?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  onMapReady?: (map: L.Map) => void;
  onClusterReady?: (cluster: L.MarkerClusterGroup) => void;
}

export function MapView({
  className,
  initialCenter = [27.2, 17.2],
  initialZoom = 5,
  onMapReady,
  onClusterReady,
}: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const onMapReadyRef = useRef(onMapReady);
  const onClusterReadyRef = useRef(onClusterReady);

  onMapReadyRef.current = onMapReady;
  onClusterReadyRef.current = onClusterReady;

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    // Geographic extent of Libya
    const libyaBounds = L.latLngBounds(
      [18.8, 8.2],
      [34.2, 25.6]
    );

    // Initialize Leaflet map
    const map = L.map(container.current, {
      zoomControl: false,
      minZoom: 5,
      maxZoom: 18,
      maxBounds: libyaBounds,
      maxBoundsViscosity: 0.92,
      worldCopyJump: false,
      attributionControl: true,
      preferCanvas: true,
    }).setView(initialCenter, initialZoom);

    mapRef.current = map;

    // Zoom controls
    const zoomControl = L.control.zoom({
      position: "topright",
    }).addTo(map);

    zoomControl
      .getContainer()
      ?.setAttribute(
        "aria-label",
        "أدوات تكبير وتصغير الخريطة"
      );

    // OpenStreetMap base layer - no API key required
    const primaryTiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        minZoom: 0,
        maxZoom: 19,
        maxNativeZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        crossOrigin: true,
      }
    ).addTo(map);

    // Report tile errors without hiding the GIS layers
    const handleTileError = (error: L.TileErrorEvent) => {
      console.warn(
        "OpenStreetMap tile loading failed:",
        error
      );
    };

    primaryTiles.on("tileerror", handleTileError);

    // Marker clustering
    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 13,

      maxClusterRadius: (zoom) => {
        if (zoom <= 7) return 68;
        if (zoom <= 10) return 52;
        return 38;
      },

      zoomToBoundsOnClick: true,

      iconCreateFunction: (group) => {
        const count = group.getChildCount();

        const size =
          count >= 100
            ? "large"
            : count >= 25
              ? "medium"
              : "small";

        return L.divIcon({
          className: `atlas-cluster atlas-cluster-${size}`,
          html: `<span>${count.toLocaleString(
            "ar-LY"
          )}</span>`,
          iconSize: [46, 46],
          iconAnchor: [23, 23],
        });
      },
    });

    cluster.addTo(map);

    // Notify parent components
    onClusterReadyRef.current?.(cluster);
    onMapReadyRef.current?.(map);

    // Fix map rendering after layout changes
    const resize = () => {
      map.invalidateSize();
    };

    window.addEventListener("resize", resize);

    const resizeTimer = window.setTimeout(
      resize,
      180
    );

    // Cleanup
    return () => {
      window.clearTimeout(resizeTimer);

      window.removeEventListener(
        "resize",
        resize
      );

      primaryTiles.off(
        "tileerror",
        handleTileError
      );

      primaryTiles.removeFrom(map);

      cluster.clearLayers();
      cluster.removeFrom(map);

      map.remove();
      mapRef.current = null;
    };
  }, [initialCenter, initialZoom]);

  return (
    <div
      ref={container}
      className={cn(
        "w-full h-[500px]",
        className
      )}
      aria-label="الخريطة التفاعلية لأطلس ليبيا السياحي"
      role="application"
    />
  );
}
