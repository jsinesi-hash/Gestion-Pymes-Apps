import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import { configurarBridge } from '../bridge';
import { IndicadorSync, estadoIndicador } from './IndicadorSync';

// F3 PR3 (análisis §4): cada caja emparejada muestra en la barra superior en qué estado está su
// sincronización, sin entrar a Configuración. El estado sale del cliente de sync local (sin pedirle más
// al hub); los conflictos pendientes se consultan al hub cada minuto y solo para quien puede resolverlos.
configurarBridge('appDePrueba');

const sync = {
  enLinea: true as boolean | null, ultimoError: null, ultimoPushMs: 1_700_000_000_000, ultimoPullMs: 1_700_000_001_000,
  pendientes: 0, cursor: 10, desfasajeMs: 0, relojDesfasado: false, versionesHub: null as { protocolo: number; esquema: number } | null, recibidosEnEspera: 0,
};
const distribuido = { modo: 'distribuido', origin_id: 'C2', hub: { url: 'https://hub', huella: 'AA', nombre: 'Caja 2', emparejado_en: 1 }, sync, coordinadora: false, series: [] } as const;
const con = (s: Partial<typeof sync>) => ({ ...distribuido, sync: { ...sync, ...s } }) as any;

describe('estadoIndicador: qué muestra y en qué orden', () => {
  it('en standalone no muestra nada', () => {
    expect(estadoIndicador({ ...distribuido, modo: 'standalone', hub: null, sync: null } as any, 0)).toBeNull();
  });

  it('del más grave al menos grave', () => {
    const todo = con({ versionesHub: { protocolo: 3, esquema: 70 }, enLinea: false, relojDesfasado: true, pendientes: 4, recibidosEnEspera: 2 });
    expect(estadoIndicador(todo, 3)).toMatchObject({ nivel: 'error', texto: 'Versión distinta del hub' });
    expect(estadoIndicador({ ...todo, sync: { ...todo.sync, versionesHub: null } }, 3)).toMatchObject({ nivel: 'error', texto: 'Sin conexión' });
    expect(estadoIndicador(con({ relojDesfasado: true, pendientes: 4 }), 3)).toMatchObject({ nivel: 'aviso', texto: 'Reloj desfasado' });
    expect(estadoIndicador(con({ pendientes: 4, recibidosEnEspera: 2 }), 3)).toMatchObject({ nivel: 'aviso', texto: '3 conflictos', destino: '/config/conflictos' });
    expect(estadoIndicador(con({ pendientes: 4, recibidosEnEspera: 2 }), 0)).toMatchObject({ nivel: 'aviso', texto: '2 cambios en espera' });
    expect(estadoIndicador(con({ pendientes: 4 }), 0)).toMatchObject({ nivel: 'info', texto: '4 sin subir' });
    expect(estadoIndicador(con({}), 0)).toMatchObject({ nivel: 'ok', texto: 'Sincronizada' });
  });

  it('sin conexión dice desde cuándo; un conflicto va en singular', () => {
    expect(estadoIndicador(con({ enLinea: false }), 0)!.detalle).toMatch(/Último contacto con el hub:/);
    expect(estadoIndicador(con({}), 1)!.texto).toBe('1 conflicto');
  });

  it('todavía sin respuesta del hub, o sin poder leer sus datos', () => {
    expect(estadoIndicador(con({ enLinea: null }), 0)).toMatchObject({ nivel: 'info', texto: 'Conectando…' });
    expect(estadoIndicador({ ...distribuido, sync: null } as any, 0)).toMatchObject({ nivel: 'error', texto: 'Sin sincronizar' });
  });
});

describe('IndicadorSync', () => {
  afterEach(() => { delete (globalThis as any).appDePrueba; vi.useRealTimers(); vi.restoreAllMocks(); });

  function montar(permisos: string[], estado: unknown, conflictos = 0) {
    const puente = {
      estado: vi.fn().mockResolvedValue(estado),
      conflictos: vi.fn().mockResolvedValue({ conflictos: Array.from({ length: conflictos }, (_, i) => ({ id: i })), hayMas: false, enEspera: 0 }),
    };
    (globalThis as any).appDePrueba = { sync: puente };
    const can = (c: string) => permisos.includes(c);
    render(
      <AuthContext.Provider value={{ can } as any}>
        <MemoryRouter initialEntries={['/pos']}>
          <IndicadorSync />
          <Routes>
            <Route path="/pos" element={<div>POS</div>} />
            <Route path="/config/sincronizacion" element={<div>Pantalla de sincronización</div>} />
            <Route path="/config/conflictos" element={<div>Pantalla de conflictos</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    return puente;
  }

  it('en standalone no se dibuja', async () => {
    const puente = montar(['usuario.administrar'], { ...distribuido, modo: 'standalone', hub: null, sync: null });
    await act(async () => { await Promise.resolve(); });
    expect(puente.estado).toHaveBeenCalled();
    expect(screen.queryByTestId('indicador-sync')).toBeNull();
  });

  it('un administrador va a Sincronización con un clic', async () => {
    montar(['usuario.administrar'], con({ pendientes: 2 }));
    fireEvent.click(await screen.findByRole('button', { name: /2 sin subir/ }));
    expect(screen.getByText('Pantalla de sincronización')).toBeInTheDocument();
  });

  it('con conflictos y el permiso, muestra cuántos y lleva a Conflictos', async () => {
    const puente = montar(['usuario.administrar', 'sync.conflictos'], con({}), 2);
    fireEvent.click(await screen.findByRole('button', { name: /2 conflictos/ }));
    expect(screen.getByText('Pantalla de conflictos')).toBeInTheDocument();
    expect(puente.conflictos).toHaveBeenCalledWith({ pendientes: true, limite: 50 });
  });

  it('un operador ve el estado pero no es un botón, y no se le consultan conflictos', async () => {
    const puente = montar([], con({ enLinea: false }));
    const chip = await screen.findByTestId('indicador-sync');
    expect(chip).toHaveTextContent('Sin conexión');
    expect(screen.queryByRole('button', { name: /Sin conexión/ })).toBeNull();
    expect(puente.conflictos).not.toHaveBeenCalled();
  });

  it('se actualiza solo cada pocos segundos', async () => {
    vi.useFakeTimers();
    const puente = montar([], con({ pendientes: 1 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(puente.estado).toHaveBeenCalledTimes(1);
    puente.estado.mockResolvedValue(con({}));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(puente.estado).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('indicador-sync')).toHaveTextContent('Sincronizada');
  });
});
