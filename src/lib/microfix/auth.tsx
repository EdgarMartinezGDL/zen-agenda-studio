// Sesión del profesional. Basado en frontend/src/auth/ (AuthContext +
// RequireAuth), ya probado contra este backend.
//
// Uso:
//   <AuthProvider> envuelve la app (dentro del <BrowserRouter>).
//   <RequireAuth> envuelve las rutas privadas; sin sesión manda a /login.
//   const { user, login, logout } = useAuth();  → user.organizationId es el
//   que se pasa a todas las llamadas de api.ts.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate } from '@tanstack/react-router';
import { authApi } from './api';
import { clearSession, getStoredUser, saveSession } from './client';
import type { AuthUser } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** false hasta leer la sesión guardada en el navegador (evita errores de SSR). */
  ready: boolean;
}

// Se guarda en globalThis para que la recarga en caliente no cree un contexto
// nuevo (eso dejaba a las pantallas "fuera" del AuthProvider y rompía la vista).
const g = globalThis as { __mfAuthCtx?: React.Context<AuthContextValue | null> };
const AuthContext = (g.__mfAuthCtx ??= createContext<AuthContextValue | null>(null));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setUser(getStoredUser());
    setReady(true);
  }, []);

  async function login(email: string, password: string) {
    // Credenciales malas → ApiError 401 con message "Invalid credentials"
    // (no redirige): mostrar "Correo o contraseña incorrectos".
    const { access_token, user } = await authApi.login(email, password);
    saveSession(access_token, user);
    setUser(user);
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout, ready }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
