import React, { useState, useEffect, useMemo } from 'react';
import type { EcoPunto } from '../data/ecopuntos';
import { api } from '../lib/api';
import { haversineKm, type LatLng } from '../lib/geo';
import {
  MapContext,
  type SearchResult,
  type RadiusKm,
  type RouteInfo,
  type RouteGeoJSON,
  type RouteStep,
  type MapContextValue,
} from './mapContextValue';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const FALLBACK_ORIGIN: LatLng = { lat: 4.6582, lng: -74.0939 };

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedPunto, setSelectedPunto] = useState<EcoPunto | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [routeData, setRouteData] = useState<RouteGeoJSON | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
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
    // Al cerrar la tarjeta (punto null) o al cambiar de ecopunto, descartamos
    // la ruta para que no quede el botón "Limpiar Ruta" huérfano flotando.
    if (!punto || punto.id !== selectedPunto?.id) {
      setShowRoute(false);
      setRouteData(null);
      setRouteInfo(null);
      setRouteSteps([]);
      setIsNavigating(false);
    }
  };

  const traceRoute = () => setShowRoute(true);
  const startNavigation = () => setIsNavigating(true);
  const stopNavigation = () => setIsNavigating(false);
  const clearRoute = () => {
    setShowRoute(false);
    setRouteData(null);
    setRouteInfo(null);
    setRouteSteps([]);
    setIsNavigating(false);
  };

  const setSearch = (result: SearchResult) => {
    setSearchResult(result);
    setGeocodeError(null);
    // Al cambiar de dirección, descartamos la ruta anterior (sale de otro origen).
    setShowRoute(false);
    setRouteData(null);
    setRouteInfo(null);
    setRouteSteps([]);
    setIsNavigating(false);
  };

  const setRadius = (km: RadiusKm) => setSearchRadiusKm(km);

  const clearSearch = () => {
    setSearchResult(null);
    setGeocodeError(null);
    setSelectedPunto(null);
    setShowRoute(false);
    setRouteData(null);
    setRouteInfo(null);
    setRouteSteps([]);
    setIsNavigating(false);
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
            `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${selectedPunto.lng},${selectedPunto.lat}?steps=true&geometries=geojson&language=es&access_token=${MAPBOX_TOKEN}`
          );
          const json = await query.json();
          if (json.routes?.[0]) {
            const r = json.routes[0];
            setRouteData({
              type: 'Feature',
              properties: {},
              geometry: r.geometry,
            });
            // Mapbox devuelve metros y segundos; los guardamos en km y minutos.
            setRouteInfo({ distanceKm: r.distance / 1000, durationMin: r.duration / 60 });
            // Pasos (maniobras) para la navegación lite — instrucciones en español.
            const pasos: RouteStep[] = (r.legs?.[0]?.steps ?? []).map((s: {
              distance: number;
              maneuver?: { instruction?: string; location?: [number, number] };
            }) => ({
              distance: s.distance,
              instruction: s.maneuver?.instruction ?? '',
              location: s.maneuver?.location ?? [selectedPunto.lng, selectedPunto.lat],
            }));
            setRouteSteps(pasos);
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
      routeInfo,
      routeSteps,
      isNavigating,
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
      startNavigation,
      stopNavigation,
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
