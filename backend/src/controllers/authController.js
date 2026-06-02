// Controller de auth: registro, login y "yo" (datos del usuario actual).
// El SQL vive en el model — acá solo validamos, llamamos al model,
// firmamos el JWT y respondemos.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

import { config } from '../config.js';
import { HttpError, ok } from '../utils/response.js';
import * as Usuarios from '../models/usuariosModel.js';
import * as mailer from '../services/mailer.js';
import { welcomeEmail } from '../services/templates.js';

// Cliente de Google para verificar ID tokens. La "audience" del token
// debe coincidir con nuestro Client ID. Esto evita que un atacante use
// un token emitido para OTRA app como si fuera de la nuestra.
const googleClient = new OAuth2Client(config.googleClientId);

// 10 rounds = ~100ms por hash. Suficiente para que un atacante no itere
// tan tranquilo. Si la entrega pide más, subir a 12 (4x más lento).
const BCRYPT_ROUNDS = 10;

// Validación a mano. FIXME: cuando el proyecto crezca usar Zod/Joi en vez
// de seguir escribiendo esto manual. Por ahora pasa derecho para la entrega.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarRegistro(body) {
  const errores = {};

  if (typeof body?.nombre !== 'string' || body.nombre.trim().length < 2) {
    errores.nombre = 'Debe tener al menos 2 caracteres.';
  }
  if (typeof body?.email !== 'string' || !EMAIL_REGEX.test(body.email)) {
    errores.email = 'Email no válido.';
  }
  if (typeof body?.password !== 'string' || body.password.length < 6) {
    errores.password = 'La contraseña debe tener al menos 6 caracteres.';
  }

  if (Object.keys(errores).length > 0) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Datos inválidos.', errores);
  }
}

function validarLogin(body) {
  if (typeof body?.email !== 'string' || typeof body?.password !== 'string') {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Email y password son obligatorios.');
  }
}

function firmarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, email: usuario.email, nombre: usuario.nombre },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// POST /api/auth/registro -> { token, usuario }
export async function registro(req, res) {
  validarRegistro(req.body);

  const { nombre, email, password } = req.body;

  // Hasheamos ANTES de tocar la base — si bcrypt explota, al menos no
  // quedamos con un usuario huérfano en la tabla.
  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let usuario;
  try {
    usuario = await Usuarios.crear({ nombre: nombre.trim(), email: email.trim(), password_hash });
  } catch (err) {
    // El índice único de email en Mongo rebota como duplicate key (code 11000).
    if (err.code === 11000) {
      throw new HttpError(409, 'EMAIL_EN_USO', 'Ya existe una cuenta con ese email.');
    }
    throw err;
  }

  const token = firmarToken(usuario);

  // Email de bienvenida fire-and-forget. Si SMTP no esta configurado o falla,
  // mailer.send loguea y vuelve — no afecta la respuesta al cliente.
  mailer.send({
    to: usuario.email,
    subject: 'Bienvenido a EcoPuntos Bogotá',
    ...welcomeEmail({ nombre: usuario.nombre, email: usuario.email }),
  });

  return ok(res, { token, usuario }, 201);
}

// POST /api/auth/login -> { token, usuario }
export async function login(req, res) {
  validarLogin(req.body);

  const { email, password } = req.body;
  const fila = await Usuarios.buscarPorEmail(email);

  // Ojo: respondemos lo MISMO si el email no existe o si el password está
  // mal. Si distinguiéramos, un atacante podría enumerar emails registrados.
  const passwordOk = fila ? await bcrypt.compare(password, fila.password_hash) : false;
  if (!fila || !passwordOk) {
    throw new HttpError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos.');
  }

  const usuario = { id: fila.id, nombre: fila.nombre, email: fila.email, creado_en: fila.creado_en };
  const token = firmarToken(usuario);
  return ok(res, { token, usuario });
}

// GET /api/auth/yo (protegido) — para que el front rehidrate la sesión
// al recargar: guarda solo el token y al arrancar pide acá los datos.
export async function yo(req, res) {
  const usuario = await Usuarios.buscarPorId(req.usuario.id);
  if (!usuario) {
    throw new HttpError(404, 'USUARIO_NO_ENCONTRADO', 'El usuario del token ya no existe.');
  }
  return ok(res, { usuario });
}

// POST /api/auth/google
// Body: { credential: string }  ← ID token JWT que el frontend recibe
//                                   de Google Identity Services.
// Flow:
//   1. Validar que credential viene.
//   2. Verificar firma/audience/expiracion con google-auth-library.
//   3. Buscar usuario por google_sub. Si no, por email (linkear). Si no, crear.
//   4. Firmar nuestro JWT y devolverlo. El frontend lo guarda en localStorage.
export async function googleLogin(req, res) {
  const { credential } = req.body ?? {};
  if (typeof credential !== 'string' || credential.length === 0) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Falta credential.');
  }
  if (!config.googleClientId) {
    throw new HttpError(500, 'GOOGLE_NO_CONFIGURADO',
      'El servidor no tiene GOOGLE_CLIENT_ID configurado.');
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    });
    payload = ticket.getPayload();
  } catch (err) {
    throw new HttpError(401, 'GOOGLE_TOKEN_INVALIDO',
      'El token de Google no es válido.');
  }

  const { sub, email, name, email_verified } = payload ?? {};
  if (!email || !email_verified) {
    throw new HttpError(401, 'GOOGLE_EMAIL_NO_VERIFICADO',
      'Tu email de Google no está verificado.');
  }

  // Buscar primero por google_sub (match exacto), luego por email (linkeo).
  let fila = await Usuarios.buscarPorGoogleSub(sub);
  let esNuevo = false;
  if (!fila) {
    fila = await Usuarios.buscarPorEmail(email);
    if (fila) {
      // Existe con email+password — linkear su google_sub para la próxima vez.
      await Usuarios.linkearGoogle(fila.id, sub);
    } else {
      // Usuario nuevo: crear sin password_hash (queda NULL).
      fila = await Usuarios.crearConGoogle({
        nombre: name ?? email.split('@')[0],
        email,
        google_sub: sub,
      });
      esNuevo = true;
    }
  }

  const usuario = {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    creado_en: fila.creado_en,
  };
  const token = firmarToken(usuario);

  // Email de bienvenida solo si la cuenta es nueva (creada en este flow).
  if (esNuevo) {
    mailer.send({
      to: usuario.email,
      subject: 'Bienvenido a EcoPuntos Bogotá',
      ...welcomeEmail({ nombre: usuario.nombre, email: usuario.email }),
    });
  }

  return ok(res, { token, usuario });
}
