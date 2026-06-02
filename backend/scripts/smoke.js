// Smoke test end-to-end. No es exhaustivo (eso lo cubrirían tests
// unitarios con Vitest si llegamos a meterlos), pero detecta en segundos
// si rompimos el contrato JSON, una ruta o el middleware de auth.
//
// Uso: `npm run test:smoke` (con el server arriba en otra terminal).
// Requiere Node >= 18 por el fetch nativo.

import assert from 'node:assert/strict';

const BASE = process.env.BACKEND_URL ?? 'http://localhost:4000';

let passed = 0;
let failed = 0;

async function test(nombre, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${nombre}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${nombre}`);
    console.log(`    ${err.message}`);
  }
}

async function api(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json();
  return { status: res.status, body };
}

console.log(`\nSmoke test contra ${BASE}\n`);

// ── Healthcheck ──────────────────────────────────────────────────────────
console.log('Healthcheck');
await test('GET /api/health → 200 ok=true', async () => {
  const { status, body } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.service, 'ecopuntos-backend');
});

// Email único por corrida para no chocar con el seed/runs anteriores.
const email = `smoke+${Date.now()}@example.com`;
const password = 'smoke1234';
let token;

// ── Auth ─────────────────────────────────────────────────────────────────
console.log('\nAutenticación');
await test('POST /api/auth/registro → 201 + token', async () => {
  const { status, body } = await api('/api/auth/registro', {
    method: 'POST',
    body: JSON.stringify({ nombre: 'Smoke User', email, password }),
  });
  assert.equal(status, 201);
  assert.equal(body.ok, true);
  assert.ok(body.data.token, 'falta token');
  assert.equal(body.data.usuario.email, email);
  token = body.data.token;
});

await test('POST /api/auth/registro duplicado → 409', async () => {
  const { status, body } = await api('/api/auth/registro', {
    method: 'POST',
    body: JSON.stringify({ nombre: 'Smoke User', email, password }),
  });
  assert.equal(status, 409);
  assert.equal(body.error.code, 'EMAIL_EN_USO');
});

await test('POST /api/auth/registro inválido → 422 con details', async () => {
  const { status, body } = await api('/api/auth/registro', {
    method: 'POST',
    body: JSON.stringify({ nombre: 'x', email: 'no', password: '1' }),
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.error.details.email);
});

await test('POST /api/auth/login OK', async () => {
  const { status, body } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(status, 200);
  assert.ok(body.data.token);
});

await test('POST /api/auth/login mala contraseña → 401', async () => {
  const { status, body } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'mala' }),
  });
  assert.equal(status, 401);
  assert.equal(body.error.code, 'CREDENCIALES_INVALIDAS');
});

await test('GET /api/auth/yo sin token → 401', async () => {
  const { status, body } = await api('/api/auth/yo');
  assert.equal(status, 401);
  assert.equal(body.error.code, 'NO_TOKEN');
});

await test('GET /api/auth/yo con token → 200', async () => {
  const { status, body } = await api('/api/auth/yo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(status, 200);
  assert.equal(body.data.usuario.email, email);
});

// ── Ecopuntos ────────────────────────────────────────────────────────────
console.log('\nEcopuntos');
await test('GET /api/ecopuntos → 200 con exactamente 12 puntos', async () => {
  const { status, body } = await api('/api/ecopuntos');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
  assert.equal(body.data.length, 12, `esperaba 12 ecopuntos, recibí ${body.data.length}`);
  const eco = body.data[0];
  // Contrato que consume el frontend (campos en inglés).
  for (const k of ['id', 'name', 'address', 'hours', 'lat', 'lng', 'wasteLevels']) {
    assert.ok(k in eco, `falta campo ${k}`);
  }
  assert.ok(Array.isArray(eco.wasteLevels));
  assert.ok(eco.wasteLevels.length > 0, 'wasteLevels no debería estar vacío');
});

// ── Solicitudes ──────────────────────────────────────────────────────────
console.log('\nSolicitudes de recolección');
await test('POST /api/solicitudes sin token → 401', async () => {
  const { status, body } = await api('/api/solicitudes', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert.equal(status, 401);
  assert.equal(body.error.code, 'NO_TOKEN');
});

await test('POST /api/solicitudes inválida → 422', async () => {
  const { status, body } = await api('/api/solicitudes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type: 'basura', description: 'x', address: 'x', date: 'hoy' }),
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

await test('POST /api/solicitudes con fecha calendárica inválida → 422', async () => {
  const { status, body } = await api('/api/solicitudes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'muebles',
      description: 'Sofá viejo',
      address: 'Calle 26 # 50-00',
      date: '2026-13-99',
    }),
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.error.details.date, 'details debe incluir date');
});

await test('POST /api/solicitudes con fecha pasada → 422', async () => {
  const { status, body } = await api('/api/solicitudes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'muebles',
      description: 'Sofá viejo',
      address: 'Calle 26 # 50-00',
      date: '2000-01-01',
      solicitanteNombre: 'Smoke Tester',
      solicitanteTelefono: '3001234567',
    }),
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.error.details.date);
});

await test('POST /api/solicitudes sin nombre del solicitante → 422', async () => {
  const { status, body } = await api('/api/solicitudes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'muebles',
      description: 'Sofá viejo',
      address: 'Calle 26 # 50-00',
      date: '2030-05-15',
      solicitanteTelefono: '3001234567',
    }),
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.error.details.solicitanteNombre);
});

await test('POST /api/solicitudes con telefono muy corto → 422', async () => {
  const { status, body } = await api('/api/solicitudes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'muebles',
      description: 'Sofá viejo',
      address: 'Calle 26 # 50-00',
      date: '2030-05-15',
      solicitanteNombre: 'Smoke Tester',
      solicitanteTelefono: '123',
    }),
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.error.details.solicitanteTelefono);
});

await test('POST /api/solicitudes válida → 201', async () => {
  const { status, body } = await api('/api/solicitudes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'muebles',
      description: 'Sofá viejo y dos sillas',
      address: 'Calle 26 # 50-00',
      date: '2030-05-15',
      photoName: 'sofa.jpg',
      solicitanteNombre: 'Smoke Tester',
      solicitanteTelefono: '300 123 4567',
    }),
  });
  assert.equal(status, 201);
  assert.equal(body.data.solicitud.type, 'muebles');
  assert.equal(body.data.solicitud.status, 'pendiente');
  assert.equal(body.data.solicitud.solicitanteNombre, 'Smoke Tester');
  assert.equal(body.data.solicitud.solicitanteTelefono, '300 123 4567');
});

await test('GET /api/solicitudes/mias → 200 con la solicitud creada', async () => {
  const { status, body } = await api('/api/solicitudes/mias', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(status, 200);
  assert.ok(body.data.solicitudes.length >= 1);
  assert.equal(body.data.solicitudes[0].type, 'muebles');
});

// ── Google OAuth ─────────────────────────────────────────────────────────
console.log('\nGoogle OAuth');
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

// ── 404 ──────────────────────────────────────────────────────────────────
console.log('\nNot found');
await test('GET /api/no-existe → 404 NOT_FOUND', async () => {
  const { status, body } = await api('/api/no-existe');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});

// ── config.js (subprocesos) ───────────────────────────────────────────────
// Verificamos que el server rehúsa arrancar con JWT_SECRET placeholder o
// vacío. Levantamos un subproceso por test porque config.js se evalúa al
// importarse.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

console.log('\nConfiguración (subprocesos)');

function probarConfigEnv(jwtSecretValue) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.resolve(here, '..', 'src', 'config.js');
  const configUrl = `file:///${configPath.replace(/\\/g, '/')}`;
  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `import('${configUrl}').then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(2)})`],
    { env: { ...process.env, JWT_SECRET: jwtSecretValue }, encoding: 'utf8' }
  );
}

await test('config.js rechaza JWT_SECRET placeholder', () => {
  const res = probarConfigEnv('cambia-esto-en-produccion');
  assert.notEqual(res.status, 0, 'el proceso debería fallar con el placeholder');
  assert.match(res.stderr, /JWT_SECRET/, 'mensaje debe nombrar JWT_SECRET');
});

await test('config.js rechaza JWT_SECRET vacío', () => {
  const res = probarConfigEnv('');
  assert.notEqual(res.status, 0, 'el proceso debería fallar con secreto vacío');
});

// ── Resumen ──────────────────────────────────────────────────────────────
console.log(`\n${passed} ok, ${failed} fallidos`);
process.exit(failed === 0 ? 0 : 1);
