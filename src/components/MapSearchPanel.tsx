import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Search, X, MapPin, LocateFixed } from 'lucide-react';
import { useMapContext, type RadiusKm } from './mapContextValue';
import { suggestPlaces, retrieveSuggestion, detectMyLocation, debounce, haversineKm, type Suggestion } from '../lib/geo';
import { colorPorCapacidad } from '../data/ecopuntos';

const RADIOS: RadiusKm[] = [1, 3, 5, 10];

const MapSearchPanel: React.FC = () => {
  const {
    state: {
      searchResult,
      searchRadiusKm,
      isGeocoding,
      geocodeError,
      visibleEcopuntos,
      selectedPunto,
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

  // Session token de Mapbox Search Box. Una sesion = todas las llamadas de
  // suggest mientras el usuario tipea + el retrieve cuando elige una. Mapbox
  // factura todo eso como una sola "search session". El UUID persiste con
  // useRef para que sobreviva renders.
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  // Funcion debounced que llama a /suggest al cambiar el texto. El token de
  // sesion se pasa como argumento (no se lee el ref aqui dentro) para no
  // acceder al ref durante el render.
  const runSuggest = useMemo(
    () =>
      debounce(async (text: string, token: string) => {
        if (text.trim().length < 3) {
          setSuggestions([]);
          setGeocoding(false);
          return;
        }
        try {
          const results = await suggestPlaces(text, token);
          setSuggestions(results);
          setGeocodeError(null);
        } catch (err) {
          setGeocodeError(err instanceof Error ? err.message : 'Error en búsqueda.');
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
      // Leemos el ref aqui (event handler, no render) y lo pasamos.
      runSuggest(value, sessionTokenRef.current);
    } else {
      setSuggestions([]);
      setGeocoding(false);
    }
  };

  // Click en una sugerencia: hacer retrieve para obtener coords reales,
  // luego setSearch con esos datos. Si retrieve falla, mostrar error.
  const handlePick = useCallback(
    async (s: Suggestion) => {
      setIsOpen(false);
      setGeocoding(true);
      try {
        const place = await retrieveSuggestion(s.mapboxId, sessionTokenRef.current);
        const labelMostrado = s.placeFormatted ? `${s.name}, ${s.placeFormatted}` : s.name;
        setSearch({ query: labelMostrado, lat: place.lat, lng: place.lng });
        setQuery(labelMostrado);
        setSuggestions([]);
        // Nuevo session token para la proxima busqueda (Mapbox best practice).
        sessionTokenRef.current = crypto.randomUUID();
      } catch (err) {
        setGeocodeError(err instanceof Error ? err.message : 'No pude obtener las coordenadas.');
      } finally {
        setGeocoding(false);
      }
    },
    [setSearch, setGeocoding, setGeocodeError]
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
    sessionTokenRef.current = crypto.randomUUID();
  };

  // "Usar mi ubicación": geolocaliza el navegador, convierte a dirección y la
  // usa como búsqueda activa (igual que elegir una sugerencia). Reusa el
  // spinner isGeocoding y el render de error del panel.
  const handleUseMyLocation = useCallback(async () => {
    setIsOpen(false);
    setGeocoding(true);
    setGeocodeError(null);
    try {
      const place = await detectMyLocation();
      setSearch({ query: place.name, lat: place.lat, lng: place.lng });
      setQuery(place.name);
      setSuggestions([]);
      sessionTokenRef.current = crypto.randomUUID();
    } catch (err) {
      setGeocodeError(err instanceof Error ? err.message : 'No pudimos obtener tu ubicación.');
    } finally {
      setGeocoding(false);
    }
  }, [setSearch, setGeocoding, setGeocodeError]);

  // Ecopuntos visibles ordenados por distancia (el primero es el más cercano).
  const ordenados = useMemo(() => {
    if (!searchResult) return [];
    const origen = { lat: searchResult.lat, lng: searchResult.lng };
    return visibleEcopuntos
      .map((p) => ({ punto: p, km: haversineKm(origen, { lat: p.lat, lng: p.lng }) }))
      .sort((a, b) => a.km - b.km);
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
          placeholder="Busca una dirección o lugar"
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
                Sin resultados. Intenta otra búsqueda.
              </div>
            ) : (
              suggestions.map((s) => (
                <button
                  type="button"
                  key={s.mapboxId}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePick(s)}
                  className="w-full flex items-start gap-2 px-4 py-2.5 text-left hover:bg-green-50"
                >
                  <MapPin className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{s.name}</div>
                    {s.placeFormatted && (
                      <div className="text-[11px] text-gray-500 truncate">{s.placeFormatted}</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Botón de geolocalización */}
      <button
        type="button"
        onClick={handleUseMyLocation}
        disabled={isGeocoding}
        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 disabled:opacity-50"
      >
        <LocateFixed className="w-4 h-4" />
        Usar mi ubicación
      </button>

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

      {/* Leyenda de capacidad de los marcadores (solo con búsqueda activa). */}
      {searchResult && (
        <div className="mt-3 flex items-center gap-3 text-[10px] font-semibold text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Con cupo
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Medio
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Casi lleno
          </span>
        </div>
      )}

      {/* Resumen + lista de ecopuntos cercanos (ordenados por distancia). */}
      {searchResult && (
        <div className="mt-3 text-xs text-gray-600">
          {ordenados.length === 0 ? (
            <p className="font-semibold text-amber-700">
              Sin ecopuntos en {searchRadiusKm} km. Prueba un radio mayor.
            </p>
          ) : (
            <>
              <p className="font-semibold text-gray-700 mb-2">
                {ordenados.length} ecopunto{ordenados.length === 1 ? '' : 's'} en {searchRadiusKm} km
              </p>
              <div className="max-h-44 overflow-y-auto space-y-1 pr-1 -mr-1">
                {ordenados.map(({ punto, km }) => (
                  <button
                    type="button"
                    key={punto.id}
                    onClick={() => selectPunto(punto)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left transition-colors ${
                      selectedPunto?.id === punto.id ? 'bg-green-100' : 'hover:bg-green-50'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: colorPorCapacidad(punto) }}
                      title="Capacidad disponible"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-gray-800 truncate">{punto.name}</span>
                      <span className="block text-[11px] text-gray-400 truncate">{punto.address}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-gray-500 shrink-0">{km.toFixed(1)} km</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MapSearchPanel;
