// Acceso a la colección `usuarios` en MongoDB. Acá vive TODO el acceso a
// datos de usuarios — los controllers no arman queries a mano.
//
// IDs: conservamos `id` ENTERO (autoincremental vía la colección `counters`)
// para no romper el contrato JSON ni el JWT (sub = usuario.id). El `_id` de
// Mongo existe pero no se expone.

import { collection, nextId } from '../db/mongo.js';

// Colación para comparar emails sin distinguir mayúsculas (Henry@x == henry@x),
// equivalente al COLLATE NOCASE que usábamos en SQLite. El índice único de
// email se crea con esta misma colación en migrate.js.
const EMAIL_COLLATION = { locale: 'es', strength: 2 };

// Marca de tiempo estilo SQLite ('YYYY-MM-DD HH:MM:SS', UTC).
function ahora() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// Proyección segura (sin password_hash) → se puede serializar al cliente.
function aPublico(doc) {
  if (!doc) return undefined;
  return { id: doc.id, nombre: doc.nombre, email: doc.email, creado_en: doc.creado_en };
}

// Trae el usuario CON password_hash — SOLO para verificar el login.
// Ojo: NUNCA devolver esto tal cual al cliente, filtrar antes.
export async function buscarPorEmail(email) {
  const usuarios = await collection('usuarios');
  const doc = await usuarios.findOne({ email }, { collation: EMAIL_COLLATION });
  if (!doc) return undefined;
  return {
    id: doc.id,
    nombre: doc.nombre,
    email: doc.email,
    password_hash: doc.password_hash ?? null,
    creado_en: doc.creado_en,
  };
}

// Versión segura: NO trae password_hash.
export async function buscarPorId(id) {
  const usuarios = await collection('usuarios');
  return aPublico(await usuarios.findOne({ id }));
}

// Inserta y devuelve el registro creado (sin hash).
// Si el email ya existe, el índice único de Mongo tira un error con
// code === 11000 — lo traduce el controller a HTTP 409.
export async function crear({ nombre, email, password_hash }) {
  const usuarios = await collection('usuarios');
  const id = await nextId('usuarios');
  await usuarios.insertOne({
    id,
    nombre,
    email,
    password_hash,
    google_sub: null,
    creado_en: ahora(),
  });
  return buscarPorId(id);
}

// ── Soporte Google OAuth ───────────────────────────────────────────────

export async function buscarPorGoogleSub(google_sub) {
  const usuarios = await collection('usuarios');
  return aPublico(await usuarios.findOne({ google_sub }));
}

// Asocia un google_sub a un usuario existente (creado con email+password).
export async function linkearGoogle(id, google_sub) {
  const usuarios = await collection('usuarios');
  await usuarios.updateOne({ id }, { $set: { google_sub } });
}

// Crea usuario sin password (solo Google). password_hash queda null.
export async function crearConGoogle({ nombre, email, google_sub }) {
  const usuarios = await collection('usuarios');
  const id = await nextId('usuarios');
  await usuarios.insertOne({
    id,
    nombre,
    email,
    password_hash: null,
    google_sub,
    creado_en: ahora(),
  });
  return buscarPorId(id);
}
