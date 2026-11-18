import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MapLibre, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Vite pre-bundles maplibre-gl, so the library's default worker path (next to its own file) 404s
// and tiles never render. Point it at the worker file, which is self-contained.
setWorkerUrl(workerUrl);

/** OpenFreeMap's light base map (free, no key). Swap the URL to change tile provider. */
const STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';

export type LatLng = { lat: number; lng: number };
export type VenueMapHandle = { flyTo: (p: LatLng, zoom?: number) => void };

/**
 * Map with one draggable pin. Tap the map or drag the pin to move it; `onChange` gets the new
 * position. The base map is recoloured to the verzus palette.
 */
export const VenueMap = forwardRef<
  VenueMapHandle,
  { pin: LatLng | null; center: LatLng; onChange?: (p: LatLng) => void; readOnly?: boolean; className?: string }
>(function VenueMap(
  { pin, center, onChange, readOnly = false, className = 'h-80 rounded-card border-[3px] border-ink-900' },
  ref,
) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const marker = useRef<Marker | null>(null);
  const changed = useRef(onChange);
  changed.current = onChange;

  useImperativeHandle(ref, () => ({
    flyTo: (p, zoom = 15) => map.current?.flyTo({ center: [p.lng, p.lat], zoom, speed: 1.6 }),
  }));

  // Create the map once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial centre only; later moves go through flyTo.
  useEffect(() => {
    if (!box.current) return;
    const start = pin ?? center;
    const m = new MapLibre({
      container: box.current,
      style: STYLE_URL,
      center: [start.lng, start.lat],
      zoom: pin ? 16 : 13,
      attributionControl: { compact: true },
    });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    m.on('load', () => verzusify(m));
    // MapLibre only tracks window resizes; the box can also change size with the layout
    // (sidebar, phone rotation), which would leave part of the canvas blank.
    const resize = new ResizeObserver(() => m.resize());
    resize.observe(box.current);
    if (!readOnly) m.on('click', (e) => place({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    map.current = m;
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  // Keep the pin in sync with the saved position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: showPin only touches refs; re-run when the pin moves.
  useEffect(() => {
    if (pin && map.current) showPin(pin);
  }, [pin]);

  function showPin(p: LatLng) {
    if (!map.current) return;
    if (!marker.current) {
      marker.current = new Marker({ element: pinElement(), anchor: 'bottom', draggable: !readOnly })
        .setLngLat([p.lng, p.lat])
        .addTo(map.current);
      marker.current.on('dragstart', () => marker.current?.getElement().classList.add('vz-pin--lifted'));
      marker.current.on('dragend', () => {
        marker.current?.getElement().classList.remove('vz-pin--lifted');
        drop(marker.current?.getElement());
        const ll = marker.current?.getLngLat();
        if (ll) changed.current?.({ lat: ll.lat, lng: ll.lng });
      });
    } else {
      marker.current.setLngLat([p.lng, p.lat]);
    }
    drop(marker.current.getElement());
  }

  function place(p: LatLng) {
    showPin(p);
    changed.current?.(p);
  }

  return <div ref={box} className={`w-full overflow-hidden ${className}`} />;
});

/** The verzus pin: a red pin head with a white dot, plus a ripple on the ground (styles in index.css). */
function pinElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'vz-pin';
  el.innerHTML = '<span class="vz-pin__ripple"></span><span class="vz-pin__body"><span class="vz-pin__head"></span></span>';
  return el;
}

/** Replays the drop-in animation (restarting a CSS animation needs a reflow between class changes). */
function drop(el: HTMLElement | undefined) {
  if (!el) return;
  el.classList.remove('vz-pin--drop');
  void el.offsetWidth;
  el.classList.add('vz-pin--drop');
}

/** Recolours OpenFreeMap Positron layers to the verzus palette. Unknown layers are skipped. */
function verzusify(m: MapLibre) {
  type PaintProp = Parameters<MapLibre['setPaintProperty']>[1];
  const paint: [string, PaintProp, string][] = [
    ['background', 'background-color', '#f6f5fb'],
    ['park', 'fill-color', '#e4e2fb'],
    ['landcover_wood', 'fill-color', '#e4e2fb'],
    ['landuse_residential', 'fill-color', '#efeef8'],
    ['water', 'fill-color', '#cfcbf6'],
    ['waterway', 'line-color', '#cfcbf6'],
    ['building', 'fill-color', '#e8e6f5'],
    ['building', 'fill-outline-color', '#d9d6ee'],
    ['highway_minor', 'line-color', '#e2e0f2'],
    ['highway_major_casing', 'line-color', '#d3d0ea'],
    ['highway_motorway_casing', 'line-color', '#d3d0ea'],
    ['highway_motorway_bridge_casing', 'line-color', '#d3d0ea'],
    ['tunnel_motorway_casing', 'line-color', '#d3d0ea'],
    ['label_city', 'text-color', '#1d1a4a'],
    ['label_town', 'text-color', '#1d1a4a'],
    ['label_village', 'text-color', '#1d1a4a'],
    ['label_other', 'text-color', '#433f73'],
    ['highway-name-major', 'text-color', '#6f6a9c'],
    ['highway-name-minor', 'text-color', '#6f6a9c'],
    ['water_name_point_label', 'text-color', '#5a4fd8'],
    ['water_name_line_label', 'text-color', '#5a4fd8'],
  ];
  for (const [layer, prop, value] of paint) {
    if (m.getLayer(layer)) m.setPaintProperty(layer, prop, value);
  }
}
