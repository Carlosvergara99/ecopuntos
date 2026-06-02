// Tipos compartidos del dominio "ecopunto". El catálogo real lo sirve el
// backend en GET /api/ecopuntos; este archivo solo conserva las interfaces
// que consumen los componentes del mapa.

export interface WasteLevel {
  name: string;
  percentage: number;
  color: string;
}

export interface EcoPunto {
  id: string;
  name: string;
  address: string;
  hours: string;
  lat: number;
  lng: number;
  wasteLevels: WasteLevel[];
}

// Nivel de llenado de un ecopunto = el mayor porcentaje entre sus residuos.
// A mayor llenado, menos capacidad disponible.
export function nivelLlenado(p: EcoPunto): number {
  return p.wasteLevels.reduce((max, w) => Math.max(max, w.percentage), 0);
}

// Color del marcador según capacidad: verde (con cupo), ámbar (medio),
// rojo (casi lleno). Umbrales 50/80.
export function colorPorCapacidad(p: EcoPunto): string {
  const n = nivelLlenado(p);
  if (n > 80) return '#ef4444';
  if (n > 50) return '#f59e0b';
  return '#22c55e';
}
