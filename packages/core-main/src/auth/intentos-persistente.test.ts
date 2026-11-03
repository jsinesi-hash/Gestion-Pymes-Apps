import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearLimiteIntentos, limiteIntentos, MAX_FALLOS, BLOQUEO_MS, type AlmacenIntentos } from './intentos';
import { crearAlmacenArchivo, activarLockoutPersistente } from './intentos-persistente';
import { limiteSolicitudesRecuperacion } from './recuperacion';

// El límite de intentos vivía solo en memoria: cerrar y abrir la app lo reiniciaba. Ahora se guarda
// en un archivo de userData (ADR-138). Un archivo propio y no la base: es estado operativo local de
// la terminal (como `aviso`) y no hace falta una migración.
let carpeta: string;
let ruta: string;
let ahoraMs: number;
const reloj = () => ahoraMs;

beforeEach(() => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'lockout-'));
  ruta = path.join(carpeta, 'login-lockout.json');
  ahoraMs = new Date('2026-11-03T12:00:00.000Z').getTime();
});
afterEach(() => {
  limiteIntentos.persistirEn(null);
  limiteSolicitudesRecuperacion.persistirEn(null);
  limiteIntentos.reiniciar();
  limiteSolicitudesRecuperacion.reiniciar();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

/** Simula cerrar y volver a abrir la app: un limitador nuevo que carga el mismo archivo. */
function reiniciarApp(almacen: AlmacenIntentos = crearAlmacenArchivo(ruta)) {
  const l = crearLimiteIntentos({ ahora: reloj });
  l.persistirEn(almacen);
  return l;
}

function conAlmacen() {
  const l = crearLimiteIntentos({ ahora: reloj });
  l.persistirEn(crearAlmacenArchivo(ruta));
  return l;
}

describe('límite de intentos persistente', () => {
  it('los fallos sobreviven a un reinicio: dos antes y el tercero después bloquea', () => {
    const a = conAlmacen();
    a.registrarFallo('ana');
    a.registrarFallo('ana');
    const b = reiniciarApp();
    expect(() => b.verificar('ana')).not.toThrow();
    b.registrarFallo('ana');
    expect(() => b.verificar('ana')).toThrow('CUENTA_BLOQUEADA');
  });

  it('un bloqueo sobrevive a un reinicio y informa los segundos que faltan', () => {
    const a = conAlmacen();
    for (let i = 0; i < MAX_FALLOS; i++) a.registrarFallo('ana');
    ahoraMs += 5 * 60 * 1000;
    const b = reiniciarApp();
    expect(() => b.verificar('ana')).toThrow('CUENTA_BLOQUEADA:600');
  });

  it('un bloqueo vencido no se carga', () => {
    const a = conAlmacen();
    for (let i = 0; i < MAX_FALLOS; i++) a.registrarFallo('ana');
    ahoraMs += BLOQUEO_MS + 1000;
    const b = reiniciarApp();
    expect(() => b.verificar('ana')).not.toThrow();
  });

  it('el reloj atrasado no alarga el bloqueo más de lo debido', () => {
    fs.writeFileSync(ruta, JSON.stringify({ ana: { fallos: 3, bloqueadoHasta: ahoraMs + 100 * BLOQUEO_MS } }));
    const b = reiniciarApp();
    expect(() => b.verificar('ana')).toThrow(`CUENTA_BLOQUEADA:${BLOQUEO_MS / 1000}`);
  });

  it('un login correcto borra al usuario del archivo', () => {
    const a = conAlmacen();
    a.registrarFallo('ana');
    a.registrarFallo('beto');
    a.registrarExito('ana');
    expect(Object.keys(JSON.parse(fs.readFileSync(ruta, 'utf8')))).toEqual(['beto']);
  });

  it('reiniciar() vacía el archivo', () => {
    const a = conAlmacen();
    a.registrarFallo('ana');
    a.reiniciar();
    expect(JSON.parse(fs.readFileSync(ruta, 'utf8'))).toEqual({});
  });

  it('cuando un bloqueo vence, verificar() lo saca del archivo', () => {
    const a = conAlmacen();
    for (let i = 0; i < MAX_FALLOS; i++) a.registrarFallo('ana');
    ahoraMs += BLOQUEO_MS + 1000;
    a.verificar('ana');
    expect(JSON.parse(fs.readFileSync(ruta, 'utf8'))).toEqual({});
  });

  it('los usuarios no se mezclan entre sí', () => {
    const a = conAlmacen();
    for (let i = 0; i < MAX_FALLOS; i++) a.registrarFallo('ana');
    a.registrarFallo('beto');
    const b = reiniciarApp();
    expect(() => b.verificar('ana')).toThrow('CUENTA_BLOQUEADA');
    expect(() => b.verificar('beto')).not.toThrow();
  });

  it('un fallo durante un bloqueo vigente no lo extiende, tampoco tras un reinicio', () => {
    const a = conAlmacen();
    for (let i = 0; i < MAX_FALLOS; i++) a.registrarFallo('ana');
    const antes = JSON.parse(fs.readFileSync(ruta, 'utf8')).ana.bloqueadoHasta;
    ahoraMs += 60 * 1000;
    const b = reiniciarApp();
    b.registrarFallo('ana');
    expect(JSON.parse(fs.readFileSync(ruta, 'utf8')).ana.bloqueadoHasta).toBe(antes);
  });
});

describe('robustez del archivo', () => {
  it('sin archivo arranca vacío', () => {
    expect(() => reiniciarApp().verificar('ana')).not.toThrow();
  });

  it('un archivo corrupto arranca vacío y no lanza', () => {
    fs.writeFileSync(ruta, '{ esto no es json');
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => reiniciarApp().verificar('ana')).not.toThrow();
    aviso.mockRestore();
  });

  it('un archivo que no es un objeto arranca vacío', () => {
    fs.writeFileSync(ruta, '[1, 2, 3]');
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => reiniciarApp().verificar('ana')).not.toThrow();
    aviso.mockRestore();
  });

  it('las entradas con forma inválida se ignoran y las válidas se conservan', () => {
    fs.writeFileSync(ruta, JSON.stringify({
      malo1: { fallos: 'tres', bloqueadoHasta: 1 },
      malo2: { fallos: -1, bloqueadoHasta: 0 },
      malo3: null,
      malo4: { fallos: 2 },
      bueno: { fallos: 3, bloqueadoHasta: ahoraMs + 60 * 1000 },
    }));
    const b = reiniciarApp();
    expect(() => b.verificar('bueno')).toThrow('CUENTA_BLOQUEADA');
    for (const k of ['malo1', 'malo2', 'malo3', 'malo4']) expect(() => b.verificar(k)).not.toThrow();
  });

  it('si guardar falla, el login sigue andando (solo se registra el error)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const roto: AlmacenIntentos = { cargar: () => ({}), guardar: () => { throw new Error('disco lleno'); } };
    const l = reiniciarApp(roto);
    expect(() => { l.registrarFallo('ana'); l.registrarExito('ana'); l.reiniciar(); }).not.toThrow();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('si cargar falla, arranca vacío', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const roto: AlmacenIntentos = { cargar: () => { throw new Error('sin permiso'); }, guardar: () => {} };
    expect(() => reiniciarApp(roto).verificar('ana')).not.toThrow();
    error.mockRestore();
  });

  it('persistirEn(null) desconecta: dejan de escribirse cambios', () => {
    const a = conAlmacen();
    a.registrarFallo('ana');
    const antes = fs.readFileSync(ruta, 'utf8');
    a.persistirEn(null);
    a.registrarFallo('beto');
    expect(fs.readFileSync(ruta, 'utf8')).toBe(antes);
  });
});

