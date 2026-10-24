// Notificaciones push (Web Push) de este dispositivo. El service worker está
// en /sw.js. Todo es del navegador: nunca se llama durante el render del
// servidor, solo desde efectos o clics.

import { ApiError } from './client';
import { pushApi } from './api';

export type PushState =
  | 'unsupported' // el navegador no tiene push
  | 'insecure' // la app no se abrió con https (o localhost)
  | 'preview' // vista previa dentro de un iframe (Lovable)
  | 'ios-install' // iPhone/iPad: primero hay que agregarla a la pantalla de inicio
  | 'denied' // el permiso se negó en el navegador
  | 'off' // se puede activar
  | 'on'; // este dispositivo ya recibe avisos

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function canUseServiceWorker(): boolean {
  return 'serviceWorker' in navigator && window.isSecureContext && window.self === window.top;
}

/** Registra /sw.js (una vez por carga). Sin efecto en la vista previa ni sin https. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorker()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorker()) return null;
  return (await registerServiceWorker()) ? navigator.serviceWorker.ready : null;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await readyRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported';
  if (window.self !== window.top) return 'preview';
  if (isIos() && !isStandalone()) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  if (!window.isSecureContext) return 'insecure';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && (await currentSubscription())) return 'on';
  return 'off';
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Activa los avisos en este dispositivo. Debe llamarse desde un clic (el
 * navegador solo pide permiso así). Lanza ApiError con el mensaje del backend
 * (403 del plan, 503 sin llaves) o Error con un texto para la persona.
 */
export async function enablePush(orgId: string): Promise<void> {
  const { publicKey } = await pushApi.vapidPublicKey();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('No diste permiso para mostrar notificaciones en este dispositivo.');
  }
  const reg = await readyRegistration();
  if (!reg) throw new Error('Este navegador no permite notificaciones aquí.');
  let sub: PushSubscription;
  try {
    sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
  } catch {
    // El servicio de push del navegador no respondió o lo rechazó (mensaje en inglés).
    throw new Error('Este navegador no pudo activar las notificaciones. Inténtalo de nuevo en un momento.');
  }
  try {
    await pushApi.subscribe(orgId, sub.toJSON());
  } catch (e) {
    // Si el backend no lo acepta (plan sin push, por ejemplo) no se deja a medias.
    if (e instanceof ApiError && e.status !== 0) await sub.unsubscribe().catch(() => undefined);
    throw e;
  }
}

/** Quita los avisos de este dispositivo (en el backend y en el navegador). */
export async function disablePush(orgId: string): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await pushApi.unsubscribe(orgId, sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

/** Al abrir la app: si ya estaba activo, se vuelve a registrar en silencio. */
export async function refreshPush(orgId: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (sub) await pushApi.subscribe(orgId, sub.toJSON()).catch(() => undefined);
}

/** Al cerrar sesión: se quita el registro, sin esperar más de 3 s. */
export async function disablePushOnLogout(orgId: string): Promise<void> {
  if (typeof window === 'undefined' || !canUseServiceWorker()) return;
  await Promise.race([disablePush(orgId).catch(() => undefined), new Promise((r) => setTimeout(r, 3000))]);
}
