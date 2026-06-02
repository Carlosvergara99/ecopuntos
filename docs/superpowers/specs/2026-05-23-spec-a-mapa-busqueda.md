# Spec A — Mapa: catálogo expandido + búsqueda por dirección

**Status:** aprobado por el usuario el 2026-05-23.
**Branch:** rama nueva `feat/mapa-busqueda` desde `dev` local. **Sin push** por ahora (decisión del usuario).
**Sigue a:** `docs/superpowers/plans/2026-05-23-review-mejoras-ecopuntos.md` (ya cerrado en `dev`).

---

## Goal

Dos features de cara al usuario:

1. **Catálogo expandido**: pasar de 3 a 12 ecopuntos en el seed, distribuidos por localidades de Bogotá.
2. **Búsqueda por dirección con filtro de radio**: input con autocomplete de Mapbox, presets de radio (1/3/5/10 km), modo splash (no muestra ecopuntos hasta que ingreses dirección), filtrado client-side por distancia Haversine.

---

## Non-goals

- No tocamos auth ni solicitudes.
- No agregamos sign-in con Google (queda para Spec B).
- No enviamos emails reales (queda para Spec B).
- No tocamos los estilos generales del frontend (Tailwind classes existentes se respetan).
- No proxy del geocoding por backend — el frontend llama Mapbox directo, igual que ya hace con Directions API.
- No tests unitarios automatizados del frontend (no hay framework montado; verificación manual + build/lint).

---

## Decisiones tomadas (brainstorming)

| Decisión | Valor |
|---|---|
| Número de ecopuntos | 12 (3 existentes + 9 nuevos) |
| Origen de los datos | Plausibles, no UAESP reales |
| UX cercanía | Modo filtro: solo muestra los del radio elegido |
| Control radio | Chips preset 1/3/5/10 km (default 5) |
| Estado inicial | Splash: mapa sin marcadores hasta ingresar dirección |
| Geocoding API | Mapbox Geocoding (mismo token, `country=co`, `proximity=-74.07,4.65`) |
| Autocomplete | Sí, hasta 5 sugerencias, debounce 300ms |
| Cálculo distancia | Haversine (línea recta) |
| Cambio de radio | Re-filtra al instante (sin botón submit) |
| Pin "Estás aquí" | Oculto en splash. Aparece como pin azul de "dirección buscada" tras geocode. |
| Trazado de ruta | Origen pasa de `USER_LOCATION` hardcoded a `searchResult.lat/lng` (fallback a `USER_LOCATION` si no hay search). |
| Estrategia git | Rama local `feat/mapa-busqueda`, sin push. PR se decide al final. |

---

## Catálogo final (12 puntos)

Conservar los 3 actuales + añadir 9. Direcciones plausibles siguiendo nomenclatura de Bogotá. Coordenadas dentro de cada localidad (verificables en Google Maps).

| # | Nombre | Localidad | Dirección | Lat | Lng | Horario |
|---|---|---|---|---|---|---|
| 1 | Ecopunto Fontibón Centro | Fontibón | Carrera 99 # 18-20 | 4.6735 | -74.1450 | L-V 8:00–17:00 |
| 2 | Ecopunto Usaquén Norte | Usaquén | Calle 161 # 7-40 | 4.7350 | -74.0320 | L-V 7:00–16:00 |
| 3 | Ecopunto Kennedy Central | Kennedy | Avenida 1 de Mayo # 71-10 | 4.6200 | -74.1350 | L-S 8:00–18:00 |
| 4 | Ecopunto Suba Tibabuyes | Suba | Carrera 91 # 145-30 | 4.7440 | -74.0840 | L-V 8:00–17:00 |
| 5 | Ecopunto Engativá Boyacá | Engativá | Calle 80 # 96-40 | 4.7050 | -74.1100 | L-V 7:00–16:00 |
| 6 | Ecopunto Chapinero Norte | Chapinero | Carrera 13 # 63-20 | 4.6500 | -74.0620 | L-S 9:00–18:00 |
| 7 | Ecopunto Teusaquillo Salitre | Teusaquillo | Calle 40 # 22-15 | 4.6320 | -74.0880 | L-V 8:00–17:00 |
| 8 | Ecopunto Bosa Recreo | Bosa | Carrera 80I # 65-30 Sur | 4.6200 | -74.1850 | L-S 8:00–18:00 |
| 9 | Ecopunto Ciudad Bolívar Lucero | Ciudad Bolívar | Avenida Boyacá # 70-20 Sur | 4.5750 | -74.1500 | L-V 7:00–16:00 |
| 10 | Ecopunto San Cristóbal Sur | San Cristóbal | Carrera 5A # 32-50 Sur | 4.5630 | -74.0830 | Ma-S 9:00–17:00 |
| 11 | Ecopunto Tunjuelito Venecia | Tunjuelito | Calle 51 Sur # 24-50 | 4.5780 | -74.1310 | L-V 8:00–17:00 |
| 12 | Ecopunto Barrios Unidos Polo | Barrios Unidos | Calle 71 # 52-30 | 4.6700 | -74.0830 | L-S 8:00–18:00 |

