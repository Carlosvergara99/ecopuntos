// Manejador global de errores. Ojo: la firma DEBE tener (err, req, res, next)
// con los 4 args o Express no lo reconoce como error handler — aunque no uses
// `next`, déjalo ahí.

import { HttpError, fail } from '../utils/response.js';

export function errorHandler(err, req, res, next) {
  // 1) Errores nuestros lanzados con HttpError.
  if (err instanceof HttpError) {
    return fail(res, err.status, err.code, err.message, err.details);
  }

  // 2) JSON inválido del body parser de Express.
  if (err?.type === 'entity.parse.failed') {
    return fail(res, 400, 'INVALID_JSON', 'El cuerpo de la petición no es JSON válido.');
  }

  // 3) Cualquier otra cosa. FIXME: en algún momento mandar esto a un agregador
  // de logs en vez de console.error. Por ahora pasa derecho para la entrega.
  console.error('[errorHandler] Error no controlado:', err);
  return fail(res, 500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado en el servidor.');
}

// Express 4 no atrapa promesas rechazadas en handlers async — este wrapper
// las redirige a `next(err)` para que caigan en errorHandler. Tres líneas
// que nos ahorran un try/catch en cada controller.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
