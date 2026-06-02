# Spec A — Mapa: catálogo + búsqueda · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir el catálogo de 3 a 12 ecopuntos en el seed del backend e implementar búsqueda por dirección en el frontend con autocomplete de Mapbox, modo splash, filtrado por radio (1/3/5/10 km) y cálculo Haversine en cliente.

**Architecture:** Cambios concentrados: 1 archivo del backend (`seed.js`), 1 archivo de utilidades nuevo (`src/lib/geo.ts`), 2 componentes de React (uno nuevo `MapSearchPanel.tsx`, otro modificado `MapView.tsx`), y el contexto del mapa (`MapContext.tsx`) que crece con estado/acciones de búsqueda. Sin cambios al backend más allá de seed. Sin push: rama local `feat/mapa-busqueda`.

**Tech Stack:** Backend: Node 18+, Express 4, better-sqlite3 (sin cambios). Frontend: React 19, Vite 8, TypeScript, Tailwind 3, Mapbox Geocoding + Directions API (cliente). Gestores: `npm` (backend), `pnpm` / `corepack pnpm` (frontend).

---

## Phase 0 — Setup

### Task 0.1: Crear rama `feat/mapa-busqueda` desde `dev`

**Files:** ninguno se modifica.

- [ ] **Step 1: Verificar estado de partida**

Run: `cd /c/Users/NicolasPulidoMoreno/ecopuntos && git branch --show-current && git status -sb`
Expected: rama `dev`, working tree limpio (solo `.claude/` untracked).

- [ ] **Step 2: Crear y cambiar a la rama**

Run: `git checkout -b feat/mapa-busqueda`
Expected: `Switched to a new branch 'feat/mapa-busqueda'`.

- [ ] **Step 3: Confirmar baseline smoke + build**

Arrancar backend en background si no está corriendo:
```bash
cd backend && npm run dev > /tmp/backend.log 2>&1 &
sleep 4
```

Smoke:
```bash
cd backend && npm run test:smoke
```
Expected: `18 ok, 0 fallidos`.

Build frontend:
```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos && corepack pnpm build
```
Expected: `✓ built in N.NNs` sin errores.

---

## Phase 1 — Backend: 12 ecopuntos en el seed

### Task 1.1: Actualizar smoke test para verificar exactamente 12 ecopuntos

**Files:**
- Modify: `backend/scripts/smoke.js` (sección Ecopuntos)

- [ ] **Step 1: Cambiar la aserción de N≥1 a N=12**

Edit `backend/scripts/smoke.js`. Buscar el bloque del test de ecopuntos y reemplazar:

```js
await test('GET /api/ecopuntos → 200 con N≥1 puntos', async () => {
  const { status, body } = await api('/api/ecopuntos');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length >= 1);
  const eco = body.data[0];
  // Validamos el contrato que consume el frontend (campos en inglés).
  for (const k of ['id', 'name', 'address', 'hours', 'lat', 'lng', 'wasteLevels']) {
    assert.ok(k in eco, `falta campo ${k}`);
  }
  assert.ok(Array.isArray(eco.wasteLevels));
});
```

Por:

```js
await test('GET /api/ecopuntos → 200 con exactamente 12 puntos', async () => {
  const { status, body } = await api('/api/ecopuntos');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
  assert.equal(body.data.length, 12, `esperaba 12 ecopuntos, recibí ${body.data.length}`);
  const eco = body.data[0];
  // Contrato que consume el frontend (campos en inglés).
  for (const k of ['id', 'name', 'address', 'hours', 'lat', 'lng', 'wasteLevels']) {
    assert.ok(k in eco, `falta campo ${k}`);
  }
  assert.ok(Array.isArray(eco.wasteLevels));
  assert.ok(eco.wasteLevels.length > 0, 'wasteLevels no debería estar vacío');
});
```

- [ ] **Step 2: Correr smoke y verificar que falla**

Run: `cd backend && npm run test:smoke`
Expected: el test nuevo FALLA con `esperaba 12 ecopuntos, recibí 3`. Resto sigue pasando (17 ok, 1 fallido).

### Task 1.2: Expandir el seed a 12 puntos

**Files:**
- Modify: `backend/src/db/seed.js`

- [ ] **Step 1: Reemplazar el array `ECOPUNTOS_SEED` completo**

Edit `backend/src/db/seed.js`. Localizar el array `ECOPUNTOS_SEED` (líneas ~9-50) y reemplazarlo entero por:

