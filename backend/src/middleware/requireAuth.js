// Verifica el JWT del header Authorization: Bearer <token>.
// Si pasa, deja al usuario en req.usuario para los controllers.
//
// Nota: JWT es stateless — no guardamos sesiones en el server. Ventaja:
// escala fácil. Desventaja: no se puede "invalidar" un token antes de su
// expiración sin armar una blacklist, así que usamos expiración corta (2h).

import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../utils/response.js';

export function requireAuth(req, res, next) {
  const header = req.get('Authorization') ?? '';

  // Esperamos exactamente "Bearer <token>" (RFC 6750).
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'NO_TOKEN', 'Falta el header Authorization: Bearer <token>.'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.usuario = {
      id: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
    };
    return next();
  } catch (err) {
    // jsonwebtoken distingue el tipo de fallo por err.name.
    if (err.name === 'TokenExpiredError') {
      return next(new HttpError(401, 'TOKEN_EXPIRED', 'El token expiró. Vuelve a iniciar sesión.'));
    }
    return next(new HttpError(401, 'INVALID_TOKEN', 'Token inválido o malformado.'));
  }
}
