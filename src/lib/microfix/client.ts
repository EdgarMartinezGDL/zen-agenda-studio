// Cliente HTTP de MicroFix Cloud. Basado en el cliente del frontend actual
// (frontend/src/api/client.ts), ya probado contra este backend.
//
// La URL del backend sale de VITE_API_URL (p. ej. http://localhost:3000).
// En la vista previa de Lovable no hay backend: las llamadas fallan y la UI
// debe mostrar su estado vacío/error, nunca romperse.

import type { ApiErrorBody, AuthUser } from './types';

const API_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? 'http://localhost:3000';
const TOKEN_KEY = 'microfix_token';
const USER_KEY = 'microfix_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (!getToken()) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  status: number; // 0 = no hubo respuesta (backend apagado o sin red)
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean; // adjunta el JWT si hay sesión (default true)
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, auth = true }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  // FormData (subir archivos): el navegador pone el Content-Type con su boundary.
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const token = auth ? getToken() : null;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? null : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 0);
  }

  // Sesión vencida o token inválido: se descarta y se vuelve al login
  // (el login va con auth: false, así que una contraseña mala no entra aquí).
  if (res.status === 401 && token) {
    clearSession();
    window.location.assign('/login');
  }

  if (!res.ok) {
    let message = res.statusText;
    let data: unknown;
    try {
      data = await res.json();
      const m = (data as ApiErrorBody)?.message;
      // Los errores de validación traen un arreglo de mensajes.
      if (Array.isArray(m)) message = m.join('. ');
      else if (m) message = m;
    } catch {
      // respuesta sin JSON, se queda con statusText
    }
    throw new ApiError(message, res.status, data);
  }

  if (res.status === 204) return undefined as T;

  // Nest manda 200 con cuerpo VACÍO (no el string "null") cuando el
  // controller devuelve null/undefined — pasa con GET /ai-settings/
  // organization/:id sin fila todavía. res.json() truena con un body
  // vacío, así que se lee como texto primero.
  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}
