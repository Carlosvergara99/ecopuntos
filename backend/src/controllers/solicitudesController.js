// Solicitudes de recolección. Todas las rutas están protegidas con
// requireAuth — un usuario solo crea y ve LO SUYO.
//
// Contrato del body (desde VoluminousWasteModal.tsx):
//   { type, description, address, date (YYYY-MM-DD), photoName?,
//     solicitanteNombre, solicitanteTelefono }
// solicitanteNombre y solicitanteTelefono son los datos de contacto que
// llena el usuario en el modal — pueden ser distintos al de la cuenta
// (ej. agendar recoleccion en casa de un familiar).

import { ok, HttpError } from '../utils/response.js';
import * as Solicitudes from '../models/solicitudesModel.js';
import * as mailer from '../services/mailer.js';
import { solicitudConfirmEmail } from '../services/templates.js';

const TIPOS_VALIDOS = new Set(['muebles', 'colchones', 'escombros', 'otros']);
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Tope del data URL de la foto. El cliente ya la comprime (~100-400 KB), pero
// validamos por si acaso. ~6M chars de base64 ≈ 4.5 MB de imagen.
const FOTO_MAX_CHARS = 6_000_000;

// Verifica que el string sea una fecha REAL, no solo bien formateada.
// new Date('2026-13-99') no falla — lo normaliza calladito. Truco: parsear
// y exigir que el round-trip a YYYY-MM-DD coincida con la entrada.
function esFechaCalendaricaValida(str) {
  if (!FECHA_REGEX.test(str)) return false;
  const d = new Date(`${str}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === str;
}

// Hoy o futura. Comparación lexicográfica de YYYY-MM-DD funciona (formato
// ordenable). Comparamos contra hoy UTC para no liarla con zonas horarias.
function esFechaHoyOFutura(str) {
  const hoyUtc = new Date().toISOString().slice(0, 10);
  return str >= hoyUtc;
}

// Teléfono: aceptamos digitos + espacios + guiones + parentesis + plus.
// Despues de quitar todo lo que no sea digito, exigimos minimo 7 (un fijo
// local) — un movil colombiano tiene 10, internacional puede ir mas.
function digitosTelefono(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\D/g, '');
}

function validarCrear(body) {
  const errores = {};
  if (!TIPOS_VALIDOS.has(body?.type)) {
    errores.type = `Debe ser uno de: ${[...TIPOS_VALIDOS].join(', ')}.`;
  }
  if (typeof body?.description !== 'string' || body.description.trim().length < 5) {
    errores.description = 'Debe tener al menos 5 caracteres.';
  }
  if (typeof body?.address !== 'string' || body.address.trim().length < 5) {
    errores.address = 'Debe tener al menos 5 caracteres.';
  }
  if (typeof body?.date !== 'string' || !esFechaCalendaricaValida(body.date)) {
    errores.date = 'Debe ser una fecha real en formato YYYY-MM-DD.';
  } else if (!esFechaHoyOFutura(body.date)) {
    errores.date = 'La fecha no puede ser pasada.';
  }
  if (typeof body?.solicitanteNombre !== 'string' || body.solicitanteNombre.trim().length < 2) {
    errores.solicitanteNombre = 'Debe tener al menos 2 caracteres.';
  }
  if (digitosTelefono(body?.solicitanteTelefono).length < 7) {
    errores.solicitanteTelefono = 'Debe tener al menos 7 dígitos.';
  }
  // photoData es opcional. Si viene, debe ser un data URL de imagen y no
  // pasarse del tope.
  if (body?.photoData !== undefined && body?.photoData !== null && body?.photoData !== '') {
    if (typeof body.photoData !== 'string' || !body.photoData.startsWith('data:image/')) {
      errores.photoData = 'La foto debe ser una imagen válida.';
    } else if (body.photoData.length > FOTO_MAX_CHARS) {
      errores.photoData = 'La foto es demasiado grande.';
    }
  }
  if (Object.keys(errores).length > 0) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Datos inválidos.', errores);
  }
}

function aFormatoFrontend(s) {
  return {
    id: s.id,
    type: s.tipo,
    description: s.descripcion,
    address: s.direccion,
    date: s.fecha,
    photoName: s.nombre_foto,
    photoData: s.foto_data,
    solicitanteNombre: s.solicitante_nombre,
    solicitanteTelefono: s.solicitante_telefono,
    status: s.estado,
    createdAt: s.creado_en,
  };
}

// POST /api/solicitudes
// Ojo: usuario_id se saca del JWT (req.usuario), NUNCA del body. Si lo
// aceptáramos del body, cualquiera podría crear solicitudes a nombre de otro.
export async function crear(req, res) {
  validarCrear(req.body);

  const fila = await Solicitudes.crear({
    usuario_id: req.usuario.id,
    tipo: req.body.type,
    descripcion: req.body.description.trim(),
    direccion: req.body.address.trim(),
    fecha: req.body.date,
    nombre_foto: req.body.photoName ?? null,
    foto_data: req.body.photoData ?? null,
    solicitante_nombre: req.body.solicitanteNombre.trim(),
    solicitante_telefono: req.body.solicitanteTelefono.trim(),
  });

  // Email de confirmacion fire-and-forget al usuario autenticado.
  mailer.send({
    to: req.usuario.email,
    subject: 'Tu solicitud de recolección fue registrada',
    ...solicitudConfirmEmail({
      nombre: req.usuario.nombre,
      type: fila.tipo,
      description: fila.descripcion,
      address: fila.direccion,
      date: fila.fecha,
      solicitanteNombre: fila.solicitante_nombre,
      solicitanteTelefono: fila.solicitante_telefono,
    }),
  });

  return ok(res, { solicitud: aFormatoFrontend(fila) }, 201);
}

// GET /api/solicitudes/mias — lista las del usuario actual, recientes primero.
export async function listarMias(req, res) {
  const filas = await Solicitudes.listarPorUsuario(req.usuario.id);
  return ok(res, { solicitudes: filas.map(aFormatoFrontend) });
}

// Valida que el :id de la URL sea un entero positivo.
function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'ID de solicitud inválido.');
  }
  return id;
}

// PATCH /api/solicitudes/:id/cancelar — marca la solicitud como cancelada.
export async function cancelar(req, res) {
  const id = parseId(req.params.id);
  const fila = await Solicitudes.cancelar(id, req.usuario.id);
  if (!fila) {
    // 404 genérico: no distinguimos "no existe" de "no es tuya" para no
    // filtrar qué ids existen.
    throw new HttpError(404, 'SOLICITUD_NO_ENCONTRADA',
      'No se encontró la solicitud (o no se puede cancelar).');
  }
  return ok(res, { solicitud: aFormatoFrontend(fila) });
}

// DELETE /api/solicitudes/:id — borrado definitivo.
export async function eliminar(req, res) {
  const id = parseId(req.params.id);
  if (!(await Solicitudes.eliminar(id, req.usuario.id))) {
    throw new HttpError(404, 'SOLICITUD_NO_ENCONTRADA',
      'No se encontró la solicitud.');
  }
  return ok(res, { eliminada: true, id });
}
