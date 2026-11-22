import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MapLibre, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useShownTheme } from '../lib/theme';

// Vite pre-bundles maplibre-gl, so the library's default worker path (next to its own file) 404s
// and tiles never render. Point it at the worker file, which is self-contained.
setWorkerUrl(workerUrl);

/** OpenFreeMap's light base map (free, no key). Swap the URL to change tile provider. */
const STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';

/**
 * Optional satellite photos, so owners can see their actual building when placing the pin. An XYZ
 * raster tile URL with {z}/{x}/{y} (see apps/venue/.env.example). Unset = no satellite switch.
 */
const SATELLITE_TILES = import.meta.env.VITE_SATELLITE_TILES as string | undefined;
const SATELLITE_ATTRIBUTION = (import.meta.env.VITE_SATELLITE_ATTRIBUTION as string | undefined) ?? '';

/** Tapping the map while zoomed out further than this also zooms in, so the pin can be placed precisely. */
const PLACE_ZOOM = 18;

export type LatLng = { lat: number; lng: number };
export type VenueMapHandle = {
  flyTo: (p: LatLng, zoom?: number) => void;
  /** Zooms to show a whole area, e.g. a city picked from a list. */
  fitBounds: (b: { south: number; north: number; west: number; east: number }) => void;
};

/**
 * Map with one draggable pin. Tap the map or drag the pin to move it; `onChange` gets the new
 * position. The base map is recoloured to the verzus palette.
 */
export const VenueMap = forwardRef<
  VenueMapHandle,
  { pin: LatLng | null; center: LatLng; onChange?: (p: LatLng) => void; readOnly?: boolean; className?: string }
