// Cliente fetch único para hablar con el backend.
// Centraliza: URL base, JWT en localStorage y parseo del contrato
// { ok, data, error }. Si ok=false lanza ApiError.

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'eco_token';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface ApiSuccess<T> {
  ok: true;
  data: T;
}
interface ApiFailure {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}
type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(res.status, 'INVALID_RESPONSE', 'La respuesta del servidor no es JSON.');
  }
  if (!body.ok) {
    throw new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  }
  return body.data;
}