```js
const ECOPUNTOS_SEED = [
  {
    id: '1',
    nombre: 'Ecopunto Fontibón Centro',
    direccion: 'Carrera 99 # 18-20',
    horario: 'Lunes a Viernes: 8:00 AM - 5:00 PM',
    lat: 4.6735,
    lng: -74.1450,
    niveles: [
      { nombre: 'Madera', porcentaje: 25, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 80, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 10, color: '#3b82f6' },
    ],
  },
  {
    id: '2',
    nombre: 'Ecopunto Usaquén Norte',
    direccion: 'Calle 161 # 7-40',
    horario: 'Lunes a Viernes: 7:00 AM - 4:00 PM',
    lat: 4.7350,
    lng: -74.0320,
    niveles: [
      { nombre: 'Madera', porcentaje: 60, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 30, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 45, color: '#3b82f6' },
    ],
  },
  {
    id: '3',
    nombre: 'Ecopunto Kennedy Central',
    direccion: 'Avenida 1 de Mayo # 71-10',
    horario: 'Lunes a Sábado: 8:00 AM - 6:00 PM',
    lat: 4.6200,
    lng: -74.1350,
    niveles: [
      { nombre: 'Madera', porcentaje: 15, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 95, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 20, color: '#3b82f6' },
    ],
  },
  {
    id: '4',
    nombre: 'Ecopunto Suba Tibabuyes',
    direccion: 'Carrera 91 # 145-30',
    horario: 'Lunes a Viernes: 8:00 AM - 5:00 PM',
    lat: 4.7440,
    lng: -74.0840,
    niveles: [
      { nombre: 'Madera', porcentaje: 40, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 55, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 70, color: '#3b82f6' },
    ],
  },
  {
    id: '5',
    nombre: 'Ecopunto Engativá Boyacá',
    direccion: 'Calle 80 # 96-40',
    horario: 'Lunes a Viernes: 7:00 AM - 4:00 PM',
    lat: 4.7050,
    lng: -74.1100,
    niveles: [
      { nombre: 'Madera', porcentaje: 75, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 20, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 35, color: '#3b82f6' },
    ],
  },
  {
    id: '6',
    nombre: 'Ecopunto Chapinero Norte',
    direccion: 'Carrera 13 # 63-20',
    horario: 'Lunes a Sábado: 9:00 AM - 6:00 PM',
    lat: 4.6500,
    lng: -74.0620,
    niveles: [
      { nombre: 'Madera', porcentaje: 10, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 25, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 85, color: '#3b82f6' },
    ],
  },
  {
    id: '7',
    nombre: 'Ecopunto Teusaquillo Salitre',
    direccion: 'Calle 40 # 22-15',
    horario: 'Lunes a Viernes: 8:00 AM - 5:00 PM',
    lat: 4.6320,
    lng: -74.0880,
    niveles: [
      { nombre: 'Madera', porcentaje: 50, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 65, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 30, color: '#3b82f6' },
    ],
  },
  {
    id: '8',
    nombre: 'Ecopunto Bosa Recreo',
    direccion: 'Carrera 80I # 65-30 Sur',
    horario: 'Lunes a Sábado: 8:00 AM - 6:00 PM',
    lat: 4.6200,
    lng: -74.1850,
    niveles: [
      { nombre: 'Madera', porcentaje: 85, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 75, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 60, color: '#3b82f6' },
    ],
  },
  {
    id: '9',
    nombre: 'Ecopunto Ciudad Bolívar Lucero',
    direccion: 'Avenida Boyacá # 70-20 Sur',
    horario: 'Lunes a Viernes: 7:00 AM - 4:00 PM',
    lat: 4.5750,
    lng: -74.1500,
    niveles: [
      { nombre: 'Madera', porcentaje: 35, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 90, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 15, color: '#3b82f6' },
    ],
  },
  {
    id: '10',
    nombre: 'Ecopunto San Cristóbal Sur',
    direccion: 'Carrera 5A # 32-50 Sur',
    horario: 'Martes a Sábado: 9:00 AM - 5:00 PM',
    lat: 4.5630,
    lng: -74.0830,
    niveles: [
      { nombre: 'Madera', porcentaje: 20, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 45, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 55, color: '#3b82f6' },
    ],
  },
  {
    id: '11',
    nombre: 'Ecopunto Tunjuelito Venecia',
    direccion: 'Calle 51 Sur # 24-50',
    horario: 'Lunes a Viernes: 8:00 AM - 5:00 PM',
    lat: 4.5780,
    lng: -74.1310,
    niveles: [
      { nombre: 'Madera', porcentaje: 65, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 40, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 25, color: '#3b82f6' },
    ],
  },
  {
    id: '12',
    nombre: 'Ecopunto Barrios Unidos Polo',
    direccion: 'Calle 71 # 52-30',
    horario: 'Lunes a Sábado: 8:00 AM - 6:00 PM',
    lat: 4.6700,
    lng: -74.0830,
    niveles: [
      { nombre: 'Madera', porcentaje: 30, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 50, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 80, color: '#3b82f6' },
    ],
  },
];
```

- [ ] **Step 2: Reset DB y re-seed**

Run: `cd backend && npm run db:reset`
Expected output incluye `[seed] Insertados 12 ecopuntos con sus niveles.`.

- [ ] **Step 3: Smoke verde**