>(function VenueMap({ pin, center, onChange, readOnly = false, className = 'h-80 rounded-panel border border-line' }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const marker = useRef<Marker | null>(null);
  const changed = useRef(onChange);
  changed.current = onChange;
  const [satellite, setSatellite] = useState(false);
  // The theme on screen; the map is repainted when it changes (tiles can't read CSS).
  const theme = useShownTheme();
  const themeNow = useRef(theme);
  themeNow.current = theme;
  const loaded = useRef(false);
  useEffect(() => {
    if (map.current && loaded.current) verzusify(map.current, theme);
  }, [theme]);

  function showSatellite(on: boolean) {
    setSatellite(on);
    if (map.current?.getLayer('satellite')) map.current.setLayoutProperty('satellite', 'visibility', on ? 'visible' : 'none');
  }

  useImperativeHandle(ref, () => ({
    flyTo: (p, zoom = 15) => map.current?.flyTo({ center: [p.lng, p.lat], zoom, speed: 1.6 }),
    // maxZoom: a tiny barangay box would otherwise zoom in past the streets around it.
    fitBounds: (b) =>
      map.current?.fitBounds(
        [
          [b.west, b.south],
          [b.east, b.north],
        ],
        { padding: 32, maxZoom: 16, duration: 1200 },
      ),
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
    m.on('load', () => {
      loaded.current = true;
      // The compact attribution opens on its own and only folds after the first drag, covering a
      // third of a phone-sized map. Start it folded to its ⓘ button instead; a tap still opens it.
      box.current?.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show');
      verzusify(m, themeNow.current);
      if (SATELLITE_TILES) addSatellite(m);
    });
    // MapLibre only tracks window resizes; the box can also change size with the layout
    // (sidebar, phone rotation), which would leave part of the canvas blank.
    const resize = new ResizeObserver(() => m.resize());
    resize.observe(box.current);
    if (!readOnly) {
      m.on('click', (e) => {
        place({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        // A tap on a zoomed-out map is only roughly right: zoom in on it, ready to fine-tune.
        if (m.getZoom() < PLACE_ZOOM - 1) m.flyTo({ center: e.lngLat, zoom: PLACE_ZOOM, speed: 1.4 });
      });
    }
    map.current = m;
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
      marker.current = null;
      loaded.current = false;
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

  return (
    <div className="relative w-full">
      {/* vz-map themes MapLibre's own buttons (index.css); their icons are images, so dark needs a flag. */}
      <div ref={box} className={`vz-map w-full overflow-hidden ${theme === 'dark' ? 'vz-map--dark' : ''} ${className}`} />
      {SATELLITE_TILES && (
        <button
          type="button"
          onClick={() => showSatellite(!satellite)}
          aria-pressed={satellite}
          className="absolute bottom-3 left-3 z-10 rounded-control bg-surface px-4 py-2 text-sm font-semibold text-fg shadow-lg"
        >
          {satellite ? 'Map' : 'Satellite'}
        </button>
      )}
    </div>
  );
});

/**
 * Satellite photos under the map's roads and labels (hidden until switched on), so street and
 * place names stay readable on top of the imagery.
 */
function addSatellite(m: MapLibre) {
  if (!SATELLITE_TILES || m.getSource('satellite')) return;
  m.addSource('satellite', {
    type: 'raster',
    tiles: [SATELLITE_TILES],
    tileSize: 256,
    maxzoom: 19,
    attribution: SATELLITE_ATTRIBUTION,
  });
  const firstLabel = m.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  m.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } }, firstLabel);
}

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

/** Map colours per theme, in the palette of @verzus/tailwind/theme.css. */
const MAP_COLOURS = {
  light: {
    land: '#f5f5f9', // canvas
    area: '#efeff5', // built-up land
    park: '#e3f1e7', // a breath of green
    water: '#d7d4f4', // violet-tinted water
    building: '#e6e5f0',
    buildingEdge: '#d6d4e6',
    road: '#ffffff',
    roadMajor: '#ffffff',
    casing: '#dcdbe9',
    rail: '#cfcde0',
    boundary: '#b9b7d2',
    label: '#16142f',
    labelSoft: '#4b4968',
    labelWater: '#5a4fd8',
    halo: '#f5f5f9',
  },
  dark: {
    land: '#16152c', // surface
    area: '#1a1934',
    park: '#172a2a',
    water: '#1d1b45',
    building: '#22203f',
    buildingEdge: '#2b2950',
    road: '#2b2950',
    roadMajor: '#3b3866',
    casing: '#1f1d3c',
    rail: '#33305c',
    boundary: '#4a4780',
    label: '#f1f0fa',
    labelSoft: '#b8b5d6',
    labelWater: '#b8b3ff',
    halo: '#16152c',
  },
} as const;

/**
 * Paints the base map in the verzus palette for the theme on screen. Rather than a list of the
 * tile style's layer names (which vary between styles), each layer is coloured by what it is: its
 * type (fill, line, label) and the words in its id (water, park, building, casing, motorway...).
 * Label halos take the land colour, so street names stay readable on either ground.
 */
function verzusify(m: MapLibre, theme: 'light' | 'dark') {
  const k = MAP_COLOURS[theme];
  const has = (id: string, ...words: string[]) => words.some((w) => id.includes(w));
  const set = (id: string, prop: string, value: string) => {
    try {
      m.setPaintProperty(id, prop as Parameters<MapLibre['setPaintProperty']>[1], value);
    } catch {
      // A property this layer doesn't have: leave it.
    }
  };
  for (const layer of m.getStyle().layers) {
    const id = layer.id.toLowerCase();
    if (id === 'satellite') continue;
    if (layer.type === 'background') set(layer.id, 'background-color', k.land);
    else if (layer.type === 'fill') {
      const colour = has(id, 'water', 'ocean', 'lake', 'river')
        ? k.water
        : has(id, 'park', 'wood', 'forest', 'grass', 'landcover', 'cemetery', 'pitch')
          ? k.park
          : has(id, 'building')
            ? k.building
            : k.area;
      set(layer.id, 'fill-color', colour);
      if (has(id, 'building')) set(layer.id, 'fill-outline-color', k.buildingEdge);
    } else if (layer.type === 'line') {
      const colour = has(id, 'water', 'river', 'stream', 'canal')
        ? k.water
        : has(id, 'boundary', 'admin')
          ? k.boundary
          : has(id, 'rail', 'transit')
            ? k.rail
            : has(id, 'casing')
              ? k.casing
              : has(id, 'motorway', 'trunk', 'major', 'primary')
                ? k.roadMajor
                : k.road;
      set(layer.id, 'line-color', colour);
    } else if (layer.type === 'symbol') {
      const colour = has(id, 'water')
        ? k.labelWater
        : has(id, 'city', 'town', 'village', 'place', 'country', 'state')
          ? k.label
          : k.labelSoft;
      set(layer.id, 'text-color', colour);
      set(layer.id, 'text-halo-color', k.halo);
    }
  }
}
