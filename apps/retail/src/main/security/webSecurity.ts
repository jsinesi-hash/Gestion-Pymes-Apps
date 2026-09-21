// SEC-1 (ADR-077): endurecimiento de la ventana del renderer.
// - Denegar apertura de ventanas nuevas (window.open / target=_blank).
// - Bloquear navegación fuera del origen propio (o del dev server en desarrollo).
// - Content-Security-Policy restrictiva en producción.
//
// Las funciones puras (contentSecurityPolicy, esNavegacionPermitida) no importan Electron
// —sólo tipos— así se testean bajo el runner de main sin levantar la app.

import type { BrowserWindow } from 'electron';

/**
 * CSP de producción. Permite explícitamente las fuentes de Google que carga el index.html
 * (stylesheet en fonts.googleapis.com, archivos en fonts.gstatic.com) y estilos inline
 * (la UI usa `style={{…}}` y CSS inyectado). NO habilita `unsafe-eval`; bloquea scripts,
 * objetos y frames de terceros.
 */
export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/**
 * ¿Se permite navegar la ventana a `targetUrl`? En desarrollo se admite únicamente el
 * origen del dev server de Vite (para el full-reload del HMR); en producción, sólo el
 * propio archivo (`file:`). Todo lo demás (http/https externos) se bloquea.
 */
export function esNavegacionPermitida(targetUrl: string, devServerUrl?: string | null): boolean {
  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    return false;
  }
  if (devServerUrl) {
    try {
      return target.origin === new URL(devServerUrl).origin;
    } catch {
      return false;
    }
  }
  return target.protocol === 'file:';
}

/** Aplica las tres protecciones sobre la ventana principal. */
export function aplicarSeguridadVentana(
  win: BrowserWindow,
  opts: { isDev: boolean; devServerUrl?: string | null },
): void {
  const wc = win.webContents;

  // Ninguna ventana nueva: la app es single-window.
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Navegación de la ventana entera sólo dentro del origen propio (o del dev server).
  wc.on('will-navigate', (e, url) => {
    if (!esNavegacionPermitida(url, opts.devServerUrl)) e.preventDefault();
  });

  // CSP sólo en producción: en dev rompería el HMR/eval del dev server de Vite.
  if (!opts.isDev) {
    wc.session.webRequest.onHeadersReceived((details, cb) => {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [contentSecurityPolicy()],
        },
      });
    });
  }
}
