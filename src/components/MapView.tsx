import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Map, Marker, Popup, Source, Layer, useMap, type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import EcoPuntoCard from './EcoPuntoCard';
import VoluminousWasteModal from './VoluminousWasteModal';
import MapSearchPanel from './MapSearchPanel';
import { MapPin, Navigation, Truck, X, LogOut, User as UserIcon, ClipboardList, Search } from 'lucide-react';
import { MapProvider } from './MapContext';
import { useMapContext } from './mapContextValue';
import { colorPorCapacidad } from '../data/ecopuntos';
import { circlePolygon, haversineKm, type LatLng } from '../lib/geo';
import IconButton from './ui/IconButton';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
// Centro de Bogotá para el zoom inicial del mapa en splash.
const BOGOTA_CENTER = { latitude: 4.65, longitude: -74.08 };

interface MapViewProps {
  onLogout?: () => void;
  user?: { name: string; email: string } | null;
}

// Círculo translúcido que muestra el área del radio de búsqueda alrededor de
// la dirección. Hace visible e intuitivo el filtro de distancia (1/3/5/10 km).
const RadiusCircle = () => {
  const { state: { searchResult, searchRadiusKm } } = useMapContext();
  const circle = useMemo(
    () =>
      searchResult
        ? circlePolygon({ lat: searchResult.lat, lng: searchResult.lng }, searchRadiusKm)
        : null,
    [searchResult, searchRadiusKm]
  );
  if (!circle) return null;
  return (
    <Source id="radio-source" type="geojson" data={circle}>
      <Layer id="radio-fill" type="fill" paint={{ 'fill-color': '#16a34a', 'fill-opacity': 0.08 }} />
      <Layer
        id="radio-line"
        type="line"
        paint={{ 'line-color': '#16a34a', 'line-width': 2, 'line-opacity': 0.4, 'line-dasharray': [2, 2] }}
      />
    </Source>
  );
};

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

// Origen de la ruta cuando no hay búsqueda (espeja el de MapContext).
const ROUTE_ORIGIN_FALLBACK = { lat: 4.6582, lng: -74.0939 };

// Encuadra el círculo del radio de búsqueda (área completa).
function fitRadius(
  map: MapRef,
  searchResult: { lat: number; lng: number },
  radiusKm: number,
  duration: number
) {
  const lat = searchResult.lat;
  const dx = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const dy = radiusKm / 110.574;
  map.fitBounds(
    [
      [searchResult.lng - dx, lat - dy],
      [searchResult.lng + dx, lat + dy],
    ],
    { padding: 60, duration, essential: true }
  );
}

// Controla la cámara del mapa con una prioridad clara, en un solo lugar:
//   1. Ruta activa  → encuadra origen + destino (con padding para la tarjeta).
//   2. Punto elegido → lo centra para que su tarjeta no se recorte.
//   3. Solo búsqueda → muestra TODO el radio (también al CERRAR la tarjeta, que
//      es justo lo que faltaba: antes quedaba acercado al último punto).
const MapCamera = () => {
  const {
    state: { selectedPunto, showRoute, searchResult, searchRadiusKm, isNavigating },
  } = useMapContext();
  const { current: map } = useMap();
  useEffect(() => {
    if (!map) return;
    // Durante la navegación, la cámara la controla NavController (sigue el GPS).
    if (isNavigating) return;

    if (showRoute && selectedPunto) {
      const origin = searchResult ?? ROUTE_ORIGIN_FALLBACK;
      map.fitBounds(
        [
          [Math.min(origin.lng, selectedPunto.lng), Math.min(origin.lat, selectedPunto.lat)],
          [Math.max(origin.lng, selectedPunto.lng), Math.max(origin.lat, selectedPunto.lat)],
        ],
        // Padding lateral amplio: la tarjeta (~360px) se abre sobre el destino,
        // así nunca queda pegada a un borde (Mapbox no recorta el popup).
        { padding: { top: 110, bottom: 110, left: 360, right: 360 }, duration: 1200, maxZoom: 16 }
      );
      return;
    }

    if (selectedPunto) {
      map.easeTo({ center: [selectedPunto.lng, selectedPunto.lat], duration: 600 });
      return;
    }

    if (searchResult) {
      fitRadius(map, searchResult, searchRadiusKm, 800);
    }
  }, [map, selectedPunto, showRoute, searchResult, searchRadiusKm, isNavigating]);
  return null;
};

