import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProfileProvider, AuthContext } from '@core/ui';
import { navegacionRetail } from '../../../common/navegacion';
import { RetailShell } from './RetailShell';

// B5: AppShell (y las hooks useInicioPersonalizableHabilitado/usePreferencias) viven ahora en
// @core/ui y leen useAuth / bridge() por import relativo, así que un vi.mock del barrel
// '@core/ui' NO los intercepta (lección B3). En su lugar:
//  - la sesión se provee con el AuthContext real (AuthContext.Provider),
//  - el flag inicio_personalizable_habilitado y las preferencias se manejan por el bridge
//    stub (globalThis.ferreteria) que ya usa el resto del archivo.
const mockCan = vi.fn(() => true);
let mockRolNombre = 'SUPERVISOR';
let mockFavoritos: string[] = [];
let inicioPersonalizable = false;
const saveSpy = vi.fn().mockResolvedValue(undefined);
const actualizarPreferencias = vi.fn();

function authValue() {
  return {
    can: mockCan,
    session: { id: 'u1', nombreCompleto: 'Admin', rolNombre: mockRolNombre, preferencias: { favoritos: mockFavoritos, pantalla_inicio: null } },
    login: vi.fn(),
    logout: vi.fn(),
    actualizarPreferencias,
  } as any;
}

let remitosHabilitado = true;
vi.mock('../../hooks/useRemitos', () => ({
  useRemitosHabilitado: () => remitosHabilitado,
}));

let motorV2 = false;
vi.mock('../../hooks/useMotorPrecios', () => ({
  useMotorPreciosV2Habilitado: () => motorV2,
}));

let hubPrecios = false;
vi.mock('../../hooks/useHubPrecios', () => ({
  useHubPreciosHabilitado: () => hubPrecios,
}));

// Bridge base: el flag de inicio personalizable se lee de `inicioPersonalizable` y las
// preferencias se guardan en `saveSpy`. Los tests de depuración/actualización re-asignan
// globalThis.ferreteria con spread, conservando estas claves.
beforeEach(() => {
  (globalThis as any).ferreteria = {
    parametros: {
      get: ({ clave }: { clave: string }) =>
        Promise.resolve(clave === 'inicio_personalizable_habilitado' ? (inicioPersonalizable ? 'true' : 'false') : null),
    },
    preferencias: { get: () => Promise.resolve(null), save: saveSpy },
  };
});

afterEach(() => {
  delete (globalThis as any).ferreteria;
});

function renderEn(ruta: string) {
  return render(
    <AuthContext.Provider value={authValue()}>
      <AppProfileProvider value={{ nombreApp: 'Ferretería', navegacion: navegacionRetail }}>
        <MemoryRouter initialEntries={[ruta]}>
          <RetailShell />
        </MemoryRouter>
      </AppProfileProvider>
    </AuthContext.Provider>,
  );
}

/** Consultas acotadas al sidebar. NAV-1 (ADR-077) agregó un breadcrumb jerárquico en el
 * header cuyas etiquetas de grupo ("Catálogo", "Facturación"…) coinciden con los headers
 * del sidebar; estas aserciones son sobre la estructura del menú, así que se acotan a él. */
function side() {
  return within(document.querySelector('nav.side') as HTMLElement);
}

/** Devuelve el <a> del menu cuyo texto es exactamente `label`. */
function navLink(label: string): HTMLAnchorElement {
  const spans = screen.getAllByText(label);
  const link = spans.map((s) => s.closest('a')).find(Boolean);
  if (!link) throw new Error(`no se encontro el link "${label}"`);
  return link as HTMLAnchorElement;
}

/** Devuelve el <button> de header de grupo cuyo texto es exactamente `label`. */
function groupHeader(label: string): HTMLButtonElement {
  const spans = screen.getAllByText(label);
  const btn = spans.map((s) => s.closest('button')).find(Boolean);
  if (!btn) throw new Error(`no se encontro el header de grupo "${label}"`);
  return btn as HTMLButtonElement;
}

describe('AppShell — resaltado del menu', () => {
  it('en /remitos/transportistas resalta Transportistas y NO Remitos', () => {
    renderEn('/remitos/transportistas');

    expect(navLink('Transportistas').className).toMatch(/active/);
    // /remitos es prefijo de /remitos/transportistas: sin `end` se encenderian los dos.
    expect(navLink('Remitos').className).not.toMatch(/active/);
  });

  it('en /remitos resalta Remitos', () => {
    renderEn('/remitos');



    expect(navLink('Remitos').className).toMatch(/active/);
    expect(navLink('Transportistas').className).not.toMatch(/active/);
  });
});

