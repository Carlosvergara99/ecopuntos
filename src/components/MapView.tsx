import React from 'react';
import { Map, Marker, Popup, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ECO_PUNTOS } from '../data/ecopuntos';
import EcoPuntoCard from './EcoPuntoCard';
import VoluminousWasteModal from './VoluminousWasteModal';
import { MapPin, Navigation, Truck, X, LogOut, User as UserIcon } from 'lucide-react';
import { MapProvider, useMapContext } from './MapContext';
import IconButton from './ui/IconButton';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const USER_LOCATION = { latitude: 4.6582, longitude: -74.0939 };

interface MapViewProps {
  onLogout?: () => void;
  user?: { name: string; email: string } | null;
}

// --- Sub-components (Compound Components) ---

const UserMarker = () => (
  <Marker longitude={USER_LOCATION.longitude} latitude={USER_LOCATION.latitude} anchor="center">
    <div className="relative w-10 h-10 flex items-center justify-center">
      <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
      <div className="relative w-8 h-8 bg-blue-600 rounded-full border-4 border-white flex items-center justify-center shadow-xl">
        <Navigation className="w-4 h-4 text-white fill-current rotate-[225deg]" />
      </div>
    </div>
  </Marker>
);

const EcoPuntoMarkers = () => {
  const { actions: { selectPunto } } = useMapContext();
  return (
    <>
      {ECO_PUNTOS.map((punto) => (
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
      {/* Floating Header & Route Controls */}
      <div className="absolute top-6 left-6 right-6 z-10 flex flex-col gap-3">
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
              <div className="hidden sm:flex flex-col items-end mr-4 pr-4 border-r border-gray-200">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Ubicación</p>
                <p className="text-xs font-bold text-gray-500">Bogotá, CO</p>
              </div>
              <IconButton
                icon={<LogOut className="w-4 h-4" />}
                onClick={onLogout}
                variant="danger"
              />
            </div>
          </div>
        )}

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

      {/* Modal Registration */}
      {isVoluminousModalOpen && (
        <VoluminousWasteModal onClose={() => setVoluminousModalOpen(false)} />
      )}
    </>
  );
};

// --- Main View ---

const MapView: React.FC<MapViewProps> = (props) => {
  return (
    <MapProvider>
      <div className="relative w-full h-screen overflow-hidden">
        <Map
          initialViewState={{
            longitude: USER_LOCATION.longitude,
            latitude: USER_LOCATION.latitude,
            zoom: 13
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
        >
          <UserMarker />
          <EcoPuntoMarkers />
          <RouteLayer />
          <EcoPuntoPopup />

          <MapContextConsumer />
        </Map>

        <MapOverlays {...props} />

        {/* Token Alert */}
        {!MAPBOX_TOKEN && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg animate-bounce">
            Falta VITE_MAPBOX_TOKEN en el archivo .env
          </div>
        )}
      </div>
    </MapProvider>
  );
};

// Internal component to handle "You are here" Popup which needs context
const MapContextConsumer = () => {
  const { state: { selectedPunto } } = useMapContext();
  if (selectedPunto) return null;
  return (
    <Popup
      longitude={USER_LOCATION.longitude}
      latitude={USER_LOCATION.latitude}
      closeButton={false}
      closeOnClick={false}
      anchor="bottom"
      offset={25}
    >
      <div className="px-2 py-1 font-bold text-blue-600 text-xs">¡Estás aquí!</div>
    </Popup>
  );
};

export default MapView;