Niveles de residuos (Madera / Escombros / Muebles y Enseres) con porcentajes variados entre 5% y 95% para que cada tarjeta luzca distinta. Colores fijos: `#f97316` (Madera, naranja), `#64748b` (Escombros, gris pizarra), `#3b82f6` (Muebles, azul).

---

## Arquitectura

### Reparto frontend/backend

| Pieza | Dónde | Por qué |
|---|---|---|
| Seed con 12 ecopuntos | Backend (`backend/src/db/seed.js`) | Datos ya viven ahí; el contrato no cambia. |
| Endpoint catálogo | Backend, ya existente | `GET /api/ecopuntos` sigue funcionando sin cambios. |
| Geocoding | Frontend | Llamada directa a Mapbox como ya se hace con Directions. Sin proxy. |
| Filtrado por distancia | Frontend | Tenemos los ecopuntos en memoria via `MapContext`; Haversine + filter. Cero round-trips. |
| Estado de búsqueda | Frontend, en `MapContext` | Es estado del mapa, no de sesión. |

### Archivos a tocar

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `backend/src/db/seed.js` | modificar | Reemplazar el array `ECOPUNTOS_SEED` (3 → 12). Sin cambios al esquema. |
| `src/lib/geo.ts` | crear | `geocode(query)`, `haversineKm(a, b)`, helper `debounce(fn, ms)`. Aislado y testeable. |
| `src/components/MapContext.tsx` | modificar | Estado y acciones nuevas (`searchResult`, `searchRadiusKm`, `isGeocoding`, `geocodeError`, `setSearch`, `setRadius`, `clearSearch`). `visibleEcopuntos` derivado. Efecto de ruta usa `searchResult` como origen con fallback. |
| `src/components/MapSearchPanel.tsx` | crear | Input + dropdown de sugerencias + chips de radio + resumen de resultados + botón limpiar. |
| `src/components/MapView.tsx` | modificar | Renderiza `MapSearchPanel`. Oculta `UserMarker`/`EcoPuntoMarkers` en splash. Pin azul nuevo en `searchResult`. Zoom inicial 11 (más amplio). |

### Estado en `MapContext`

```ts
interface LatLng { lat: number; lng: number }
interface SearchResult { query: string; lat: number; lng: number }

interface MapState {
  // existentes
  selectedPunto: EcoPunto | null;
  showRoute: boolean;
  routeData: any;
  isVoluminousModalOpen: boolean;
  ecopuntos: EcoPunto[];
  isLoadingEcopuntos: boolean;
  errorEcopuntos: string | null;
  // nuevos
  searchResult: SearchResult | null;
  searchRadiusKm: 1 | 3 | 5 | 10;
  isGeocoding: boolean;
  geocodeError: string | null;
}

interface MapActions {
  // existentes
  selectPunto, traceRoute, setVoluminousModalOpen, clearRoute,
  // nuevos
  setSearch: (result: SearchResult) => void;
  setRadius: (km: 1 | 3 | 5 | 10) => void;
  clearSearch: () => void;
  setGeocoding: (loading: boolean) => void;
  setGeocodeError: (err: string | null) => void;
}
```

Valor derivado (no estado):
```ts
const visibleEcopuntos = useMemo(() => {
  if (!searchResult) return [];
  return ecopuntos.filter(p =>
    haversineKm(
      { lat: searchResult.lat, lng: searchResult.lng },
      { lat: p.lat, lng: p.lng }
    ) <= searchRadiusKm
  );
}, [ecopuntos, searchResult, searchRadiusKm]);
```

### Mapbox Geocoding API

URL: `https://api.mapbox.com/geocoding/v5/mapbox.places/{ENCODED_QUERY}.json`

Params:
- `access_token={VITE_MAPBOX_TOKEN}`
- `country=co`
- `proximity=-74.07,4.65`
- `language=es`
- `limit=5`
- `autocomplete=true`

