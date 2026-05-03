import React, { createContext, useContext, useState, useEffect } from 'react';
import type { EcoPunto } from '../data/ecopuntos';

interface MapState {
  selectedPunto: EcoPunto | null;
  showRoute: boolean;
  routeData: any;
  isVoluminousModalOpen: boolean;
}

interface MapActions {
  selectPunto: (punto: EcoPunto | null) => void;
  traceRoute: () => void;
  setVoluminousModalOpen: (open: boolean) => void;
  clearRoute: () => void;
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
const USER_LOCATION = { latitude: 4.6582, longitude: -74.0939 };

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedPunto, setSelectedPunto] = useState<EcoPunto | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);
  const [isVoluminousModalOpen, setIsVoluminousModalOpen] = useState(false);

  const selectPunto = (punto: EcoPunto | null) => {
    setSelectedPunto(punto);
    // Only clear route if we are selecting a NEW point, 
    // not when we are just closing the current one.
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

  useEffect(() => {
    if (showRoute && selectedPunto) {
      const getRoute = async () => {
        try {
          const query = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${USER_LOCATION.longitude},${USER_LOCATION.latitude};${selectedPunto.lng},${selectedPunto.lat}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`
          );
          const json = await query.json();
          if (json.routes?.[0]) {
            setRouteData({
              type: 'Feature',
              properties: {},
              geometry: json.routes[0].geometry
            });
          }
        } catch (error) {
          console.error("Error fetching route:", error);
        }
      };
      getRoute();
    }
  }, [showRoute, selectedPunto]);

  const value = {
    state: {
      selectedPunto,
      showRoute,
      routeData,
      isVoluminousModalOpen
    },
    actions: {
      selectPunto,
      traceRoute,
      setVoluminousModalOpen: setIsVoluminousModalOpen,
      clearRoute
    }
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};