describe('crearAlmacenArchivo', () => {
  it('crea la carpeta si no existe y escribe JSON legible', () => {
    const profunda = path.join(carpeta, 'a', 'b', 'x.json');
    crearAlmacenArchivo(profunda).guardar({ ana: { fallos: 1, bloqueadoHasta: 0 } });
    expect(JSON.parse(fs.readFileSync(profunda, 'utf8'))).toEqual({ ana: { fallos: 1, bloqueadoHasta: 0 } });
  });

  it('escribe de forma atómica: no deja archivos temporales', () => {
    crearAlmacenArchivo(ruta).guardar({ ana: { fallos: 1, bloqueadoHasta: 0 } });
    expect(fs.readdirSync(carpeta)).toEqual(['login-lockout.json']);
  });

  it('guardar y cargar son inversos', () => {
    const almacen = crearAlmacenArchivo(ruta);
    const estados = { ana: { fallos: 2, bloqueadoHasta: 0 }, beto: { fallos: 3, bloqueadoHasta: 123456 } };
    almacen.guardar(estados);
    expect(almacen.cargar()).toEqual(estados);
  });
});

describe('activarLockoutPersistente', () => {
  it('conecta el límite de login y el de pedidos de recuperación a archivos de la carpeta', () => {
    activarLockoutPersistente({ carpeta });
    limiteIntentos.registrarFallo('ana');
    limiteSolicitudesRecuperacion.registrarFallo('ana');
    expect(Object.keys(JSON.parse(fs.readFileSync(path.join(carpeta, 'login-lockout.json'), 'utf8')))).toEqual(['ana']);
    expect(Object.keys(JSON.parse(fs.readFileSync(path.join(carpeta, 'recuperacion-pedidos.json'), 'utf8')))).toEqual(['ana']);
  });

  it('carga lo que ya había en la carpeta', () => {
    fs.writeFileSync(path.join(carpeta, 'login-lockout.json'), JSON.stringify({
      ana: { fallos: 3, bloqueadoHasta: Date.now() + 60 * 1000 },
    }));
    activarLockoutPersistente({ carpeta });
    expect(() => limiteIntentos.verificar('ana')).toThrow('CUENTA_BLOQUEADA');
  });
});