Response shape de interés: `{ features: [{ place_name: string, center: [lng, lat] }, ...] }`.

`geocode(query)` retorna `Suggestion[] = { placeName: string, lat: number, lng: number }[]`. En error de red o HTTP no-200, throw `Error` con mensaje legible.

### Haversine

```ts
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
```

---

## UX flujo

### Estado 1 — Splash

Mapa vacío (sin marcadores), zoom 11, centrado en Bogotá centro. El header de usuario + logout siguen visibles arriba. Debajo, el `MapSearchPanel` con:
- Input grande con placeholder `Busca tu dirección...`.
- Label `Radio:` + 4 chips: `1 km`, `3 km`, `5 km` (pre-seleccionado), `10 km`.

El FAB de "Residuos Voluminosos" sigue accesible (su flujo es independiente del search).

### Estado 2 — Autocomplete

Mientras el usuario tipea (≥ 3 chars), tras debounce de 300ms se dispara `geocode(query)`. Aparece dropdown con hasta 5 sugerencias.
- Click en una → estado pasa a "activo".
- `Enter` con texto sin haber clickeado → selecciona la primera sugerencia.
- `Esc` → cierra dropdown sin cambiar nada.
- Mientras `isGeocoding === true`, mostrar spinner pequeño dentro del input (no bloquear).

### Estado 3 — Búsqueda activa

- Pin azul nuevo en `searchResult.lng/lat` (reemplaza visualmente al `UserMarker`).
- Marcadores verdes para los ecopuntos en `visibleEcopuntos`.
- Panel cambia a layout compacto:
  - Texto con la dirección elegida y botón `×` para limpiar.
  - Chips de radio (el activo destacado).
  - Resumen: `N ecopuntos en X km` + nombre del más cercano con su distancia.
- Cambiar chip de radio → re-filtra al instante.
- Click en el nombre del más cercano → `flyTo` + abrir EcoPuntoCard.
- Click en marcador → `flyTo` + abrir EcoPuntoCard (igual que hoy).
- Botón "Trazar ruta" en EcoPuntoCard usa `searchResult` como origen (no `USER_LOCATION`).

### Edge cases

| Caso | Comportamiento |
|---|---|
| Geocoding red caída / 401 | Banner rojo: `No pude buscar la dirección. Verifica tu conexión.`. El input no se limpia. |
| 0 sugerencias para el texto | Dropdown muestra: `Sin resultados. Intenta otra dirección.` |
| Dirección elegida pero 0 ecopuntos en el radio | Panel muestra: `Sin ecopuntos en X km. Prueba un radio mayor.` Mapa solo con el pin azul. |
| Token Mapbox roto | El banner existente (`Falta VITE_MAPBOX_TOKEN`) se extiende a `...o el token no es válido.` cuando geocode falle con 401. |

---

## Verificación

- Backend smoke: `cd backend && npm run db:reset && npm run test:smoke` → **18 ok, 0 fallidos**. El test `GET /api/ecopuntos → N≥1 puntos` sigue pasando (ahora N=12).
- Frontend build: `pnpm build` limpio.
- Frontend lint: `pnpm lint` sin **nuevos** errores (los 3 pre-existentes en `MapContext.tsx` quedan; no introducir más).
- Manual:
  1. Login.
  2. Confirmar estado splash: mapa sin marcadores, panel visible.
  3. Tipear `Calle 100`, ver dropdown con sugerencias.
  4. Click en la primera. Pin azul aparece, marcadores filtrados aparecen.
  5. Probar los 4 chips de radio. Verificar que el conteo cambia.
  6. Probar radio bajo donde no hay ecopuntos → mensaje "Sin ecopuntos en X km".
  7. Click en "el más cercano" del panel → fly-to + EcoPuntoCard.
  8. Click en "Trazar ruta" → la ruta sale del pin azul, no del centro hardcoded.
  9. Click en `×` para limpiar → vuelve a splash.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `useMemo` con `react-compiler` puede ser redundante | Lo dejamos explícito por claridad; el compiler no romperá nada. |
| Llamadas excesivas a Mapbox Geocoding (cuota mensual) | Debounce 300ms + `limit=5`. Académico: improbable pasar 100k/mes. |
| El componente `UserMarker` ya no representa "usuario" sino "dirección" | Renombrarlo internamente confunde diff; mantener nombre y cambiar el color/icono. Aceptado como deuda cosmética. |
| Conflicto con código del compañero al hacer PR futuro | Cambios son aditivos (excepto modificación de `MapContext` y `MapView`). Si compañero rebasa después, conflictos mínimos. |
