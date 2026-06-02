# Spec B — Emails reales + Sign-in with Google

**Status:** aprobado por el usuario el 2026-05-23.
**Branch:** rama nueva `feat/emails-oauth` desde `dev` local. **Sin push** por ahora.
**Sigue a:** Spec A (`2026-05-23-spec-a-mapa-busqueda.md`), ya mergeada a `dev`.

---

## Goal

Dos features independientes pero conectadas por el flujo de cuentas:

1. **Emails reales** vía Nodemailer + Gmail SMTP. Bienvenida en el registro (email+password y Google). Confirmación en `POST /api/solicitudes`. Fire-and-forget — si SMTP no está configurado o falla, la operación principal completa igual.
2. **Sign-in with Google** vía Google Identity Services. Botón "Continuar con Google" en Login y Registro. Linkeo por email con cuentas pre-existentes. Schema de `usuarios` ampliado con `google_sub` y `password_hash` pasa a nullable.

---

## Non-goals

- No reemplazar email+password — ambos métodos coexisten (decisión del usuario).
- No verificación de email obligatoria al registro tradicional. Si Google ya verificó el email, lo aceptamos como verificado; si no, no validamos.
- No publicación de la app OAuth en Google ("Testing" indefinido, hasta 100 test users).
- No proxy del email/OAuth por servicios externos (SendGrid, Auth0). Todo directo a Gmail SMTP / Google.
- No tests automatizados para el flow real de Google login (requiere token real — solo testeamos el endpoint con tokens inválidos).
- No SPF/DKIM/DMARC en remitente — los emails saldrán como Gmail estándar (algunos clientes los marcan como "vía gmail.com").

---

## Decisiones tomadas (brainstorming)

| Decisión | Valor |
|---|---|
| Política fallo SMTP | No-bloquear: registrar/crear solicitud igual, loguear el error |
| Triggers de email | Bienvenida en `registro` + `googleLogin` (cuando crea user nuevo). Confirmación en `solicitudes.crear`. |
| Formato email | HTML simple con branding básico (header con colores) + texto plano como fallback |
| Linking de cuentas Google | Sí, por email — misma cuenta puede usar ambos métodos |
| UI botón Google | En Login y Registro, debajo del botón principal con separador "o continuar con" |
| Cuenta Gmail remitente | La del usuario (`npulido1155@gmail.com` o similar) |
| Auth strategy | Mantener email+password (no reemplazar por solo Google) |
| Schema migration | Idempotente: ALTER TABLE para añadir `google_sub`; recrear tabla solo si `password_hash NOT NULL` |
| Estrategia git | Rama local `feat/emails-oauth`, sin push, merge a `dev` local |

---

## Arquitectura

### Reparto frontend/backend

| Pieza | Dónde | Por qué |
|---|---|---|
| Envío SMTP | Backend (`src/services/mailer.js`) | Credenciales nunca al cliente. |
| Triggers de email | Backend (`authController`, `solicitudesController`) | Donde nace el evento. Fire-and-forget. |
| Validación ID token Google | Backend (`authController.googleLogin`) | Solo el server verifica con `google-auth-library`. |
| Botón "Continuar con Google" | Frontend (`GoogleSignInButton.tsx` consumido por `LoginView`, `RegisterView`) | UI. Usa `@react-oauth/google`. |
| Migración schema | Backend (`db/migrate.js`) | Idempotente, preserva los 20 usuarios existentes. |
| Credenciales | Backend `.env` (SMTP_*, GOOGLE_CLIENT_ID) + raíz `.env` (VITE_GOOGLE_CLIENT_ID) | Secretos del server vs. valor público compartible. |

### Flujo Google sign-in (alto nivel)

```
Frontend                       Google                Backend
   |                              |                      |
   | click "Continuar con Google" |                      |
   |----------------------------->|                      |
   |                              |                      |
   |       <usuario autoriza>     |                      |
   |                              |                      |
   |   <-- ID token (JWT firmado)-|                      |
   |                                                     |
   |  POST /api/auth/google { credential: <id_token> }   |
   |---------------------------------------------------->|
   |                                                     |
   |          <verifyIdToken con google-auth-library>    |
   |          <buscar por google_sub, luego por email>   |
   |          <crear o linkear según el caso>            |
   |          <firmar JWT propio>                        |
   |          <enviar bienvenida si es nuevo (no await)> |
   |                                                     |
   |  <----- { ok: true, data: { token, usuario } } -----|
```

