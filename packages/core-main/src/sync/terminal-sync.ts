// Modo distribuido de la terminal (ADR-150 §2 y §10, ADR-156; F2 PR4): emparejar con el hub, arrancar
// (semilla o snapshot), encender el cliente de sync al iniciar la app, desemparejar y volver a bajar el
// snapshot (la restauración en este modo). Genérico: cada app pasa su esquema, su registro de sync, sus
// proyecciones y su control de integridad de saldos.
import os from 'node:os';
import { desinstalarTriggersSync, instalarTriggersSync, type RegistroSync } from '@core/db';
import { PROTOCOLO_VERSION, RUTAS, versionEsquema, type Versiones } from '@core/hub';
import { clearSession } from '../auth/session';
import { aplicarConfigTerminal, getModoTerminal, getOriginId } from '../context';
import { diferenciasDeCuentaCorriente } from '../ctacte-proyeccion';
import { guardarConfigTerminal } from '../terminal';
import { bajarSnapshot, cargarSnapshot, escribirCursor, filasDeSemilla, sondearHub, subirSemilla } from './arranque';
import { crearClienteSync, cuerpo, type CambioAplicado, type ClienteSync, type DbSync, type EstadoSync } from './cliente';
import { borrarHub, guardarHub, leerHub, type DatosHub, type DepsHubGuardado } from './hub-guardado';
import { programarSync } from './programar';
import { crearTransporteHttps, type OpcionesTransporte, type TransporteHub } from './transporte';

export interface OpcionesSyncTerminal {
  readonly schema: Record<string, unknown>;
  readonly registro: RegistroSync;
  /** Carpeta de migraciones de la app: su cantidad es la versión de esquema (ADR-150 §8). */
  readonly migrationsFolder: string;
  /** userData: `config.json`, los datos del hub y la credencial cifrada. */
  readonly carpetaDatos: string;
  /** Proyecciones de la app (stock y costo) sobre lo que bajó del hub (ADR-151). */
  readonly alAplicar?: (aplicados: readonly CambioAplicado[]) => void;
  /** Diferencias de saldos propias de la app (stock, costo): la semilla no sube con diferencias. */
  readonly integridad?: () => string[];
}

/** Dependencias con efectos afuera de la base; los tests las reemplazan. */
export interface DepsSyncTerminal {
  readonly safeStorage: DepsHubGuardado['safeStorage'];
  /** Backup local antes de reemplazar la base por el snapshot del hub. */
  readonly respaldar: () => Promise<unknown>;
  readonly crearTransporte?: (o: OpcionesTransporte) => TransporteHub;
  readonly sondear?: typeof sondearHub;
  readonly programar?: (cliente: ClienteSync) => { detener(): void };
  readonly log?: (mensaje: string) => void;
}

export interface EstadoTerminalSync {
  readonly modo: 'standalone' | 'distribuido';
  readonly origin_id: string;
  readonly hub: Omit<DatosHub, 'certPem' | 'origin_id'> | null;
  /** null = sin cliente (standalone, o distribuido sin datos del hub legibles). */
  readonly sync: EstadoSync | null;
}

export interface ResultadoEmparejar {
  readonly origin_id: string;
  /** `semilla`: esta terminal subió su base (hub vacío). `snapshot`: bajó la del hub y hay que volver a entrar. */
  readonly arranque: 'semilla' | 'snapshot';
  readonly filas: number;
}

export interface SyncTerminal {
  /** Al arrancar la app: en modo distribuido instala los triggers y enciende el cliente. */
  iniciar(): boolean;
  detener(): void;
  sondear(url: string): Promise<{ url: string; huella: string }>;
  emparejar(p: { url: string; codigo: string; huella: string; nombre?: string }): Promise<ResultadoEmparejar>;
  sincronizarAhora(): Promise<EstadoTerminalSync>;
  desemparejar(p?: { forzar?: boolean }): Promise<void>;
  rebajarSnapshot(p?: { forzar?: boolean }): Promise<{ filas: number }>;
  estado(): EstadoTerminalSync;
}

