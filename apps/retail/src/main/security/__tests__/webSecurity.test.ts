import { describe, it, expect } from 'vitest';
import { contentSecurityPolicy, esNavegacionPermitida } from '@core/main';

describe('contentSecurityPolicy (SEC-1 / ADR-077)', () => {
  const csp = contentSecurityPolicy();

  it('restringe el default a self', () => {
    expect(csp).toMatch(/default-src 'self'/);
  });

  it('las tipografías son self-hosted: sin hosts de Google en el CSP (ADR-089)', () => {
    // ADR-089: las fuentes se bundlean localmente (src/renderer/styles/fonts.css); ya no se
    // depende de Google Fonts en runtime, así que el CSP no debe habilitar esos hosts.
    expect(csp).not.toMatch(/fonts\.googleapis\.com/);
    expect(csp).not.toMatch(/fonts\.gstatic\.com/);
    expect(csp).toMatch(/font-src 'self' data:/);
  });

  it('bloquea objetos y frames de terceros', () => {
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/frame-src 'none'/);
  });

  it('no habilita unsafe-eval', () => {
    expect(csp).not.toMatch(/unsafe-eval/);
  });
});

describe('esNavegacionPermitida (SEC-1 / ADR-077)', () => {
  it('en producción sólo permite el propio archivo (file:)', () => {
    expect(esNavegacionPermitida('file:///C:/app/index.html', null)).toBe(true);
    expect(esNavegacionPermitida('https://evil.example/phishing', null)).toBe(false);
    expect(esNavegacionPermitida('http://localhost:5173/', null)).toBe(false);
  });

  it('en desarrollo permite el origen del dev server de Vite y nada más', () => {
    const dev = 'http://localhost:5173';
    expect(esNavegacionPermitida('http://localhost:5173/index.html', dev)).toBe(true);
    expect(esNavegacionPermitida('https://evil.example/phishing', dev)).toBe(false);
  });

  it('una URL inválida nunca se permite', () => {
    expect(esNavegacionPermitida('no-es-una-url', null)).toBe(false);
  });
});