### Flujo email (no-bloqueante)

`authController.registro` (y `googleLogin` para usuarios nuevos, y `solicitudesController.crear`):

```
1. validar input
2. hashear password / verificar token
3. INSERT en DB
4. firmar JWT propio
5. RESPONDER 201 al cliente   ← se devuelve antes del email
6. mailer.send(...)            ← fire-and-forget, sin await
     error → console.error     ← no afecta nada
```

`mailer.send()` en modo no-op si faltan `SMTP_USER`/`SMTP_PASS`: solo loguea, no falla.

---

## Schema (`backend/src/db/migrate.js`)

```sql
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,                              -- NULL para usuarios solo-Google
  google_sub    TEXT    UNIQUE,                    -- NULL para usuarios solo-password
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**Migración idempotente para DBs existentes:**

```js
const info = db.prepare("PRAGMA table_info(usuarios)").all();
const tieneGoogleSub = info.some((c) => c.name === 'google_sub');
const passwordNotNull = info.find((c) => c.name === 'password_hash')?.notnull === 1;

if (passwordNotNull) {
  // Recrear tabla para relajar NOT NULL en password_hash. Envuelto en transacción.
  db.transaction(() => {
    db.exec(`
      CREATE TABLE usuarios_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT,
        google_sub TEXT UNIQUE,
        creado_en TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO usuarios_new (id, nombre, email, password_hash, creado_en)
        SELECT id, nombre, email, password_hash, creado_en FROM usuarios;
      DROP TABLE usuarios;
      ALTER TABLE usuarios_new RENAME TO usuarios;
    `);
  })();
  console.log('[migrate] tabla usuarios recreada con password_hash nullable y google_sub');
} else if (!tieneGoogleSub) {
  db.exec(`ALTER TABLE usuarios ADD COLUMN google_sub TEXT`);
  console.log('[migrate] columna google_sub añadida a usuarios');
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_google_sub
    ON usuarios(google_sub) WHERE google_sub IS NOT NULL
`);
```

> El índice UNIQUE PARCIAL (`WHERE google_sub IS NOT NULL`) evita que múltiples usuarios con `google_sub = NULL` choquen entre sí.

---

## Backend — emails

### Dependencias

```bash
cd backend && npm install nodemailer google-auth-library
```

### `backend/src/services/mailer.js`

```js
import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter = null;
let modoNoOp = false;

function init() {
  if (transporter !== null || modoNoOp) return;
  if (!config.smtp.user || !config.smtp.pass) {
    modoNoOp = true;
    console.warn('[mailer] SMTP no configurado. Emails desactivados.');
    return;
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  console.log(`[mailer] SMTP listo (remitente: ${config.smtp.user})`);
}

export async function send({ to, subject, html, text }) {
  init();
  if (modoNoOp) {
    console.log(`[mailer] (no-op) ${subject} → ${to}`);
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: `"EcoPuntos Bogotá" <${config.smtp.user}>`,
      to, subject, html, text,
    });
    console.log(`[mailer] enviado a ${to}: ${info.messageId}`);
  } catch (err) {
    console.error(`[mailer] error enviando a ${to}:`, err.message);
  }
}
```

### `backend/src/services/templates.js`

Dos funciones: `welcomeEmail({ nombre, email })` y `solicitudConfirmEmail({ nombre, type, description, address, date })`. Cada una devuelve `{ html, text }`. HTML simple con CSS inline (algunos clientes ignoran `<style>`).

**Bienvenida** — header verde (`#16a34a`), título "¡Bienvenido a EcoPuntos!", párrafo corto, datos del usuario, firma.

**Confirmación de solicitud** — header azul (`#2563eb`), título "Solicitud registrada", lista de datos (Tipo, Descripción, Dirección, Fecha), nota "Te contactaremos pronto".

### Cambios en `config.js`

```js
export const config = {
  ...existente,
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  smtp: {
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },
};
```

Sin validación obligatoria — el ausente solo desactiva los features (no falla el arranque).

### Triggers

**`authController.registro`** (después de firmar token, antes de responder):

```js
const token = firmarToken(usuario);
mailer.send({
  to: usuario.email,
  subject: 'Bienvenido a EcoPuntos Bogotá',
  ...welcomeEmail({ nombre: usuario.nombre, email: usuario.email }),
});  // sin await — fire-and-forget
return ok(res, { token, usuario }, 201);
```

**`solicitudesController.crear`** (después de insertar, antes de responder):

```js
const fila = Solicitudes.crear({...});
mailer.send({
  to: req.usuario.email,
  subject: 'Tu solicitud de recolección fue registrada',
  ...solicitudConfirmEmail({
    nombre: req.usuario.nombre,
    type: fila.tipo,
    description: fila.descripcion,
    address: fila.direccion,
    date: fila.fecha,
  }),
});
return ok(res, { solicitud: aFormatoFrontend(fila) }, 201);
```

---

## Backend — Google OAuth

### `authController.googleLogin`

```js
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(config.googleClientId);

export async function googleLogin(req, res) {
  const { credential } = req.body;
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

  const { sub, email, name, email_verified } = payload;
  if (!email || !email_verified) {
    throw new HttpError(401, 'GOOGLE_EMAIL_NO_VERIFICADO',
      'Tu email de Google no está verificado.');
  }

  // Buscar por google_sub primero (match exacto), luego por email (linkeo).
  let fila = Usuarios.buscarPorGoogleSub(sub);
  let esNuevo = false;
  if (!fila) {
    fila = Usuarios.buscarPorEmail(email);
    if (fila) {
      Usuarios.linkearGoogle(fila.id, sub);
    } else {
      fila = Usuarios.crearConGoogle({
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

  if (esNuevo) {
    mailer.send({
      to: usuario.email,
      subject: 'Bienvenido a EcoPuntos Bogotá',
      ...welcomeEmail({ nombre: usuario.nombre, email: usuario.email }),
    });
  }

  return ok(res, { token, usuario });
}
```

### Nuevas funciones en `usuariosModel.js`

```js
export function buscarPorGoogleSub(sub) {
  return db.prepare(`
    SELECT id, nombre, email, creado_en
    FROM usuarios
    WHERE google_sub = ?
  `).get(sub);
}

export function linkearGoogle(id, google_sub) {
  db.prepare(`UPDATE usuarios SET google_sub = ? WHERE id = ?`).run(google_sub, id);
}

export function crearConGoogle({ nombre, email, google_sub }) {
  const info = db.prepare(`
    INSERT INTO usuarios (nombre, email, password_hash, google_sub)
    VALUES (@nombre, @email, NULL, @google_sub)
  `).run({ nombre, email, google_sub });
  return buscarPorId(info.lastInsertRowid);
}
```

### Ruta en `authRoutes.js`

```js
router.post('/google', asyncHandler(authController.googleLogin));
```

### Tests en `scripts/smoke.js` (añadir 2)

```js
await test('POST /api/auth/google sin credential → 422', async () => {
  const { status, body } = await api('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

await test('POST /api/auth/google con credential basura → 401', async () => {
  const { status, body } = await api('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential: 'esto-no-es-un-jwt' }),
  });
  assert.equal(status, 401);
  assert.equal(body.error.code, 'GOOGLE_TOKEN_INVALIDO');
});
```

Total esperado: **20 ok**.

---

## Frontend — Google sign-in

### Dependencia

```bash
corepack pnpm add @react-oauth/google
```

> Correr DESDE LA RAÍZ. NO desde `backend/` para que no reorganice los node_modules.

### `src/main.tsx`

```tsx
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {GOOGLE_CLIENT_ID ? (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <App />
    )}
  </StrictMode>
);
```

### `src/components/GoogleSignInButton.tsx`

```tsx
import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { api, setToken } from '../lib/api';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  creado_en?: string;
}

interface AuthResponse { token: string; usuario: Usuario }

interface Props {
  onSuccess: (usuario: Usuario) => void;
  onError: (msg: string) => void;
}

export const GoogleSignInButton: React.FC<Props> = ({ onSuccess, onError }) => {
  const hasGoogle = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!hasGoogle) return null;

  return (
    <GoogleLogin
      onSuccess={async (response) => {
        if (!response.credential) {
          onError('Google no devolvió credencial.');
          return;
        }
        try {
          const { token, usuario } = await api<AuthResponse>('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ credential: response.credential }),
          });
          setToken(token);
          localStorage.setItem('eco_user', JSON.stringify(usuario));
          onSuccess(usuario);
        } catch (err) {
          onError(err instanceof Error ? err.message : 'Error con Google Sign-in.');
        }
      }}
      onError={() => onError('No se pudo iniciar sesión con Google.')}
      theme="outline"
      size="large"
      text="continue_with"
      shape="rectangular"
      locale="es"
      width="320"
    />
  );
};
```

### Cambios mínimos en LoginView/RegisterView

Después del botón verde principal (`<Button onClick={handleSubmit} ...>`):

```tsx
{/* Separador */}
<div className="relative my-4 flex items-center">
  <div className="flex-grow border-t border-gray-200"></div>
  <span className="mx-3 text-[10px] text-gray-400 uppercase tracking-widest">o continuar con</span>
  <div className="flex-grow border-t border-gray-200"></div>
</div>

<div className="flex justify-center">
  <GoogleSignInButton
    onSuccess={onGoogleSuccess}
    onError={setError}
  />
</div>
```

`LoginView` y `RegisterView` reciben una prop nueva: `onGoogleSuccess: (usuario: Usuario) => void`.

### Cambios en `App.tsx`

```tsx
const handleGoogleSuccess = (usuario: Usuario) => {
  // token YA fue guardado por GoogleSignInButton.
  localStorage.setItem('eco_user', JSON.stringify(usuario));
  setUser(usuario);
  navigate('map');
};

<LoginView onLogin={handleLogin} onGoogleSuccess={handleGoogleSuccess} onRegisterClick={...} />
<RegisterView onRegister={handleRegister} onGoogleSuccess={handleGoogleSuccess} onBackToLogin={...} />
```

### `src/vite-env.d.ts`

```ts
interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
```

---

## Estado de los `.env`

**Ya configurado** (gitignored):

- Raíz: `VITE_GOOGLE_CLIENT_ID=417458283931-...apps.googleusercontent.com`
- Backend: `GOOGLE_CLIENT_ID=417458283931-...apps.googleusercontent.com`
- Backend: `SMTP_USER=`, `SMTP_PASS=` (vacíos por ahora — el usuario los configurará después)

`.env.example` se actualiza con los nuevos campos (sin valores reales).

---

## Verificación

- **Backend smoke**: 20 ok, 0 fallidos (18 anteriores + 2 nuevos de OAuth).
- **Backend migración**: arrancar el server con la DB actual (20 usuarios) y verificar:
  - El log dice `[migrate] tabla usuarios recreada con password_hash nullable y google_sub`.
  - `SELECT COUNT(*) FROM usuarios` sigue devolviendo 20.
  - `PRAGMA table_info(usuarios)` muestra `password_hash | TEXT | notnull=0` y `google_sub | TEXT | notnull=0`.
- **Frontend build**: `pnpm build` limpio.
- **Frontend lint**: sin nuevos errores (los 3 pre-existentes en `MapContext.tsx` siguen).
- **Manual end-to-end:**
  1. Registro tradicional → llega email de bienvenida a la inbox real (si SMTP configurado).
  2. Sign-in con Google nuevo → entra al mapa → llega email de bienvenida.
  3. Sign-in con Google con email ya existente → linkea a la cuenta existente, mismo ID.
  4. Logout + login tradicional con el mismo email → entra a la misma cuenta.
  5. Crear solicitud → llega email de confirmación.
  6. Sin SMTP configurado → todo lo demás funciona, solo no llegan emails.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Recrear tabla `usuarios` falla a mitad y pierde datos | Envuelto en `db.transaction()`. Si falla algo, rollback completo. |
| Gmail SMTP tarda 1-3s por email | Fire-and-forget. No afecta latencia del request. |
| `@react-oauth/google` añade script externo al DOM | Estándar de Google Identity Services. Necesita acceso a `accounts.google.com`. |
| Token de Google expira a los 60 min | Irrelevante: lo usamos UNA vez para firmar nuestro JWT (2h). El usuario nunca lo vuelve a usar. |
| Pnpm desde `backend/` rompe better-sqlite3 (otra vez) | SIEMPRE correr `corepack pnpm` desde la raíz. Documentado en el plan. |
| Gmail puede marcar como spam | Aceptable para académico. En producción usarías dominio propio + SPF/DKIM. |