Run: `cd backend && npm run test:smoke`
Expected: `18 ok, 0 fallidos`. Si vuelve a fallar el test del registro duplicado o el de fecha pasada, son tests acumulativos contra la DB — el reset no los limpia automáticamente entre runs, son emails únicos por timestamp, deberían pasar.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
git add backend/src/db/seed.js backend/scripts/smoke.js
git commit -m "feat(backend): expandir seed a 12 ecopuntos por localidad de Bogota"
```

---

## Phase 2 — Frontend: utilidades de geo

### Task 2.1: Crear `src/lib/geo.ts`

**Files:**
- Create: `src/lib/geo.ts`

- [ ] **Step 1: Escribir el archivo completo**

Write `src/lib/geo.ts`:

```ts
// Utilidades de geo: geocoding via Mapbox + Haversine + debounce.
// Aislado del resto del frontend para que sea fácil de testear y
// no acople MapContext con la API de Mapbox.

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Suggestion {
  placeName: string;
  lat: number;
  lng: number;
}

// Llama a Mapbox Geocoding y devuelve hasta 5 sugerencias para una query.
// Sesgamos a Colombia (country=co) y centro de Bogotá (proximity) para
// que las primeras opciones sean siempre locales.
//
// Throws Error si la red falla o el HTTP es no-2xx, con mensaje legible.
export async function geocode(query: string): Promise<Suggestion[]> {
  if (!MAPBOX_TOKEN) {
    throw new Error('VITE_MAPBOX_TOKEN no está configurado.');
  }
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json`
  );
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('country', 'co');
  url.searchParams.set('proximity', '-74.07,4.65');
  url.searchParams.set('language', 'es');
  url.searchParams.set('limit', '5');
  url.searchParams.set('autocomplete', 'true');

  const res = await fetch(url.toString());
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('El token de Mapbox no es válido.');
    }
    throw new Error(`Mapbox respondió ${res.status}`);
  }
  const json = (await res.json()) as {
    features?: Array<{ place_name: string; center: [number, number] }>;
  };
  return (json.features ?? []).map((f) => ({
    placeName: f.place_name,
    lng: f.center[0],
    lat: f.center[1],
  }));
}

// Distancia en kilómetros entre dos puntos (línea recta sobre la esfera).
// Fórmula Haversine. Para los radios cortos de Bogotá la curvatura terrestre
// es despreciable pero la usamos por correctitud y para no preocuparnos del
// signo de las longitudes.
const EARTH_R_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(x));
}

// Devuelve una versión "debounced" de fn que solo se invoca después
// de `ms` sin ser llamada otra vez. Lo usamos para no pegarle a Mapbox
// en cada keystroke.
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
```

- [ ] **Step 2: Verificar build TS**

Run: `corepack pnpm build`
Expected: build limpio.

- [ ] **Step 3: Commit**

```bash
git add src/lib/geo.ts
git commit -m "feat(frontend): utilidades de geo (geocode, haversine, debounce)"
```

---

## Phase 3 — Frontend: `MapContext` con estado de búsqueda

### Task 3.1: Extender `MapContext.tsx` con búsqueda + radio + visibleEcopuntos

**Files:**
- Modify: `src/components/MapContext.tsx` (reescritura completa)

- [ ] **Step 1: Reemplazar el contenido del archivo**

Write `src/components/MapContext.tsx`:

```tsx
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { EcoPunto } from '../data/ecopuntos';
import { api } from '../lib/api';
import { haversineKm, type LatLng } from '../lib/geo';

export interface SearchResult {
  query: string;
  lat: number;
  lng: number;
}

export type RadiusKm = 1 | 3 | 5 | 10;

interface MapState {
  selectedPunto: EcoPunto | null;
  showRoute: boolean;
  routeData: any;
  isVoluminousModalOpen: boolean;
  ecopuntos: EcoPunto[];
  isLoadingEcopuntos: boolean;
  errorEcopuntos: string | null;
  // Nuevos: búsqueda por dirección + radio.
  searchResult: SearchResult | null;
  searchRadiusKm: RadiusKm;
  isGeocoding: boolean;
  geocodeError: string | null;
  // Derivado: ecopuntos visibles (filtrados por distancia). Vacío en splash.
  visibleEcopuntos: EcoPunto[];
}

interface MapActions {
  selectPunto: (punto: EcoPunto | null) => void;
  traceRoute: () => void;
  setVoluminousModalOpen: (open: boolean) => void;
  clearRoute: () => void;
  // Nuevos.
  setSearch: (result: SearchResult) => void;
  setRadius: (km: RadiusKm) => void;
  clearSearch: () => void;
  setGeocoding: (loading: boolean) => void;
  setGeocodeError: (err: string | null) => void;
}

interface MapContextValue {
  state: MapState;
  actions: MapActions;
}

const MapContext = createContext<MapContextValue | null>(null);

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) throw new Error('useMapContext must be used within a MapProvider');
  return context;
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const FALLBACK_ORIGIN: LatLng = { lat: 4.6582, lng: -74.0939 };

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedPunto, setSelectedPunto] = useState<EcoPunto | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);
  const [isVoluminousModalOpen, setIsVoluminousModalOpen] = useState(false);
  const [ecopuntos, setEcopuntos] = useState<EcoPunto[]>([]);
  const [isLoadingEcopuntos, setIsLoadingEcopuntos] = useState(true);
  const [errorEcopuntos, setErrorEcopuntos] = useState<string | null>(null);

  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchRadiusKm, setSearchRadiusKm] = useState<RadiusKm>(5);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  // Carga del catálogo (igual que antes; setStates dentro de los callbacks
  // para no caer en react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelado = false;
    api<EcoPunto[]>('/api/ecopuntos')
      .then((data) => {
        if (!cancelado) setEcopuntos(data);
      })
      .catch((err: Error) => {
        if (!cancelado) setErrorEcopuntos(err.message);
      })
      .finally(() => {
        if (!cancelado) setIsLoadingEcopuntos(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Ecopuntos visibles = los que están dentro del radio desde la dirección
  // buscada. En splash (sin searchResult), está vacío.
  const visibleEcopuntos = useMemo(() => {
    if (!searchResult) return [];
    return ecopuntos.filter(
      (p) =>
        haversineKm(
          { lat: searchResult.lat, lng: searchResult.lng },
          { lat: p.lat, lng: p.lng }
        ) <= searchRadiusKm
    );
  }, [ecopuntos, searchResult, searchRadiusKm]);

  const selectPunto = (punto: EcoPunto | null) => {
    setSelectedPunto(punto);
    if (punto && punto.id !== selectedPunto?.id) {
      setShowRoute(false);
      setRouteData(null);
    }
  };

  const traceRoute = () => setShowRoute(true);
  const clearRoute = () => {
    setShowRoute(false);
    setRouteData(null);
  };

  const setSearch = (result: SearchResult) => {
    setSearchResult(result);
    setGeocodeError(null);
    // Al cambiar de dirección, descartamos la ruta anterior (sale de otro origen).
    setShowRoute(false);
    setRouteData(null);
  };

  const setRadius = (km: RadiusKm) => setSearchRadiusKm(km);

  const clearSearch = () => {
    setSearchResult(null);
    setGeocodeError(null);
    setSelectedPunto(null);
    setShowRoute(false);
    setRouteData(null);
  };

  // Trazado de ruta: el origen es la dirección buscada si existe, sino el
  // fallback (centro hardcoded de Bogotá). Cambio mínimo respecto a antes.
  useEffect(() => {
    if (showRoute && selectedPunto) {
      const origin = searchResult
        ? { lat: searchResult.lat, lng: searchResult.lng }
        : FALLBACK_ORIGIN;
      const getRoute = async () => {
        try {
          const query = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${selectedPunto.lng},${selectedPunto.lat}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`
          );
          const json = await query.json();
          if (json.routes?.[0]) {
            setRouteData({
              type: 'Feature',
              properties: {},
              geometry: json.routes[0].geometry,
            });
          }
        } catch (error) {
          console.error('Error fetching route:', error);
        }
      };
      getRoute();
    }
  }, [showRoute, selectedPunto, searchResult]);

  const value: MapContextValue = {
    state: {
      selectedPunto,
      showRoute,
      routeData,
      isVoluminousModalOpen,
      ecopuntos,
      isLoadingEcopuntos,
      errorEcopuntos,
      searchResult,
      searchRadiusKm,
      isGeocoding,
      geocodeError,
      visibleEcopuntos,
    },
    actions: {
      selectPunto,
      traceRoute,
      setVoluminousModalOpen: setIsVoluminousModalOpen,
      clearRoute,
      setSearch,
      setRadius,
      clearSearch,
      setGeocoding: setIsGeocoding,
      setGeocodeError,
    },
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};
```

- [ ] **Step 2: Build TS**

Run: `corepack pnpm build`
Expected: limpio. Si falla porque `MapView.tsx` consume `EcoPuntoMarkers` con `ecopuntos` (no `visibleEcopuntos`), eso se arregla en Phase 5 — pero el build debería seguir verde porque `ecopuntos` no fue eliminado del estado.

- [ ] **Step 3: Commit**

```bash
git add src/components/MapContext.tsx
git commit -m "feat(frontend): MapContext con estado de busqueda, radio y visibleEcopuntos"
```

---

## Phase 4 — Frontend: `MapSearchPanel`

### Task 4.1: Crear `src/components/MapSearchPanel.tsx`

**Files:**
- Create: `src/components/MapSearchPanel.tsx`

- [ ] **Step 1: Crear el componente**

Write `src/components/MapSearchPanel.tsx`:

```tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import { useMapContext } from './MapContext';
import { geocode, debounce, haversineKm, type Suggestion } from '../lib/geo';
import type { RadiusKm } from './MapContext';

