// Conexión a MongoDB Atlas. Singleton: una sola instancia de MongoClient para
// toda la app (el driver maneja su propio pool de conexiones internamente).
//
// Si MONGODB_URI no está configurado, queda en modo no-op: el backend sigue
// funcionando con SQLite y no intenta conectar. Así nadie se queda sin arrancar
// por no tener Atlas a mano.

import { MongoClient } from 'mongodb';
import { config } from '../config.js';

let client = null;
let db = null;

// Conecta (idempotente) y hace un ping para confirmar credenciales/IP.
// Devuelve la Db, o null si MONGODB_URI no está configurado.
export async function connectMongo() {
  if (!config.mongoUri) {
    console.warn('[mongo] MONGODB_URI no configurado — conexión a Atlas desactivada.');
    return null;
  }
  if (db) return db;

  client = new MongoClient(config.mongoUri, {
    // Si la IP no está en la lista de acceso o las credenciales fallan,
    // que reviente rápido en vez de colgarse esperando.
    serverSelectionTimeoutMS: 8000,
  });
  await client.connect();
  // ping al comando admin: valida de verdad que la conexión funciona.
  await client.db('admin').command({ ping: 1 });

  db = client.db(config.mongoDbName || undefined);
  console.log(`[mongo] Conectado a Atlas (db: ${db.databaseName}).`);
  return db;
}

// Acceso a la Db ya conectada (null si aún no se conectó / no configurado).
export function getMongoDb() {
  return db;
}

// Helper para los modelos: garantiza la conexión y devuelve la colección.
// Como connectMongo es idempotente, llamar esto en cada query es barato.
export async function collection(name) {
  const database = await connectMongo();
  if (!database) {
    throw new Error('MongoDB no está configurado (revisa MONGODB_URI).');
  }
  return database.collection(name);
}

// IDs autoincrementales (patrón clásico de Mongo con una colección `counters`).
// Conservamos así los IDs enteros que ya usaban usuarios y solicitudes en SQLite,
// para no romper el contrato JSON ni el frontend.
export async function nextId(nombreSecuencia) {
  const counters = await collection('counters');
  const doc = await counters.findOneAndUpdate(
    { _id: nombreSecuencia },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return doc.seq;
}

// Cierre limpio (lo llama el shutdown del server).
export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[mongo] Conexión a Atlas cerrada.');
  }
}
