// Acceso a la colección `ecopuntos` en MongoDB.
//
// En Mongo los `niveles` van EMBEBIDOS dentro de cada documento de ecopunto
// (no en una colección aparte), que es el estilo natural del modelo de
// documentos. Así una sola lectura trae el ecopunto con todos sus niveles.
//
// El `_id` de cada ecopunto es el id string ('1'..'12') que ya usaba el front.

import { collection } from '../db/mongo.js';

// Devuelve los ecopuntos con sus niveles (campos en español; el controller
// los traduce al inglés que espera el front). Ordenados por id numérico.
export async function listarTodos() {
  const ecopuntos = await collection('ecopuntos');
  const docs = await ecopuntos.find({}).toArray();
  return docs
    .map((eco) => ({
      id: eco._id,
      nombre: eco.nombre,
      direccion: eco.direccion,
      horario: eco.horario,
      lat: eco.lat,
      lng: eco.lng,
      niveles: eco.niveles ?? [],
    }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}