export function crearSyncTerminal(db: DbSync, o: OpcionesSyncTerminal, deps: DepsSyncTerminal): SyncTerminal {
  const sqlite = db.$client;
  const guardado: DepsHubGuardado = { safeStorage: deps.safeStorage, carpeta: o.carpetaDatos };
  const crearTransporte = deps.crearTransporte ?? crearTransporteHttps;
  const sondear = deps.sondear ?? sondearHub;
  const programar = deps.programar ?? ((c: ClienteSync) => programarSync(c));
  let versiones: Versiones | null = null;
  const versionesApp = () => (versiones ??= { protocolo: PROTOCOLO_VERSION, esquema: versionEsquema(o.migrationsFolder) });

  let activo: { cliente: ClienteSync; transporte: TransporteHub; tareas: { detener(): void } } | null = null;

  const pendientes = () => (sqlite.prepare('SELECT count(*) AS n FROM "sync_outbox" WHERE "enviado_en" IS NULL').get() as { n: number }).n;

  function transporteDe(datos: DatosHub, credencial?: string): TransporteHub {
    return crearTransporte({ url: datos.url, certPem: datos.certPem, huella: datos.huella, versiones: versionesApp(), ...(credencial ? { credencial } : {}) });
  }

  function detener(): void {
    activo?.tareas.detener();
    activo?.transporte.cerrar();
    activo = null;
  }

  function iniciar(): boolean {
    if (activo) return true;
    if (getModoTerminal() !== 'distribuido') {
      // En standalone nadie consume la cola: si quedaron triggers de un emparejamiento cortado, se quitan.
      desinstalarTriggersSync(sqlite, o.schema, o.registro);
      return false;
    }
    const hub = leerHub(guardado);
    if (!hub) {
      deps.log?.('[sync] modo distribuido sin datos del hub legibles: la terminal opera sin sincronizar');
      return false;
    }
    // Idempotente: los triggers se instalan al emparejar; reinstalarlos cubre una base restaurada a mano.
    instalarTriggersSync(sqlite, o.schema, o.registro);
    const transporte = transporteDe(hub.datos, hub.credencial);
    const cliente = crearClienteSync(db, {
      schema: o.schema, registro: o.registro, transporte,
      ...(o.alAplicar ? { alAplicar: o.alAplicar } : {}),
      avisarDesfasaje: (ms) => deps.log?.(`[sync] el reloj de la terminal difiere ${Math.round(ms / 1000)} s del hub`),
    });
    activo = { cliente, transporte, tareas: programar(cliente) };
    return true;
  }

  function problemasDeSaldos(): string[] {
    return [
      ...diferenciasDeCuentaCorriente(db).map((d) => `cuenta_corriente:${d.cuenta_id}`),
      ...(o.integridad?.() ?? []),
    ];
  }

  async function emparejar(p: { url: string; codigo: string; huella: string; nombre?: string }): Promise<ResultadoEmparejar> {
    if (getModoTerminal() === 'distribuido') throw new Error('TERMINAL_YA_EMPAREJADA');
    // La credencial se guarda cifrada: sin safeStorage no se empareja (antes de tocar el hub o la base).
    if (!deps.safeStorage.isEncryptionAvailable()) throw new Error('SAFE_STORAGE_NO_DISPONIBLE');
    const codigo = p.codigo.trim().toUpperCase();
    if (!codigo) throw new Error('CODIGO_INVALIDO');
    // El certificado se vuelve a leer y tiene que ser el que el usuario confirmó (ADR-158 §3).
    const cert = await sondear(p.url);
    if (cert.huella !== p.huella) throw new Error('HUELLA_DISTINTA');
    const nombre = (p.nombre ?? '').trim() || os.hostname();
    const base: DatosHub = { url: cert.url, certPem: cert.certPem, huella: cert.huella, origin_id: '', nombre, emparejado_en: Date.now() };

    const sinCredencial = transporteDe(base);
    let origin_id: string;
    let credencial: string;
    try {
      const r = cuerpo(await sinCredencial.pedir('POST', RUTAS.emparejar, { codigo, nombre, origin_id_propuesto: getOriginId() }));
      origin_id = String(r['origin_id'] ?? '');
      credencial = String(r['credencial'] ?? '');
      if (!origin_id || !credencial) throw new Error('HUB_RESPUESTA_INVALIDA: emparejar');
    } finally {
      sinCredencial.cerrar();
    }

    const datos: DatosHub = { ...base, origin_id };
    const transporte = transporteDe(datos, credencial);
    let arranque: ResultadoEmparejar['arranque'];
    let filas: number;
    try {
      const estado = cuerpo(await transporte.pedir('GET', RUTAS.estado));
      if (estado['cursor'] === 0) {
        // Primera terminal: su base es la semilla del hub (ADR-150 §10), siempre que los saldos
        // guardados coincidan con sus libros (ADR-151): el hub no guarda saldos.
        const problemas = problemasDeSaldos();
        if (problemas.length) throw new Error(`INTEGRIDAD_SALDOS: ${problemas.length} diferencias (${problemas.slice(0, 5).join(', ')})`);
        // Los triggers van antes de leer la base: lo que se escriba mientras sube la semilla queda en la cola.
        instalarTriggersSync(sqlite, o.schema, o.registro);
        try {
          const semilla = filasDeSemilla(db, o.schema, o.registro);
          escribirCursor(db, await subirSemilla(transporte, semilla));
          filas = semilla.length;
        } catch (e) {
          desinstalarTriggersSync(sqlite, o.schema, o.registro);
          sqlite.prepare('DELETE FROM "sync_outbox"').run();
          throw e;
        }
        arranque = 'semilla';
      } else {
        // Las siguientes bajan la base del hub y reemplazan la suya (con un backup antes).
        await deps.respaldar();
        filas = cargarSnapshot(db, await bajarSnapshot(transporte), o).filas;
        instalarTriggersSync(sqlite, o.schema, o.registro);
        arranque = 'snapshot';
      }
    } finally {
      transporte.cerrar();
    }

    guardarHub(guardado, datos, credencial);
    const config = { origin_id, modo: 'distribuido' as const };
    guardarConfigTerminal(o.carpetaDatos, config);
    aplicarConfigTerminal(config);
    // Con el snapshot cambiaron los usuarios: la sesión abierta ya no corresponde a ninguna fila.
    if (arranque === 'snapshot') clearSession();
    iniciar();
    deps.log?.(`[sync] terminal emparejada como ${origin_id} (${arranque}, ${filas} filas)`);
    return { origin_id, arranque, filas };
  }

  async function desemparejar(p: { forzar?: boolean } = {}): Promise<void> {
    if (getModoTerminal() !== 'distribuido') throw new Error('TERMINAL_NO_EMPAREJADA');
    const n = pendientes();
    if (n > 0 && p.forzar !== true) throw new Error(`CAMBIOS_SIN_SUBIR: ${n}`);
    detener();
    desinstalarTriggersSync(sqlite, o.schema, o.registro);
    sqlite.prepare('DELETE FROM "sync_outbox"').run();
    borrarHub(guardado);
    const config = { origin_id: getOriginId(), modo: 'standalone' as const };
    guardarConfigTerminal(o.carpetaDatos, config);
    aplicarConfigTerminal(config);
    deps.log?.('[sync] terminal desemparejada: vuelve a standalone');
  }

  async function rebajarSnapshot(p: { forzar?: boolean } = {}): Promise<{ filas: number }> {
    if (getModoTerminal() !== 'distribuido') throw new Error('TERMINAL_NO_EMPAREJADA');
    const hub = leerHub(guardado);
    if (!hub) throw new Error('HUB_SIN_DATOS');
    // Lo que no subió se perdería al reemplazar la base: primero se intenta subirlo.
    if (pendientes() > 0 && activo) await activo.cliente.push().catch(() => undefined);
    const n = pendientes();
    if (n > 0 && p.forzar !== true) throw new Error(`CAMBIOS_SIN_SUBIR: ${n}`);
    detener();
    const transporte = transporteDe(hub.datos, hub.credencial);
    try {
      await deps.respaldar();
      const r = cargarSnapshot(db, await bajarSnapshot(transporte), o);
      clearSession();
      return r;
    } finally {
      transporte.cerrar();
      instalarTriggersSync(sqlite, o.schema, o.registro);
      iniciar();
    }
  }

  function estado(): EstadoTerminalSync {
    const hub = getModoTerminal() === 'distribuido' ? leerHub(guardado) : null;
    return {
      modo: getModoTerminal(),
      origin_id: getOriginId(),
      hub: hub ? { url: hub.datos.url, huella: hub.datos.huella, nombre: hub.datos.nombre, emparejado_en: hub.datos.emparejado_en } : null,
      sync: activo?.cliente.estado() ?? null,
    };
  }

  return {
    iniciar,
    detener,
    async sondear(url) {
      const r = await sondear(url);
      return { url: r.url, huella: r.huella };
    },
    emparejar,
    async sincronizarAhora() {
      if (!activo) throw new Error('TERMINAL_NO_EMPAREJADA');
      await activo.cliente.sincronizar();
      return estado();
    },
    desemparejar,
    rebajarSnapshot,
    estado,
  };
}
