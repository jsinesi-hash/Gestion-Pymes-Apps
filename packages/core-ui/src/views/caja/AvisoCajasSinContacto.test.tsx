import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { configurarBridge } from '../../bridge';
import { AvisoCajasSinContacto, cajasSinContacto } from './AvisoCajasSinContacto';

// F3 PR5 (ADR-155 §4): al cerrar un turno compartido, la pantalla avisa qué cajas no se comunican con el hub:
// sus movimientos todavía no llegaron. Cerrar igual es decisión de quien cierra.
configurarBridge('appDePrueba');

const AHORA_S = 1_800_000_000;
const caja = (origin_id: string, ultimo_contacto: number | null, extra: Record<string, unknown> = {}) =>
  ({ origin_id, nombre: `Caja ${origin_id}`, emparejada_en: 1, revocada_en: null, ultimo_contacto, version_protocolo: 2, version_esquema: 64, ...extra });

describe('cajasSinContacto', () => {
  it('las otras cajas sin contacto hace más de un minuto; no esta ni las revocadas', () => {
    const lista = [
      caja('C1', AHORA_S - 5),          // esta caja
      caja('C2', AHORA_S - 30),         // al día
      caja('C3', AHORA_S - 600),        // hace 10 minutos
      caja('C4', null),                 // nunca se conectó
      caja('C5', AHORA_S - 900, { revocada_en: 5 }),
    ];
    expect(cajasSinContacto(lista as any, 'C1', AHORA_S * 1000).map((c) => c.origin_id)).toEqual(['C3', 'C4']);
  });
});

describe('AvisoCajasSinContacto', () => {
  afterEach(() => { delete (globalThis as any).appDePrueba; vi.restoreAllMocks(); });

  function montar(modo: 'compartida' | 'por_terminal', cajas: unknown[]) {
    (globalThis as any).appDePrueba = { sync: {
      cajaModo: vi.fn().mockResolvedValue({ modo, disponible: true }),
      estado: vi.fn().mockResolvedValue({ modo: 'distribuido', origin_id: 'C1' }),
      terminales: vi.fn().mockResolvedValue(cajas),
    } };
    render(<AvisoCajasSinContacto ahoraMs={AHORA_S * 1000} />);
  }

  it('con caja compartida, lista las cajas sin contacto', async () => {
    montar('compartida', [caja('C1', AHORA_S), caja('C3', AHORA_S - 600)]);
    const aviso = await screen.findByRole('note');
    expect(aviso).toHaveTextContent('Caja C3');
    expect(aviso).toHaveTextContent(/todavía no llegaron/);
  });

  it('con caja por terminal, o con todas al día, no muestra nada', async () => {
    montar('por_terminal', [caja('C3', AHORA_S - 600)]);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('sin conexión con el hub tampoco rompe la pantalla de cierre', async () => {
    (globalThis as any).appDePrueba = { sync: {
      cajaModo: vi.fn().mockResolvedValue({ modo: 'compartida', disponible: true }),
      estado: vi.fn().mockResolvedValue({ modo: 'distribuido', origin_id: 'C1' }),
      terminales: vi.fn().mockRejectedValue(new Error('HUB_INALCANZABLE')),
    } };
    render(<AvisoCajasSinContacto ahoraMs={AHORA_S * 1000} />);
    expect(await screen.findByRole('note')).toHaveTextContent(/No se pudo consultar/);
  });
});