// Navegación "lite": al activarse, sigue el GPS del usuario en vivo (recentra
// y se inclina como en un carro), muestra la próxima maniobra arriba y la
// distancia restante + tiempo abajo. No reemplaza una app nativa de navegación,
// pero da la experiencia básica de "ir guiando" desde el navegador.
const NavController = () => {
  const {
    state: { isNavigating, routeSteps, routeInfo },
    actions: { stopNavigation },
  } = useMapContext();
  const { current: map } = useMap();
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [navError, setNavError] = useState<string | null>(null);
  const stepIdxRef = useRef(0);

  useEffect(() => {
    // Si no hay soporte de geolocalización, el render muestra el aviso; aquí
    // simplemente no arrancamos el watch (evitamos setState dentro del effect).
    if (!isNavigating || !map || !('geolocation' in navigator)) return;
    stepIdxRef.current = 0;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const p: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(p);
        setNavError(null);
        // La cámara sigue al usuario, acercada e inclinada (vista "conduciendo").
        map.easeTo({ center: [p.lng, p.lat], zoom: 16.5, pitch: 55, duration: 700, essential: true });
        // Avanzamos de maniobra cuando nos acercamos (<35 m) a la actual.
        let i = stepIdxRef.current;
        while (
          i < routeSteps.length - 1 &&
          haversineKm(p, { lat: routeSteps[i].location[1], lng: routeSteps[i].location[0] }) < 0.035
        ) {
          i++;
        }
        stepIdxRef.current = i;
        setStepIdx(i);
      },
      () => setNavError('No pudimos acceder a tu ubicación. Activa el permiso del navegador.'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      // Al salir, devolvemos la cámara a vista plana.
      map.easeTo({ pitch: 0, duration: 500 });
    };
  }, [isNavigating, map, routeSteps]);

  if (!isNavigating) return null;

  const sinSoporte = !('geolocation' in navigator);
  const pasoActual = routeSteps[stepIdx];
  const restanteKm = routeSteps.slice(stepIdx).reduce((s, p) => s + p.distance, 0) / 1000;
  const totalKm = routeInfo?.distanceKm ?? restanteKm;
  const etaMin = routeInfo
    ? Math.max(1, Math.round(routeInfo.durationMin * (totalKm > 0 ? restanteKm / totalKm : 1)))
    : null;

  return (
    <>
      {/* Marcador de la posición del usuario en vivo. */}
      {userPos && (
        <Marker longitude={userPos.lng} latitude={userPos.lat} anchor="center">
          <div className="relative w-6 h-6 flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30" />
            <div className="relative w-5 h-5 bg-blue-600 rounded-full border-[3px] border-white shadow-lg" />
          </div>
        </Marker>
      )}

      {/* Banner superior: próxima maniobra. */}
      <div className="fixed top-0 left-0 right-0 z-[3000] bg-green-700 text-white px-5 py-5 shadow-xl flex items-center gap-4">
        <div className="bg-white/20 rounded-2xl p-2 flex-shrink-0">
          <Navigation className="w-7 h-7" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-black leading-snug">
            {sinSoporte
              ? 'Tu navegador no soporta geolocalización.'
              : (navError ?? (pasoActual?.instruction || 'Sigue la ruta hacia el ecopunto'))}
          </p>
          {pasoActual && !navError && !sinSoporte && (
            <p className="text-green-100 text-xs mt-0.5">en {Math.round(pasoActual.distance)} m</p>
          )}
        </div>
      </div>

      {/* Barra inferior: distancia restante + tiempo + salir. */}
      <div className="fixed bottom-0 left-0 right-0 z-[3000] bg-white px-5 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] flex items-center justify-between">
        <div>
          <p className="text-xl font-black text-gray-800">
            {restanteKm.toFixed(1)} km{etaMin ? ` · ~${etaMin} min` : ''}
          </p>
          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-bold">restante</p>
        </div>
        <button
          type="button"
          onClick={stopNavigation}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg"
        >
          <X className="w-5 h-5" />
          Salir
        </button>
      </div>
    </>
  );
};

