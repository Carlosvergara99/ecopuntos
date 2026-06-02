// Cuando ninguna ruta matchea, Express por defecto devuelve HTML ("Cannot
// GET /xxx"). Eso rompe el contrato JSON, así que lo atrapamos acá.
// Va montado DESPUÉS de todas las rutas en app.js.

import { fail } from '../utils/response.js';

export function notFound(req, res) {
  return fail(
    res,
    404,
    'NOT_FOUND',
    `La ruta ${req.method} ${req.originalUrl} no existe.`
  );
}
