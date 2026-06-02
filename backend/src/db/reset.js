// Reinicia la base en MongoDB: vacía las colecciones y reaplica índices + seed.
// Útil cuando los datos quedaron raros o para empezar de cero.
//
// Ojo: ESTO BORRA TODOS LOS DATOS de la base. No usar en producción.

import { connectMongo, closeMongo } from './mongo.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';

async function main() {
  const db = await connectMongo();

  for (const nombre of ['usuarios', 'ecopuntos', 'solicitudes', 'counters']) {
    const res = await db.collection(nombre).deleteMany({});
    console.log(`[reset] ${nombre}: ${res.deletedCount} docs borrados.`);
  }

  await migrate();
  await seed();
  await closeMongo();
  console.log('[reset] Base reiniciada y poblada con datos iniciales.');
  process.exit(0);
}

main().catch((e) => {
  console.error('[reset] Error:', e.message);
  process.exit(1);
});