// Solo se renderizan los ecopuntos del radio activo (visibleEcopuntos).
// En splash visibleEcopuntos está vacío → no se ve nada.
const EcoPuntoMarkers = () => {
  const {
    state: { visibleEcopuntos, selectedPunto },
    actions: { selectPunto },
  } = useMapContext();
  return (
    <>
      {visibleEcopuntos.map((punto) => {
        // Color según capacidad disponible (verde/ámbar/rojo).
        const color = colorPorCapacidad(punto);
        // El seleccionado se agranda y gana un anillo para destacarlo.
        const activo = selectedPunto?.id === punto.id;
        return (
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
            <div className={`group cursor-pointer transform transition-transform hover:scale-110 active:scale-95 ${activo ? 'scale-125 z-10' : ''}`}>
              <div
                className={`w-10 h-10 rounded-full border-4 border-white flex items-center justify-center shadow-lg transition-shadow ${activo ? 'ring-4 ring-white/70' : ''}`}
                style={{ backgroundColor: color }}
              >
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r-2 border-b-2 border-white"
                style={{ backgroundColor: color }}
              ></div>
            </div>
          </Marker>
        );
      })}
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
    state: { selectedPunto, isNavigating },
    actions: { selectPunto, traceRoute }
  } = useMapContext();

  if (!selectedPunto || isNavigating) return null;

  return (
    <Popup
      longitude={selectedPunto.lng}
      latitude={selectedPunto.lat}
      closeButton={false}
      closeOnClick={false}
      // Sin anchor fijo: Mapbox elige el lado con espacio y voltea la tarjeta
      // (arriba/abajo/lados) para que NUNCA se corte contra el borde del mapa.
      // Antes con anchor="bottom" se recortaba arriba si el marcador estaba alto.
      offset={20}
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
    state: { selectedPunto, isVoluminousModalOpen, showRoute, routeInfo, searchResult, isNavigating },
    actions: { setVoluminousModalOpen, clearRoute, startNavigation }
  } = useMapContext();

  // Durante la navegación, la UI la pone NavController (banner + barra). Aquí
  // ocultamos los overlays normales (header, buscador, FAB) para no estorbar.
  if (isNavigating) return null;

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
                icon={<ClipboardList className="w-4 h-4" />}
                onClick={() => { window.location.hash = '#/solicitudes'; }}
                variant="secondary"
                title="Mis solicitudes"
                aria-label="Mis solicitudes"
              />
              <IconButton
                icon={<LogOut className="w-4 h-4" />}
                onClick={onLogout}
                variant="danger"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              />
            </div>
          </div>
        )}

        {/* Panel de búsqueda (siempre visible salvo cuando hay un punto abierto). */}
        {!selectedPunto && <MapSearchPanel />}

        {showRoute && (
          <div className="self-center flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-2">
            {routeInfo && (
              <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold text-gray-700 shadow-lg flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-violet-600" />
                {routeInfo.distanceKm.toFixed(1)} km · ~{Math.max(1, Math.round(routeInfo.durationMin))} min en auto
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={startNavigation}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2"
              >
                <Navigation className="w-3.5 h-3.5" />
                Navegar
              </button>
              <button
                onClick={clearRoute}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar Ruta
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Estado vacío: invita a buscar cuando aún no hay dirección. */}
      {!selectedPunto && !searchResult && !isVoluminousModalOpen && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6 z-0">
          <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl border border-white/30 px-6 py-5 max-w-xs text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-12 h-12 mx-auto mb-3 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-sm font-black text-gray-800">¿Qué necesitas reciclar?</p>
            <p className="text-xs text-gray-500 mt-1">
              Busca tu dirección arriba para ver los ecopuntos más cercanos a ti.
            </p>
          </div>
        </div>
      )}

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
          <MapCamera />
          <NavController />
          <RadiusCircle />
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
