// Contrato JSON unificado:
//   éxito  -> { ok: true,  data }
//   error  -> { ok: false, error: { code, message, details? } }
// El front solo revisa `ok`. Si cada endpoint inventa su forma, sufrimos.

export function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

// status: HTTP. code: UPPER_SNAKE. message: en español, para humanos.
// details: opcional (ej. errores de validación campo a campo). NUNCA
// poner stack traces acá — eso va al log, no al cliente.
export function fail(res, status, code, message, details) {
  const payload = { ok: false, error: { code, message } };
  if (details !== undefined) payload.error.details = details;
  return res.status(status).json(payload);
}

// Error "tipado" para que los controllers lo tiren con throw y caigan
// limpios en errorHandler. Ahorra mucho if/return res.status().
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
