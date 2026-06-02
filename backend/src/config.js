// Toda la config en un solo lugar. Si falta una env crítica, que reviente
// al arrancar y no a mitad de un request frente al profe.

import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `[config] Falta la variable de entorno ${name}. Revisa tu .env (usa .env.example como plantilla).`
    );
  }
  return value;
}

// Placeholders conocidos del JWT_SECRET. Si .env todavía tiene uno de
// estos, no aceptamos arrancar — hay que generar un secreto real con
//   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
const JWT_SECRET_PLACEHOLDERS = new Set([
  'cambia-esto-en-produccion',
  'changeme',
  'secret',
]);

function jwtSecret() {
  const value = required('JWT_SECRET');
  if (JWT_SECRET_PLACEHOLDERS.has(value)) {
    throw new Error(
      `[config] JWT_SECRET tiene un valor placeholder (${value}). ` +
        `Genera uno aleatorio (ver .env.example).`
    );
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  dbPath: process.env.DB_PATH ?? './ecopuntos.db',
  jwtSecret: jwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',

  // Google OAuth. Si esta vacio, el endpoint /api/auth/google responde 500.
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',

  // SMTP de Gmail. Si SMTP_USER o SMTP_PASS faltan, mailer.js queda en
  // modo no-op (logea pero no envia).
  smtp: {
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },

  // MongoDB Atlas. Si MONGODB_URI esta vacio, la conexion queda desactivada
  // (el backend sigue funcionando con SQLite). MONGODB_DB es opcional: si va
  // vacio se usa la base que venga en la URI.
  mongoUri: process.env.MONGODB_URI ?? '',
  mongoDbName: process.env.MONGODB_DB ?? '',

  // Útil para condicionar logs en dev vs prod.
  isProd: process.env.NODE_ENV === 'production',
};