describe('AppShell — grupo Precios (ADR-049 §10)', () => {
  it('con ambos flags apagados, Listas de precios cae en Sistema (fallback NAV-3), no en Configuración', () => {
    motorV2 = false; hubPrecios = false;
    renderEn('/config/listas-de-precios');
    expect(screen.queryByText('Precios')).not.toBeInTheDocument();
    const listas = navLink('Listas de precios');
    const sistemaHeader = groupHeader('Sistema');
    // eslint-disable-next-line no-bitwise
    expect(sistemaHeader.compareDocumentPosition(listas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('con el flag encendido, aparece el grupo Precios / Costos con sus ítems', () => {
    motorV2 = true;
    renderEn('/config/listas-de-precios');
    expect(side().getByText('Precios / Costos')).toBeInTheDocument();
    expect(navLink('Listas de precios')).toBeTruthy();
    expect(navLink('Importar costos')).toBeTruthy();
    motorV2 = false;
  });

  it('con el flag encendido, Precios / Costos aparece después de Abastecimiento (no donde iría Configuración)', () => {
    motorV2 = true;
    renderEn('/config/listas-de-precios');
    const abastecimiento = screen.getByRole('button', { name: /abastecimiento/i });
    const precios = screen.getByRole('button', { name: /^precios \/ costos$/i });
    // eslint-disable-next-line no-bitwise
    expect(abastecimiento.compareDocumentPosition(precios) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    motorV2 = false;
  });
});

describe('AppShell — orden del sidebar (ajuste post-ADR-051)', () => {
  /** Grupos multi-ítem se renderizan como <button> "nav-group-header"; evita ambigüedad
   * con ítems hijos que comparten texto con su grupo (ej. "Clientes"). */
  function groupHeader(label: string) {
    return screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') });
  }

  it('respeta el orden combinado (Fase 3 + ADR-051 §8): Punto de venta, Facturación (con Caja), Catálogo (con Stock), Abastecimiento, Clientes, Reportes, Configuración, Sistema', () => {
    renderEn('/pos');
    // Fusión de dos decisiones de PO tomadas en ramas paralelas sin verse: se mantiene
    // el agrupamiento de Fase 3 (Caja vive en Facturación, Stock vive en Catálogo — ya
    // no son grupos standalone de un solo ítem) pero reposicionado cerca del principio
    // del sidebar, como pedía ADR-051 §8. Ver comentario en AppShell.tsx sobre NAV_GROUPS.
    // Agenda queda fuera de esta verificación: su hook (useAgendaHabilitado) no está
    // mockeado en este archivo y su default (false, sin IPC) lo oculta del sidebar acá.
    const puntoDeVenta = navLink('POS');
    const nodes = [
      puntoDeVenta,
      groupHeader('Facturación'), groupHeader('Catálogo'),
      groupHeader('Abastecimiento'), groupHeader('Clientes'), groupHeader('Reportes'),
      groupHeader('Configuración'), groupHeader('Sistema'),
    ];
    for (let i = 0; i < nodes.length - 1; i++) {
      // eslint-disable-next-line no-bitwise
      expect(nodes[i].compareDocumentPosition(nodes[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('"Importar datos" vive en Configuración (ADR-083), no en Sistema', () => {
    renderEn('/pos');
    const link = navLink('Importar datos');
    const configHeader = groupHeader('Configuración');
    const sistemaHeader = groupHeader('Sistema');
    // ADR-083 revirtió ADR-080 (NAV-3): "Importar datos" volvió a Configuración, como
    // primer ítem del grupo. Ahora: Configuración < Importar datos < Sistema.
    // eslint-disable-next-line no-bitwise
    expect(configHeader.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // eslint-disable-next-line no-bitwise
    expect(link.compareDocumentPosition(sistemaHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('AppShell — ADR-055: renombre POS y orden de Abastecimiento', () => {
  it('el sub-ítem de Punto de venta se muestra como "POS" (ya no "Punto de venta")', () => {
    renderEn('/pos');
    expect(navLink('POS')).toBeTruthy();
    expect(side().queryByText('Punto de venta')).not.toBeInTheDocument();
  });

  it('Proveedores aparece por encima de Órdenes de compra', () => {
    renderEn('/compras/proveedores');
    const proveedores = navLink('Proveedores');
    const ordenes = navLink('Órdenes de compra');
    // eslint-disable-next-line no-bitwise
    expect(proveedores.compareDocumentPosition(ordenes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('AppShell — Fase 3 (ajustes-varios): reorganización de menú', () => {
  afterEach(() => {
    remitosHabilitado = true;
  });

  it('Caja vive dentro del grupo Facturación (junto a Remitos), no como grupo propio', () => {
    renderEn('/caja');
    expect(side().getByText('Facturación')).toBeInTheDocument();
    expect(navLink('Caja')).toBeTruthy();
    expect(navLink('Remitos')).toBeTruthy();
  });

  it('con remitos_habilitado apagado, Caja sigue visible como link directo (no depende del flag de Remitos)', () => {
    remitosHabilitado = false;
    renderEn('/caja');
    // El grupo Facturación queda con un solo item visible (Caja) y se renderiza como
    // link directo, sin header de grupo — igual que el resto de los grupos de un solo item.
    expect(side().queryByText('Facturación')).not.toBeInTheDocument();
    expect(navLink('Caja')).toBeTruthy();
    expect(side().queryByText('Remitos')).not.toBeInTheDocument();
  });

  it('Stock vive dentro del grupo Catálogo (junto a Productos), no como grupo propio', () => {
    renderEn('/stock');
    expect(side().getByText('Catálogo')).toBeInTheDocument();
    expect(navLink('Stock')).toBeTruthy();
    expect(navLink('Productos')).toBeTruthy();
  });

  it('ADR-064: el ítem "Ubicaciones" vive en Configuración (reintroducido tras ADR-053)', () => {
    renderEn('/config/unidades');
    expect(navLink('Ubicaciones').getAttribute('href')).toBe('/config/ubicaciones');
  });

  it('Transportistas vive dentro del grupo Configuración, ya no en Facturación', () => {
    renderEn('/remitos/transportistas');
    expect(screen.getByText('Configuración')).toBeInTheDocument();
    expect(navLink('Transportistas').className).toMatch(/active/);
  });

  it('en /remitos/transportistas NO se enciende el header de Facturación (ex-hermano por prefijo de ruta)', () => {
    renderEn('/remitos/transportistas');
    expect(groupHeader('Facturación').className).not.toMatch(/active/);
    expect(groupHeader('Configuración').className).toMatch(/active/);
  });
});

describe('AppShell — ADR-056: menú Precios / Costos', () => {
  afterEach(() => { motorV2 = false; });

  function antesQue(a: HTMLElement, b: HTMLElement) {
    // eslint-disable-next-line no-bitwise
    return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  it('el grupo se llama "Precios / Costos"', () => {
    motorV2 = true;
    renderEn('/precios/lotes');
    expect(screen.getByRole('button', { name: /^precios \/ costos$/i })).toBeInTheDocument();
  });

  it('"Importar catálogo prov." se renombró a "Importar Catálogo del Proveedor"', () => {
    motorV2 = true;
    renderEn('/precios/lotes');
    expect(navLink('Importar Catálogo del Proveedor')).toBeTruthy();
    expect(screen.queryByText('Importar catálogo prov.')).not.toBeInTheDocument();
  });

  it('"Importar costos" quedó entre "Lotes de precios" e "Importar Catálogo del Proveedor"', () => {
    motorV2 = true;
    renderEn('/precios/lotes');
    const lotes = navLink('Lotes de precios');
    const costos = navLink('Importar costos');
    const catalogo = navLink('Importar Catálogo del Proveedor');
    expect(antesQue(lotes, costos)).toBeTruthy();
    expect(antesQue(costos, catalogo)).toBeTruthy();
  });

  it('el submenú "Revisión e Historial..." se renombró a "Revisión de Costos y Catálogo"', () => {
    motorV2 = true;
    renderEn('/precios/lotes');
    expect(navLink('Revisión de Costos y Catálogo')).toBeTruthy();
    expect(screen.queryByText('Revisión e Historial de Costos y Catálogo')).not.toBeInTheDocument();
  });
});

describe('AppShell — hub Precios y Costos (PRICE-1, ADR-078)', () => {
  afterEach(() => { hubPrecios = false; });

  it('con el flag encendido, aparece un único ítem "Precios y Costos" → /precios/hub y desaparecen los 4 ítems dispersos de Configuración', () => {
    hubPrecios = true;
    renderEn('/config/unidades');
    const link = navLink('Precios y Costos');
    expect(link.getAttribute('href')).toBe('/precios/hub');
    expect(screen.queryByText('Listas de precios')).not.toBeInTheDocument();
    expect(screen.queryByText('Importar costos')).not.toBeInTheDocument();
    expect(screen.queryByText('Importar Catálogo del Proveedor')).not.toBeInTheDocument();
    expect(screen.queryByText('Revisión de Costos y Catálogo')).not.toBeInTheDocument();
  });

  it('con hub y motor apagados, los 4 ítems de precios caen en Sistema (fallback NAV-3)', () => {
    hubPrecios = false; motorV2 = false;
    renderEn('/config/unidades');
    expect(screen.queryByText('Precios y Costos')).not.toBeInTheDocument();
    const sistemaHeader = screen.getByRole('button', { name: /^sistema$/i });
    for (const label of ['Listas de precios', 'Importar costos', 'Importar Catálogo del Proveedor', 'Revisión de Costos y Catálogo']) {
      const link = navLink(label);
      // eslint-disable-next-line no-bitwise
      expect(sistemaHeader.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('con hub_precios y motor_v2 ambos on, el hub gana (ítem único, sin "Lotes de precios")', async () => {
    hubPrecios = true;
    motorV2 = true;
    renderEn('/config/unidades');
    await waitFor(() => {
      expect(navLink('Precios y Costos')).toBeTruthy();
    });
    const link = navLink('Precios y Costos');
    expect(link.getAttribute('href')).toBe('/precios/hub');
    // Ni el grupo "Precios / Costos" del motor v2 ni sus ítems (p. ej. "Lotes de precios")...
    expect(screen.queryByText('Precios / Costos')).not.toBeInTheDocument();
    expect(screen.queryByText('Lotes de precios')).not.toBeInTheDocument();
    // ...ni los ítems dispersos de Configuración que reemplazaba el motor v2.
    expect(screen.queryByText('Listas de precios')).not.toBeInTheDocument();
    expect(screen.queryByText('Importar costos')).not.toBeInTheDocument();
    expect(screen.queryByText('Importar Catálogo del Proveedor')).not.toBeInTheDocument();
    expect(screen.queryByText('Revisión de Costos y Catálogo')).not.toBeInTheDocument();
    motorV2 = false;
  });
});

describe('AppShell — ADR-056: orden del grupo Configuración', () => {
  function antesQue(a: HTMLElement, b: HTMLElement) {
    // eslint-disable-next-line no-bitwise
    return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  it('"Etiquetas" es el primer ítem del grupo Configuración', () => {
    renderEn('/etiquetas');
    const etiquetas = navLink('Etiquetas');
    const categorias = navLink('Categorías');
    expect(antesQue(etiquetas, categorias)).toBeTruthy();
  });

  it('"Transportistas" está inmediatamente debajo de "Unidades"', () => {
    renderEn('/config/unidades');
    const unidades = navLink('Unidades');
    const transportistas = navLink('Transportistas');
    const listas = navLink('Listas de precios');
    expect(antesQue(unidades, transportistas)).toBeTruthy();
    expect(antesQue(transportistas, listas)).toBeTruthy();
  });
});

describe('AppShell — ADR-069: Sinónimos en Configuración', () => {
  it('"Sinónimos" vive en Configuración, debajo de Ubicaciones', () => {
    renderEn('/config/sinonimos');
    const configHeader = groupHeader('Configuración');
    const sistemaHeader = groupHeader('Sistema');
    const sinonimos = navLink('Sinónimos');
    const ubicaciones = navLink('Ubicaciones');
    // dentro de Configuración: después del header de Configuración y antes del de Sistema
    // eslint-disable-next-line no-bitwise
    expect(configHeader.compareDocumentPosition(sinonimos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // eslint-disable-next-line no-bitwise
    expect(sinonimos.compareDocumentPosition(sistemaHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // inmediatamente después de Ubicaciones
    // eslint-disable-next-line no-bitwise
    expect(ubicaciones.compareDocumentPosition(sinonimos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('AppShell — depuración de backups al arranque (ADR-076 Tarea 11)', () => {
  it('al montar como Supervisor con candidatos, muestra el modal de depuración', async () => {
    (globalThis as any).ferreteria = {
      ...((globalThis as any).ferreteria ?? {}),
      backup: {
        evaluarDepuracion: vi.fn().mockResolvedValue({
          candidatos: [{ ruta: '/A/x.fbk', nombre: 'x.fbk', tamano_bytes: 1048576, fecha: '2026-01-01T00:00:00-03:00', tipo: 'auto', incluye_certs: false, cifrado: false, app_version: '1.0.0' }],
          protegidos: [], bytesALiberar: 1048576, porCarpeta: {},
        }),
        depurar: vi.fn(),
      },
    };
    renderEn('/pos');
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /depurar backups/i })).toBeInTheDocument();
    });
  });
});

describe('AppShell — actualización propuesta al login del Supervisor', () => {
  afterEach(() => { mockRolNombre = 'SUPERVISOR'; mockCan.mockImplementation(() => true); });

  it('ADR-146: un rol con otro nombre pero con config.fiscal también ve la propuesta', async () => {
    mockRolNombre = 'ENCARGADO';
    (globalThis as any).ferreteria = {
      ...((globalThis as any).ferreteria ?? {}),
      backup: { evaluarDepuracion: vi.fn().mockResolvedValue({ candidatos: [], protegidos: [], bytesALiberar: 0, porCarpeta: {} }), depurar: vi.fn() },
      actualizacion: {
        estado: vi.fn().mockResolvedValue({ estado: 'downloaded', version: '1.2.0', mensaje: null }),
        notasPostUpdate: vi.fn().mockResolvedValue(null),
        instalarYReiniciar: vi.fn(),
        marcarVersionVista: vi.fn(),
      },
    };
    renderEn('/pos');
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /actualización disponible/i })).toBeInTheDocument();
    });
  });

  it('con Supervisor y estado downloaded, muestra el modal de propuesta', async () => {
    (globalThis as any).ferreteria = {
      ...((globalThis as any).ferreteria ?? {}),
      backup: { evaluarDepuracion: vi.fn().mockResolvedValue({ candidatos: [], protegidos: [], bytesALiberar: 0, porCarpeta: {} }), depurar: vi.fn() },
      actualizacion: {
        estado: vi.fn().mockResolvedValue({ estado: 'downloaded', version: '1.2.0', mensaje: null }),
        notasPostUpdate: vi.fn().mockResolvedValue(null),
        instalarYReiniciar: vi.fn(),
        marcarVersionVista: vi.fn(),
      },
    };
    renderEn('/pos');
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /actualización disponible/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/1\.2\.0/)).toBeInTheDocument();
  });

  it('con Operador NO muestra el modal de propuesta aunque haya update descargada', async () => {
    mockRolNombre = 'OPERADOR';
    // ADR-146: lo decide el permiso config.fiscal, no el nombre del rol.
    mockCan.mockImplementation(((c: string) => c !== 'config.fiscal') as never);
    (globalThis as any).ferreteria = {
      ...((globalThis as any).ferreteria ?? {}),
      backup: { evaluarDepuracion: vi.fn().mockResolvedValue({ candidatos: [], protegidos: [], bytesALiberar: 0, porCarpeta: {} }), depurar: vi.fn() },
      actualizacion: {
        estado: vi.fn().mockResolvedValue({ estado: 'downloaded', version: '1.2.0', mensaje: null }),
        notasPostUpdate: vi.fn().mockResolvedValue(null),
        instalarYReiniciar: vi.fn(),
        marcarVersionVista: vi.fn(),
      },
    };
    renderEn('/pos');
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('dialog', { name: /actualización disponible/i })).not.toBeInTheDocument();
  });

  it('muestra el modal de novedades cuando notasPostUpdate devuelve datos', async () => {
    (globalThis as any).ferreteria = {
      ...((globalThis as any).ferreteria ?? {}),
      backup: { evaluarDepuracion: vi.fn().mockResolvedValue({ candidatos: [], protegidos: [], bytesALiberar: 0, porCarpeta: {} }), depurar: vi.fn() },
      actualizacion: {
        estado: vi.fn().mockResolvedValue({ estado: 'idle', version: null, mensaje: null }),
        notasPostUpdate: vi.fn().mockResolvedValue({ version: '1.1.0', titulo: 'Novedades 1.1.0', notas: ['Remitos'] }),
        instalarYReiniciar: vi.fn(),
        marcarVersionVista: vi.fn(),
      },
    };
    renderEn('/pos');
    let dialog: HTMLElement;
    await waitFor(() => {
      dialog = screen.getByRole('dialog', { name: /novedades de la versión/i });
      expect(dialog).toBeInTheDocument();
    });
    // Se busca dentro del modal: "Remitos" también aparece como link del sidebar en /pos.
    expect(within(dialog!).getByText('Remitos')).toBeInTheDocument();
  });

  it('cuando hay depuración pendiente Y novedades, solo se muestra la depuración (no se apilan)', async () => {
    (globalThis as any).ferreteria = {
      ...((globalThis as any).ferreteria ?? {}),
      backup: {
        evaluarDepuracion: vi.fn().mockResolvedValue({
          candidatos: [{ ruta: '/A/x.fbk', nombre: 'x.fbk', tamano_bytes: 1048576, fecha: '2026-01-01T00:00:00-03:00', tipo: 'auto', incluye_certs: false, cifrado: false, app_version: '1.0.0' }],
          protegidos: [], bytesALiberar: 1048576, porCarpeta: {},
        }),
        depurar: vi.fn(),
      },
      actualizacion: {
        estado: vi.fn().mockResolvedValue({ estado: 'idle', version: null, mensaje: null }),
        notasPostUpdate: vi.fn().mockResolvedValue({ version: '1.1.0', titulo: 'Novedades 1.1.0', notas: ['Remitos'] }),
        instalarYReiniciar: vi.fn(),
        marcarVersionVista: vi.fn(),
      },
    };
    renderEn('/pos');
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /depurar backups/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog', { name: /novedades de la versión/i })).not.toBeInTheDocument();
  });

  it('al posponer ("Ahora no") se cierra el modal de propuesta', async () => {
    (globalThis as any).ferreteria = {
      ...((globalThis as any).ferreteria ?? {}),
      backup: { evaluarDepuracion: vi.fn().mockResolvedValue({ candidatos: [], protegidos: [], bytesALiberar: 0, porCarpeta: {} }), depurar: vi.fn() },
      actualizacion: {
        estado: vi.fn().mockResolvedValue({ estado: 'downloaded', version: '1.2.0', mensaje: null }),
        notasPostUpdate: vi.fn().mockResolvedValue(null),
        instalarYReiniciar: vi.fn(),
        marcarVersionVista: vi.fn(),
      },
    };
    renderEn('/pos');
    const dialog = await screen.findByRole('dialog', { name: /actualización disponible/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /ahora no/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /actualización disponible/i })).not.toBeInTheDocument();
    });
  });
});

describe('AppShell — favoritos (PERF-1, ADR-080)', () => {
  afterEach(() => { inicioPersonalizable = false; mockFavoritos = []; saveSpy.mockClear(); });

  it('con el flag apagado no se renderiza el grupo Favoritos ni estrellas', async () => {
    inicioPersonalizable = false; mockFavoritos = ['/pos'];
    renderEn('/productos');
    // El flag se resuelve por el bridge (async); esperamos un tick para descartar que se
    // encienda, y verificamos que sigue apagado.
    await new Promise((r) => setTimeout(r, 20));
    expect(side().queryByText('Favoritos')).not.toBeInTheDocument();
    expect(side().queryByRole('button', { name: /quitar de favoritos|agregar a favoritos/i })).not.toBeInTheDocument();
  });

  it('con el flag encendido y un favorito, aparece el grupo Favoritos al tope', async () => {
    inicioPersonalizable = true; mockFavoritos = ['/pos'];
    renderEn('/productos');
    // El flag inicio_personalizable_habilitado se resuelve por el bridge (async).
    const fav = await waitFor(() => groupHeader('Favoritos'));
    const catalogo = groupHeader('Catálogo');
    expect(fav).toBeInTheDocument();
    // Favoritos va antes que el primer grupo real (Catálogo).
    // eslint-disable-next-line no-bitwise
    expect(fav.compareDocumentPosition(catalogo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('con el flag encendido, cada ítem muestra una estrella que persiste el favorito', async () => {
    inicioPersonalizable = true; mockFavoritos = [];
    renderEn('/productos');
    const estrellas = await waitFor(() => {
      const e = side().getAllByRole('button', { name: /agregar a favoritos/i });
      expect(e.length).toBeGreaterThan(0);
      return e;
    });
    fireEvent.click(estrellas[0]);
    // toggleFavorito (real, de usePreferencias) persiste vía bridge().preferencias.save.
    expect(saveSpy).toHaveBeenCalled();
  });
});
