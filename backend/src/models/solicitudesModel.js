// Acceso a la colección `solicitudes` en MongoDB. Cada documento pertenece a
// un usuario (usuario_id), así que las queries SIEMPRE filtran por usuario_id
// — ningún usuario debería ver/tocar las solicitudes de otro.
//
// `id` es ENTERO autoincremental (vía counters), igual que antes en SQLite,
// para que el frontend y la validación de :id (parseId) sigan funcionando.

import { collection, nextId } from '../db/mongo.js';

function ahora() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// Quita el _id de Mongo del objeto devuelto (el contrato usa `id`).
function limpiar(doc) {
  if (!doc) return doc;
  const { _id, ...resto } = doc;
  void _id;
  return resto;
}

export async function crear(datos) {
  const solicitudes = await collection('solicitudes');
  const id = await nextId('solicitudes');
  const doc = {
    id,
    usuario_id: datos.usuario_id,
    tipo: datos.tipo,
    descripcion: datos.descripcion,
    direccion: datos.direccion,
    fecha: datos.fecha,
    nombre_foto: datos.nombre_foto ?? null,
    foto_data: datos.foto_data ?? null,
    solicitante_nombre: datos.solicitante_nombre,
    solicitante_telefono: datos.solicitante_telefono,
    estado: 'pendiente',
    creado_en: ahora(),
  };
  await solicitudes.insertOne(doc);
  return limpiar(doc);
}

export async function listarPorUsuario(usuario_id) {
  const solicitudes = await collection('solicitudes');
  const docs = await solicitudes
    .find({ usuario_id })
    .sort({ creado_en: -1, id: -1 })
    .toArray();
  return docs.map(limpiar);
}

// Cambia el estado a 'cancelada'. Devuelve la fila actualizada, o null si no
// existe / no es del usuario / ya estaba completada.
export async function cancelar(id, usuario_id) {
  const solicitudes = await collection('solicitudes');
  const res = await solicitudes.findOneAndUpdate(
    { id, usuario_id, estado: { $ne: 'completada' } },
    { $set: { estado: 'cancelada' } },
    { returnDocument: 'after' }
  );
  return res ? limpiar(res) : null;
}

// Borra definitivamente. Devuelve true si borró algo (era del usuario).
export async function eliminar(id, usuario_id) {
  const solicitudes = await collection('solicitudes');
  const res = await solicitudes.deleteOne({ id, usuario_id });
  return res.deletedCount > 0;
}
