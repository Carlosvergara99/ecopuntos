// Contexto, tipos y hook del mapa, separados del componente <MapProvider>
// (que vive en MapContext.tsx). Tenerlos aparte permite que MapContext.tsx
// exporte SOLO el componente y así funcione bien el Fast Refresh de React.

import { createContext, useContext } from 'react';
import type { EcoPunto } from '../data/ecopuntos';

export interface SearchResult {
  query: string;
  lat: number;
  lng: number;
}

export type RadiusKm = 1 | 3 | 5 | 10;

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
}

// GeoJSON de la ruta (Feature con geometría LineString). Antes era `any`.
export interface RouteGeoJSON {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}

// Paso (maniobra) de la ruta, usado por la navegación "lite" turn-by-turn.
export interface RouteStep {
  distance: number;            // metros de este paso
  instruction: string;         // ej. "Gira a la derecha en la Calle 80"
  location: [number, number];  // [lng, lat] de la maniobra
}

export interface MapState {
  selectedPunto: EcoPunto | null;
  showRoute: boolean;
  routeData: RouteGeoJSON | null;
  routeInfo: RouteInfo | null;
  routeSteps: RouteStep[];        // maniobras para la navegación lite
  isNavigating: boolean;          // modo navegación a pantalla completa
  isVoluminousModalOpen: boolean;
  ecopuntos: EcoPunto[];
  isLoadingEcopuntos: boolean;
  errorEcopuntos: string | null;
  // Búsqueda por dirección + radio.
  searchResult: SearchResult | null;
  searchRadiusKm: RadiusKm;
  isGeocoding: boolean;
  geocodeError: string | null;
  // Derivado: ecopuntos visibles (filtrados por distancia). Vacío en splash.
  visibleEcopuntos: EcoPunto[];
}

export interface MapActions {
  selectPunto: (punto: EcoPunto | null) => void;
  traceRoute: () => void;
  startNavigation: () => void;
  stopNavigation: () => void;
  setVoluminousModalOpen: (open: boolean) => void;
  clearRoute: () => void;
  setSearch: (result: SearchResult) => void;
  setRadius: (km: RadiusKm) => void;
  clearSearch: () => void;
  setGeocoding: (loading: boolean) => void;
  setGeocodeError: (err: string | null) => void;
}

export interface MapContextValue {
  state: MapState;
  actions: MapActions;
}

export const MapContext = createContext<MapContextValue | null>(null);

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) throw new Error('useMapContext must be used within a MapProvider');
  return context;
};
