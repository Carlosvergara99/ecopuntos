// Crea los índices en MongoDB. Idempotente: createIndex no falla si el índice
// ya existe. Reemplaza al antiguo esquema de SQLite (Mongo no necesita CREATE
// TABLE; las colecciones se crean solas al insertar).
//
// Uso directo: npm run db:migrate. También lo invoca db:reset.

import { connectMongo, collection, closeMongo } from './mongo.js';

// Colación case-insensitive para el email (Henry@x == henry@x).
const EMAIL_COLLATION = { locale: 'es', strength: 2 };

export async function migrate() {
  await connectMongo();

  const usuarios = await collection('usuarios');
  await usuarios.createIndex({ id: 1 }, { unique: true });
  await usuarios.createIndex(
    { email: 1 },
    { unique: true, collation: EMAIL_COLLATION }
  );
  // google_sub único PARCIAL: solo aplica cuando es string, así muchos
  // usuarios sin Google (google_sub null) no chocan entre sí.
  await usuarios.createIndex(
    { google_sub: 1 },
    { unique: true, partialFilterExpression: { google_sub: { $type: 'string' } } }
  );

  const solicitudes = await collection('solicitudes');
  await solicitudes.createIndex({ id: 1 }, { unique: true });
  await solicitudes.createIndex({ usuario_id: 1 });

  console.log('[migrate] Índices creados en MongoDB.');
}

// Ejecutar solo si se corre directamente (no al ser importado por reset.js).
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  migrate()
    .then(closeMongo)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('[migrate] Error:', e.message);
      process.exit(1);
    });
}
