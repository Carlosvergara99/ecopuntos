// Punto de entrada. Solo construye la app y la pone a escuchar.
// Cualquier lógica de negocio NO va acá.

import { buildApp } from './app.js';
import { config } from './config.js';
import { connectMongo, closeMongo } from './db/mongo.js';

const app = buildApp();

const server = app.listen(config.port, () => {
  console.log(`[ecopuntos-backend] Escuchando en http://localhost:${config.port}`);
  console.log(`[ecopuntos-backend] CORS permitido para: ${config.corsOrigin}`);
});

// Conectamos a Mongo Atlas en segundo plano. Si falla (IP no autorizada,
// credenciales, sin URI), logueamos y seguimos: el backend funciona con SQLite.
connectMongo().catch((err) => {
  console.error('[mongo] No se pudo conectar a Atlas:', err.message);
});

// Shutdown limpio: si llega SIGINT (Ctrl+C) o SIGTERM, cerramos las
// conexiones en vuelo antes de salir. Sin esto, el cliente ve ECONNRESET.
function shutdown(signal) {
  console.log(`\n[ecopuntos-backend] Señal ${signal} recibida. Cerrando servidor...`);
  server.close(async () => {
    await closeMongo();
    console.log('[ecopuntos-backend] Servidor cerrado. Adiós.');
    process.exit(0);
  });

  // Si en 10s no cierra, lo forzamos. Mejor que quedar colgado.
  setTimeout(() => {
    console.warn('[ecopuntos-backend] Timeout al cerrar. Forzando exit.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