const RADIOS: RadiusKm[] = [1, 3, 5, 10];

const MapSearchPanel: React.FC = () => {
  const {
    state: {
      searchResult,
      searchRadiusKm,
      isGeocoding,
      geocodeError,
      visibleEcopuntos,
    },
    actions: {
      setSearch,
      setRadius,
      clearSearch,
      setGeocoding,
      setGeocodeError,
      selectPunto,
    },
  } = useMapContext();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Función debounced que pega a Mapbox al cambiar el texto. Usamos useMemo
  // para que el debounce conserve su timer entre renders.
  const runGeocode = useMemo(
    () =>
      debounce(async (text: string) => {
        if (text.trim().length < 3) {
          setSuggestions([]);
          setGeocoding(false);
          return;
        }
        try {
          const results = await geocode(text);
          setSuggestions(results);
          setGeocodeError(null);
        } catch (err) {
          setGeocodeError(err instanceof Error ? err.message : 'Error en geocoding.');
          setSuggestions([]);
        } finally {
          setGeocoding(false);
        }
      }, 300),
    [setGeocoding, setGeocodeError]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);
    if (value.trim().length >= 3) {
      setGeocoding(true);
      runGeocode(value);
    } else {
      setSuggestions([]);
      setGeocoding(false);
    }
  };

  const handlePick = useCallback(
    (s: Suggestion) => {
      setSearch({ query: s.placeName, lat: s.lat, lng: s.lng });
      setQuery(s.placeName);
      setSuggestions([]);
      setIsOpen(false);
    },
    [setSearch]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      handlePick(suggestions[0]);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleBlur = () => {
    // Pequeño delay para que el click en una sugerencia se registre antes
    // de cerrar el dropdown.
    blurTimer.current = setTimeout(() => setIsOpen(false), 150);
  };

  const handleFocus = () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    if (suggestions.length > 0) setIsOpen(true);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    clearSearch();
  };

  // Información para el resumen cuando ya hay búsqueda activa.
  const closest = useMemo(() => {
    if (!searchResult || visibleEcopuntos.length === 0) return null;
    let best = visibleEcopuntos[0];
    let bestDist = haversineKm(
      { lat: searchResult.lat, lng: searchResult.lng },
      { lat: best.lat, lng: best.lng }
    );
    for (const p of visibleEcopuntos.slice(1)) {
      const d = haversineKm(
        { lat: searchResult.lat, lng: searchResult.lng },
        { lat: p.lat, lng: p.lng }
      );
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    return { punto: best, km: bestDist };
  }, [searchResult, visibleEcopuntos]);

  return (
    <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-white/20">
      {/* Input + clear */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder="Busca tu dirección..."
          className="w-full pl-11 pr-10 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-sm bg-gray-50/50"
        />
        {(query.length > 0 || searchResult) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:bg-gray-100"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isGeocoding && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
          </div>
        )}

        {/* Dropdown de sugerencias */}
        {isOpen && (suggestions.length > 0 || (query.length >= 3 && !isGeocoding)) && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden z-20">
            {suggestions.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-500">
                Sin resultados. Intenta otra dirección.
              </div>
            ) : (
              suggestions.map((s, i) => (
                <button
                  type="button"
                  key={`${s.lat}-${s.lng}-${i}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePick(s)}
                  className="w-full flex items-start gap-2 px-4 py-2.5 text-left text-sm hover:bg-green-50"
                >
                  <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{s.placeName}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Error de geocoding */}
      {geocodeError && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
          {geocodeError}
        </p>
      )}

      {/* Chips de radio */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">
          Radio
        </span>
        {RADIOS.map((r) => (
          <button
            type="button"
            key={r}
            onClick={() => setRadius(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              searchRadiusKm === r
                ? 'bg-green-600 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {r} km
          </button>
        ))}
      </div>

      {/* Resumen si hay búsqueda activa */}
      {searchResult && (
        <div className="mt-3 text-xs text-gray-600">
          {visibleEcopuntos.length === 0 ? (
            <p className="font-semibold text-amber-700">
              Sin ecopuntos en {searchRadiusKm} km. Prueba un radio mayor.
            </p>
          ) : (
            <>
              <p className="font-semibold text-gray-700">
                {visibleEcopuntos.length} ecopunto{visibleEcopuntos.length === 1 ? '' : 's'} en {searchRadiusKm} km
              </p>
              {closest && (
                <button
                  type="button"
                  onClick={() => selectPunto(closest.punto)}
                  className="mt-1 text-green-700 hover:underline"
                >
                  Más cercano: {closest.punto.name} ({closest.km.toFixed(1)} km)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MapSearchPanel;
```

- [ ] **Step 2: Build TS**

Run: `corepack pnpm build`
Expected: limpio.

- [ ] **Step 3: Commit**

```bash
git add src/components/MapSearchPanel.tsx
git commit -m "feat(frontend): MapSearchPanel con autocomplete y chips de radio"
```

---

## Phase 5 — Frontend: integración en `MapView`

### Task 5.1: Integrar `MapSearchPanel` y splash mode

**Files:**
- Modify: `src/components/MapView.tsx` (reescritura completa)

- [ ] **Step 1: Reescribir el archivo**

Write `src/components/MapView.tsx`:

```tsx
import React from 'react';
import { Map, Marker, Popup, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import EcoPuntoCard from './EcoPuntoCard';
import VoluminousWasteModal from './VoluminousWasteModal';
import MapSearchPanel from './MapSearchPanel';
import { MapPin, Navigation, Truck, X, LogOut, User as UserIcon } from 'lucide-react';
import { MapProvider, useMapContext } from './MapContext';
import IconButton from './ui/IconButton';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
// Centro de Bogotá para el zoom inicial del mapa en splash.
const BOGOTA_CENTER = { latitude: 4.65, longitude: -74.08 };

interface MapViewProps {
  onLogout?: () => void;
  user?: { name: string; email: string } | null;
}

// Pin azul que marca la dirección buscada. Solo se renderiza si hay
// searchResult — en splash no se ve nada.
const SearchedAddressMarker = () => {
  const { state: { searchResult } } = useMapContext();
  if (!searchResult) return null;
  return (
    <Marker longitude={searchResult.lng} latitude={searchResult.lat} anchor="center">
      <div className="relative w-10 h-10 flex items-center justify-center">
        <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
        <div className="relative w-8 h-8 bg-blue-600 rounded-full border-4 border-white flex items-center justify-center shadow-xl">
          <Navigation className="w-4 h-4 text-white fill-current rotate-[225deg]" />
        </div>
      </div>
    </Marker>
  );
};

// Solo se renderizan los ecopuntos del radio activo (visibleEcopuntos).
// En splash visibleEcopuntos está vacío → no se ve nada.
const EcoPuntoMarkers = () => {
  const {
    state: { visibleEcopuntos },
    actions: { selectPunto },
  } = useMapContext();
  return (
    <>
      {visibleEcopuntos.map((punto) => (
        <Marker
          key={punto.id}
          longitude={punto.lng}
          latitude={punto.lat}
          anchor="bottom"
          onClick={e => {
            e.originalEvent.stopPropagation();
            selectPunto(punto);
          }}
        >
          <div className="group cursor-pointer transform transition-transform hover:scale-110 active:scale-95">
            <div className="w-10 h-10 bg-green-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-green-500 rotate-45 border-r-2 border-b-2 border-white"></div>
          </div>
        </Marker>
      ))}
    </>
  );
};

const RouteLayer = () => {
  const { state: { showRoute, routeData } } = useMapContext();
  if (!showRoute || !routeData) return null;
  return (
    <Source id="route-source" type="geojson" data={routeData}>
      <Layer
        id="route-layer"
        type="line"
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        paint={{ 'line-color': '#7c3aed', 'line-width': 6, 'line-dasharray': [2, 2] }}
      />
    </Source>
  );
};

const EcoPuntoPopup = () => {
  const {
    state: { selectedPunto },
    actions: { selectPunto, traceRoute }
  } = useMapContext();

  if (!selectedPunto) return null;

  return (
    <Popup
      longitude={selectedPunto.lng}
      latitude={selectedPunto.lat}
      closeButton={false}
      closeOnClick={false}
      anchor="bottom"
      offset={40}
      maxWidth="none"
      className="z-[2000] custom-popup"
    >
      <EcoPuntoCard
        punto={selectedPunto}
        onClose={() => selectPunto(null)}
        onTraceRoute={traceRoute}
      />
    </Popup>
  );
};

const MapOverlays: React.FC<MapViewProps> = ({ onLogout, user }) => {
  const {
    state: { selectedPunto, isVoluminousModalOpen, showRoute },
    actions: { setVoluminousModalOpen, clearRoute }
  } = useMapContext();

  return (
    <>
      {/* Top floating area: header de usuario + panel de búsqueda. */}
      <div className="absolute top-6 left-6 right-6 z-10 flex flex-col gap-3 max-w-md sm:max-w-md md:max-w-md">
        {!selectedPunto && (
          <div className="flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-white/20 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-100">
                <UserIcon className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Sesión Iniciada</p>
                <p className="text-sm font-black text-gray-800 leading-none">{user?.name || 'Ciudadano'}</p>
                <p className="text-[9px] text-gray-500 font-medium mt-1">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <IconButton
                icon={<LogOut className="w-4 h-4" />}
                onClick={onLogout}
                variant="danger"
              />
            </div>
          </div>
        )}

        {/* Panel de búsqueda (siempre visible salvo cuando hay un punto abierto). */}
        {!selectedPunto && <MapSearchPanel />}

        {showRoute && (
          <button
            onClick={clearRoute}
            className="self-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar Ruta
          </button>
        )}
      </div>

      {/* Voluminous Waste FAB */}
      <div className="absolute bottom-10 right-6 z-10 flex flex-col items-end gap-3">
        {!isVoluminousModalOpen && !selectedPunto && (
          <button
            onClick={() => setVoluminousModalOpen(true)}
            className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-3xl shadow-2xl transition-all hover:scale-105 active:scale-95 group"
          >
            <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform">
              <Truck className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Agendar recolección</p>
              <p className="text-sm font-black">Residuos Voluminosos</p>
            </div>
          </button>
        )}
      </div>

      {isVoluminousModalOpen && (
        <VoluminousWasteModal onClose={() => setVoluminousModalOpen(false)} />
      )}
    </>
  );
};

const MapView: React.FC<MapViewProps> = (props) => {
  return (
    <MapProvider>
      <div className="relative w-full h-screen overflow-hidden">
        <Map
          initialViewState={{
            longitude: BOGOTA_CENTER.longitude,
            latitude: BOGOTA_CENTER.latitude,
            zoom: 11
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
        >
          <SearchedAddressMarker />
          <EcoPuntoMarkers />
          <RouteLayer />
          <EcoPuntoPopup />
        </Map>

        <MapOverlays {...props} />

        {/* Token Alert */}
        {!MAPBOX_TOKEN && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg animate-bounce">
            Falta VITE_MAPBOX_TOKEN en el archivo .env
          </div>
        )}

        <MapDataStatusBanner />
      </div>
    </MapProvider>
  );
};

const MapDataStatusBanner = () => {
  const { state: { isLoadingEcopuntos, errorEcopuntos, ecopuntos } } = useMapContext();
  if (errorEcopuntos) {
    return (
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg">
        No se pudo cargar el catálogo: {errorEcopuntos}
      </div>
    );
  }
  if (!isLoadingEcopuntos && ecopuntos.length === 0) {
    return (
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg">
        El backend no devolvió ecopuntos.
      </div>
    );
  }
  return null;
};

export default MapView;
```

> Cambios clave respecto a la versión actual:
> - Quitado `UserMarker` (el pin "Estás aquí" hardcoded). Reemplazado por `SearchedAddressMarker` que solo aparece si hay `searchResult`.
> - Quitado `MapContextConsumer` (el popup "¡Estás aquí!"). Sin pin de usuario hardcoded, no hace sentido.
> - `EcoPuntoMarkers` ahora lee `visibleEcopuntos` (no `ecopuntos`).
> - Quitado el bloque de "Ubicación / Bogotá, CO" del header (estaba al lado del logout). Ahora ese espacio lo ocupa naturalmente el panel de búsqueda.
> - Zoom inicial 11 (vista de toda Bogotá) en vez de 13. Centro ligeramente distinto para abarcar las localidades del sur.
> - Renderizado de `MapSearchPanel` debajo del header de usuario.
> - Constante `USER_LOCATION` eliminada del archivo (ya no se usa; la fallback vive en `MapContext`).

- [ ] **Step 2: Build TS**

Run: `corepack pnpm build`
Expected: limpio. Si TS se queja por algún tipo desactualizado, revisar.

- [ ] **Step 3: Lint**

Run: `corepack pnpm lint`
Expected: máximo los 3 errores pre-existentes en `MapContext.tsx` (any en routeData, fast-refresh por export de useMapContext). No deben aparecer errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat(frontend): MapView con splash + busqueda integrada"
```

---

## Phase 6 — Verificación final

### Task 6.1: Verificación automatizada

**Files:** ninguno.

- [ ] **Step 1: Backend smoke verde**

Asegurar backend corriendo. Run: `cd backend && npm run test:smoke`
Expected: `18 ok, 0 fallidos`.

- [ ] **Step 2: Frontend build limpio**

Run: `cd /c/Users/NicolasPulidoMoreno/ecopuntos && corepack pnpm build`
Expected: `✓ built in N.NNs` sin errores TS.

- [ ] **Step 3: Frontend lint**

Run: `corepack pnpm lint`
Expected: solamente los 3 errores pre-existentes (`MapContext.tsx`: 2 `any`, 1 fast-refresh). No introducir nuevos errores.

### Task 6.2: Verificación manual end-to-end

**Files:** ninguno. Asume backend y `pnpm dev` corriendo. Si no:
```bash
cd backend && npm run dev &
cd /c/Users/NicolasPulidoMoreno/ecopuntos && corepack pnpm dev &
```

Abrir `http://localhost:5173/`.

- [ ] **Step 1: Login**

Usar las credenciales que ya tienes registradas (o crear cuenta nueva: nombre `Nicolas`, email cualquiera, password ≥ 6 chars).

Expected: te lleva al mapa.

- [ ] **Step 2: Splash mode**

Expected:
- El mapa se ve centrado en Bogotá con zoom amplio (≈ ciudad entera).
- **NO hay marcadores verdes** (ningún ecopunto visible).
- **NO hay pin azul** de usuario.
- El header con tu nombre y el botón LogOut están arriba.
- Debajo del header, el panel de búsqueda con input "Busca tu dirección..." y los 4 chips de radio (5 km activo en verde).

- [ ] **Step 3: Autocomplete**

Tipear `Calle 100` en el input.

Expected:
- Después de 300ms aparece spinner pequeño y luego un dropdown con hasta 5 sugerencias de Bogotá.
- Las sugerencias incluyen direcciones tipo "Calle 100 # X-Y, Bogotá".

Click en la primera sugerencia.

- [ ] **Step 4: Búsqueda activa**

Expected:
- Aparece pin azul en la dirección elegida.
- Aparecen marcadores verdes de los ecopuntos dentro de 5 km.
- El panel ahora muestra: `N ecopuntos en 5 km` + "Más cercano: [Nombre] (X.X km)".
- Conteo coherente (≈ 3-6 ecopuntos para Calle 100).

- [ ] **Step 5: Cambio de radio**

Click en `1 km` → re-filtra inmediatamente. Probablemente muestre "Sin ecopuntos en 1 km. Prueba un radio mayor.".

Click en `10 km` → muestra muchos más ecopuntos.

Click en `5 km` → vuelve al estado del paso 4.

- [ ] **Step 6: Más cercano + flyTo**

Click en el texto "Más cercano: ..." del panel.

Expected: el mapa hace `flyTo` al marcador correspondiente y abre la EcoPuntoCard.

- [ ] **Step 7: Trazar ruta usa el pin azul**

Estando con la EcoPuntoCard abierta, click "Trazar ruta hasta aquí".

Expected: aparece la línea morada/punteada **desde el pin azul** (la dirección buscada) hasta el ecopunto. NO desde el centro hardcoded.

Click "Limpiar Ruta" → la línea desaparece.

- [ ] **Step 8: Cerrar EcoPuntoCard y limpiar búsqueda**

Click `×` de la EcoPuntoCard → vuelve el header + panel.

Click `×` del input de búsqueda → vuelve a Estado Splash (sin marcadores, sin pin azul, panel limpio).

- [ ] **Step 9: Búsqueda con dirección inexistente**

Tipear `dirección que no existe ABCXYZ`.

Expected: dropdown con "Sin resultados. Intenta otra dirección." Sin error rojo.

- [ ] **Step 10: 12 ecopuntos totales**

En DevTools (F12 → Network), buscar la respuesta de `GET http://localhost:4000/api/ecopuntos`. Verificar que `data` tenga 12 entradas, una por cada localidad del catálogo. Comparar al menos 3-4 nombres con la tabla de la spec.

### Task 6.3: Resumen final + status

**Files:** ninguno.

- [ ] **Step 1: Commit log**

Run: `git log --oneline dev..HEAD`

Expected (aprox):
```
xxxxxxx feat(frontend): MapView con splash + busqueda integrada
xxxxxxx feat(frontend): MapSearchPanel con autocomplete y chips de radio
xxxxxxx feat(frontend): MapContext con estado de busqueda, radio y visibleEcopuntos
xxxxxxx feat(frontend): utilidades de geo (geocode, haversine, debounce)
xxxxxxx feat(backend): expandir seed a 12 ecopuntos por localidad de Bogota
```

5 commits sobre `dev`, todos en la rama `feat/mapa-busqueda`.

- [ ] **Step 2: Working tree limpio**

Run: `git status -sb`
Expected: solo `.claude/` untracked. Sin cambios sin commitear.

- [ ] **Step 3: Reporte al usuario**

Producir resumen con:
- Tests: `18 ok, 0 fallidos`.
- Build: OK.
- Lint: 3 errores pre-existentes (no nuevos).
- 5 commits en `feat/mapa-busqueda`.
- Pendientes: la decisión de hacer push / merge a `dev` / crear PR.

Si CUALQUIER paso falla: `superpowers:systematic-debugging`. NO declarar Spec A completo con verificaciones en rojo (`superpowers:verification-before-completion`).

---

## Notas de ejecución

- **Sin push**: todos los commits se quedan en `feat/mapa-busqueda` local. La decisión de subir/merge se toma al final como skill `finishing-a-development-branch`.
- **Backend `node_modules`**: el último cierre dejó `node_modules` instalado con `npm` (no `pnpm`). Si en algún momento corro `corepack pnpm` desde dentro de `backend/` por error, podría reinstalar layout pnpm y romper better-sqlite3. Cuidado: ejecutar `corepack pnpm` SIEMPRE desde la raíz del repo, nunca desde `backend/`.
- **Estado de servers**: en Phase 6 manual conviene reiniciar limpios (`kill` de procesos viejos en :4000/:5173).
- **`UserMarker` removido**: era el pin azul fijo en lat 4.6582 / lng -74.0939. Lo reemplaza `SearchedAddressMarker` que solo aparece si hay búsqueda. El popup "¡Estás aquí!" también se va.
- **`MapContextConsumer`**: componente interno del MapView antiguo (popup hardcoded). Eliminado en Phase 5.
