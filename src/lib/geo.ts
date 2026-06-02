// Utilidades de geo: autocompletado con Mapbox Search Box API + Haversine + debounce.
// Aislado del resto del frontend para que sea fácil de testear y no acople
// MapContext con la API de Mapbox.
//
// Usamos Search Box API (no Geocoding v5) porque tiene MUCHO mejor cobertura
// de POIs en Colombia: encuentra "Universidad Nacional", "Centro Andino",
// "Parque Simón Bolívar", "Chapinero", direcciones tipo "Carrera 11 127",
// etc. Es flujo de 2 pasos:
//   1. suggest(query) → lista de sugerencias con mapbox_id (sin coords).
//   2. retrieve(mapbox_id) → coordenadas reales del lugar elegido.

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export interface LatLng {
  lat: number;
  lng: number;
}

// Sugerencia que sale del endpoint /suggest. Aun no tiene coordenadas —
// hay que llamar retrieveSuggestion(mapboxId) para obtenerlas.
export interface Suggestion {
  mapboxId: string;
  name: string;           // ej "Universidad Nacional"
  placeFormatted: string; // ej "Bogotá, 111321, Colombia"
}

// Resultado final tras retrieve: nombre completo y coordenadas.
export interface ResolvedPlace {
  name: string;
  lat: number;
  lng: number;
}

// Llama a Search Box API y devuelve hasta 5 sugerencias.
// sessionToken: UUID por sesión de búsqueda. Mapbox lo usa para agrupar
// suggest+retrieve y facturar como una sola "search session". Lo genera
// el componente y lo reusa entre llamadas.
//
// Throws Error si la red falla o el HTTP es no-2xx.
export async function suggestPlaces(query: string, sessionToken: string): Promise<Suggestion[]> {
  if (!MAPBOX_TOKEN) {
    throw new Error('VITE_MAPBOX_TOKEN no está configurado.');
  }
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = new URL('https://api.mapbox.com/search/searchbox/v1/suggest');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('session_token', sessionToken);
  url.searchParams.set('country', 'co');
  url.searchParams.set('proximity', '-74.07,4.65');
  url.searchParams.set('language', 'es');
  url.searchParams.set('limit', '5');

  const res = await fetch(url.toString());
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('El token de Mapbox no es válido.');
    }
    throw new Error(`Mapbox respondió ${res.status}`);
  }
  const json = (await res.json()) as {
    suggestions?: Array<{
      mapbox_id: string;
      name?: string;
      place_formatted?: string;
      full_address?: string;
    }>;
  };
  return (json.suggestions ?? []).map((s) => ({
    mapboxId: s.mapbox_id,
    name: s.name ?? s.full_address ?? '(sin nombre)',
    placeFormatted: s.place_formatted ?? '',
  }));
}

// Segunda llamada: obtiene las coordenadas reales del mapboxId elegido.
// Necesita el mismo sessionToken usado en suggest para el billing.
export async function retrieveSuggestion(mapboxId: string, sessionToken: string): Promise<ResolvedPlace> {
  if (!MAPBOX_TOKEN) {
    throw new Error('VITE_MAPBOX_TOKEN no está configurado.');
  }

  const url = new URL(`https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}`);
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('session_token', sessionToken);
  url.searchParams.set('language', 'es');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Mapbox respondió ${res.status} al obtener coordenadas.`);
  }
  const json = (await res.json()) as {
    features?: Array<{
      geometry: { coordinates: [number, number] };
      properties?: { name?: string; full_address?: string; place_formatted?: string };
    }>;
  };
  const f = (json.features ?? [])[0];
  if (!f) {
    throw new Error('Mapbox no devolvió coordenadas para esa sugerencia.');
  }
  const [lng, lat] = f.geometry.coordinates;
  const name = f.properties?.name ?? f.properties?.full_address ?? '';
  return { name, lat, lng };
}

// ── Geolocalización del navegador ──────────────────────────────────────
// Pide la ubicación actual al navegador (navigator.geolocation). La envolvemos
// en una promesa porque la API original es por callbacks. Mapeamos los códigos
// de error a mensajes en español para mostrarlos directo al usuario.
export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Tu navegador no soporta geolocalización.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        // err.code: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT.
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Permiso de ubicación denegado. Actívalo en el navegador o escribe tu dirección.'));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error('La ubicación tardó demasiado. Intenta de nuevo.'));
        } else {
          reject(new Error('No pudimos obtener tu ubicación. Intenta de nuevo.'));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// Reverse geocoding: coordenadas → dirección legible. Usa el endpoint /reverse
// de Search Box (mismo proveedor que suggest/retrieve). No necesita session
// token (Mapbox lo factura aparte de las "search sessions").
export async function reverseGeocode(lat: number, lng: number): Promise<ResolvedPlace> {
  if (!MAPBOX_TOKEN) {
    throw new Error('VITE_MAPBOX_TOKEN no está configurado.');
  }
  const url = new URL('https://api.mapbox.com/search/searchbox/v1/reverse');
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('access_token', MAPBOX_TOKEN);
  url.searchParams.set('language', 'es');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Mapbox respondió ${res.status} en reverse geocoding.`);
  }
  const json = (await res.json()) as {
    features?: Array<{
      properties?: { name?: string; full_address?: string; place_formatted?: string };
    }>;
  };
  const p = (json.features ?? [])[0]?.properties;
  if (!p) {
    throw new Error('Mapbox no encontró una dirección para tu ubicación.');
  }
  const name =
    p.full_address ??
    (p.name && p.place_formatted ? `${p.name}, ${p.place_formatted}` : p.name) ??
    'Dirección desconocida';
  return { name, lat, lng };
}

// Combina las dos: pide la ubicación al navegador y la convierte a dirección.
// Si el reverse falla (red, sin cobertura), cae a un texto con las coordenadas
// para que el flujo no se rompa — el campo de dirección queda con algo válido.
export async function detectMyLocation(): Promise<ResolvedPlace> {
  const { lat, lng } = await getCurrentPosition();
  try {
    return await reverseGeocode(lat, lng);
  } catch {
    return { name: `Ubicación (${lat.toFixed(5)}, ${lng.toFixed(5)})`, lat, lng };
  }
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

// Polígono (GeoJSON) que aproxima un círculo de `radiusKm` alrededor de un
// centro. Lo usamos para pintar el área del radio de búsqueda en el mapa.
// Aproximación equirectangular: suficiente a escala de ciudad.
export function circlePolygon(center: LatLng, radiusKm: number, steps = 64) {
  const coords: [number, number][] = [];
  const dx = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  const dy = radiusKm / 110.574;
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    coords.push([center.lng + dx * Math.cos(theta), center.lat + dy * Math.sin(theta)]);
  }
  coords.push(coords[0]); // cerrar el anillo
  return {
    type: 'Feature' as const,
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
    properties: {},
  };
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
