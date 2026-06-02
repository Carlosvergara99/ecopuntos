// Construye la app Express. La arrancamos en server.js — partirlos
// nos sirve para testear con supertest sin levantar puerto real.

import express from 'express';
import cors from 'cors';

import { config } from './config.js';
import { ok } from './utils/response.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import ecopuntosRoutes from './routes/ecopuntosRoutes.js';
import solicitudesRoutes from './routes/solicitudesRoutes.js';

export function buildApp() {
  const app = express();

  // Ojo: el orden de los middlewares importa. CORS primero, body parser
  // después, rutas, y al final notFound + errorHandler. Si mueves esto
  // se rompe el front (CORS) o los errores dejan de devolver JSON.

  // CORS solo para el dev-server de Vite. Para producción ampliar la
  // lista en config.corsOrigin.
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );

  // Body parser. 6MB para dar cabida al data URL base64 de la foto de la
  // solicitud (el cliente la comprime antes, pero base64 infla ~33%).
  app.use(express.json({ limit: '6mb' }));

  // Healthcheck para que el front confirme conectividad antes de mostrar
  // pantallas de error feas frente al profe.
  app.get('/api/health', (req, res) => {
    return ok(res, {
      service: 'ecopuntos-backend',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Rutas. Un router por recurso para que app.js no se vuelva un monstruo.
  app.use('/api/auth', authRoutes);
  app.use('/api/ecopuntos', ecopuntosRoutes);
  app.use('/api/solicitudes', solicitudesRoutes);

  // Ojo: estos dos van SIEMPRE al final. Si los pones antes de las rutas
  // todo cae al 404.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
