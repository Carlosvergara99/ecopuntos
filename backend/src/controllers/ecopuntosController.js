// GET /api/ecopuntos — sirve el catálogo que pinta el front en el mapa.
// Por ahora solo lectura; si después se pide crear/editar, agregar rutas
// protegidas con requireAuth + rol "admin".

import { ok } from '../utils/response.js';
import * as Ecopuntos from '../models/ecopuntosModel.js';

// El front usa campos en inglés (name, address, hours, wasteLevels[]).
// El model los tiene en español. Acá traducimos para no obligar al compa
// del front a renombrar nada. Renombrar columnas no rompe el contrato.
function aFormatoFrontend(eco) {
  return {
    id: eco.id,
    name: eco.nombre,
    address: eco.direccion,
    hours: eco.horario,
    lat: eco.lat,
    lng: eco.lng,
    wasteLevels: eco.niveles.map((n) => ({
      name: n.nombre,
      percentage: n.porcentaje,
      color: n.color,
    })),
  };
}

// No requiere auth — el mapa se ve también para anónimos (igual que en
// el frontend actual).
export async function listar(req, res) {
  const datos = await Ecopuntos.listarTodos();
  return ok(res, datos.map(aFormatoFrontend));
}
