import { useCallback, useEffect, useState } from 'react';
import type { ConflictoSync, EstadoSyncTerminal } from '@core/preload';
import { useAuth } from '../../auth/AuthContext';
import { bridge } from '../../bridge';
import { traducirError } from '../../lib/errores';

// F3 PR2 (ADR-159): Configuración → Conflictos. El hub no tiene interfaz propia: quien tenga
// `sync.conflictos` revisa desde cualquier caja emparejada los conflictos del log del hub, compara las dos
// versiones de la fila y resuelve. Una edición simultánea se marca como revisada o se recupera la versión
// perdida; una alta repetida se descarta en la caja que la dio de alta (o se corrige allí a mano).

const TIPO: Record<ConflictoSync['tipo'], string> = {
  lww: 'Edición simultánea',
  unicidad: 'Alta repetida',
  integridad: 'Error de integridad',
};

/** Nombre de cada tabla en el lenguaje del negocio; el resto se muestra con su nombre técnico legible. */
const TABLA: Record<string, string> = {
  producto: 'Producto', producto_presentacion: 'Presentación', producto_proveedor: 'Costo de proveedor',
  existencias: 'Stock', categoria: 'Categoría', marca: 'Marca', ubicacion: 'Ubicación', unidad: 'Unidad',
  impuesto: 'Impuesto', cliente: 'Cliente', proveedor: 'Proveedor', usuario: 'Usuario', rol: 'Rol',
  lista_precio: 'Lista de precios', lista_precio_valor: 'Precio', promocion: 'Promoción',
  configuracion_negocio: 'Configuración', venta: 'Venta', caja: 'Caja', presupuesto: 'Presupuesto',
  remito: 'Remito', transportista: 'Transportista', orden_compra: 'Orden de compra',
  cuenta_corriente_cliente: 'Cuenta corriente', articulo: 'Artículo', rutina: 'Rutina',
};

/** Columnas que no se comparan: identidad, campos de sync y auditoría de la edición (cambian siempre). */
const NO_COMPARAR = new Set(['id', 'version', 'origin_id', 'sync_state', 'updated_at', 'usuario_modificacion_id', 'fecha_actualizacion']);
const CAMPOS_NOMBRE = ['nombre_corto', 'nombre', 'razon_social', 'nombre_completo', 'nombre_usuario', 'codigo', 'numero_interno', 'numero', 'titulo', 'sku'];

function nombreTabla(t: string): string {
  return TABLA[t] ?? (t.charAt(0).toUpperCase() + t.slice(1)).replace(/_/g, ' ');
}

function nombreFila(c: ConflictoSync): string {
  const f = c.fila_entrante ?? {};
  const campo = CAMPOS_NOMBRE.find((k) => typeof f[k] === 'string' && f[k] !== '');
  const quien = campo ? String(f[campo]) : c.fila_id.slice(0, 8);
  return `${nombreTabla(c.tabla)}: ${quien}`;
}

function valor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

function fecha(s: number | null): string {
  if (!s) return '—';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(s * 1000));
}

function estadoDe(c: ConflictoSync): string {
  if (!c.resuelto) return 'Pendiente';
  const como = c.resolucion === 'recuperado' ? 'Recuperado' : c.resolucion === 'corregido' ? 'Corregido' : 'Revisado';
  return c.resuelto_por ? `${como} por ${c.resuelto_por}` : como;
}

export function ConfigConflictos() {
  const { can } = useAuth();
  const acceso = can('sync.conflictos');
  const [estado, setEstado] = useState<EstadoSyncTerminal | null>(null);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [pagina, setPagina] = useState<{ conflictos: ConflictoSync[]; hayMas: boolean; enEspera: number } | null>(null);
  const [elegido, setElegido] = useState<ConflictoSync | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setErr(null);
    try {
      const e = await bridge().sync.estado();
      setEstado(e);
      if (e.modo !== 'distribuido') return;
      setPagina(await bridge().sync.conflictos(soloPendientes ? { pendientes: true } : {}));
    } catch (e) {
      setPagina(null); // sin conexión no se muestran datos viejos
      setErr(traducirError(e).mensaje);
    }
  }, [soloPendientes]);

  useEffect(() => { if (acceso) void cargar(); }, [acceso, cargar]);

  if (!acceso) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>Sin acceso.</div>;

  async function accion(fn: () => Promise<string>) {
    setErr(null); setMsg(null); setOcupado(true);
    try {
      const m = await fn();
      if (!m) return; // canceló la confirmación
      setElegido(null);
      setMsg(m);
      await cargar();
    } catch (e) {
      setErr(traducirError(e).mensaje);
    } finally {
      setOcupado(false);
    }
  }

  const revisar = (c: ConflictoSync) => void accion(async () => {
    await bridge().sync.resolverConflicto({ id: c.id, resolucion: 'revisado' });
    return 'Conflicto marcado como revisado.';
  });
  const recuperar = (c: ConflictoSync) => void accion(async () => {
    if (!window.confirm('Esta caja va a volver a escribir la versión que se perdió. Sube al hub en la próxima sincronización y llega a todas las cajas. ¿Seguir?')) return '';
    await bridge().sync.resolverConflicto({ id: c.id, resolucion: 'recuperado' });
    return 'Recuperada: la versión perdida sube al hub en la próxima sincronización.';
  });
  const descartar = (c: ConflictoSync) => void accion(async () => {
    if (!window.confirm(`Esta alta queda dada de baja y su ${c.columnasUnicas.join(', ')} se libera para que pueda subir al hub. Lo que dependa de ella (por ejemplo, productos de esta marca) llega a las otras cajas apuntando a la fila dada de baja. ¿Seguir?`)) return '';
    await bridge().sync.descartarAlta({ id: c.id });
    return 'Descartada: sube al hub en la próxima sincronización y el conflicto se resuelve solo.';
  });

  return (
    <div className="flex-col gap-4">
      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Conflictos de sincronización</h2>
      {msg && <div className="alert-ok" role="status">{msg}</div>}
      {err && <div className="alert-danger" role="alert">{err}</div>}

      {estado && estado.modo !== 'distribuido' && (
        <div className="panel" style={{ padding: '1rem', maxWidth: 640 }}>
          Esta caja no está emparejada con un hub: no hay conflictos para revisar.
        </div>
      )}

      {estado?.modo === 'distribuido' && (
        <>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', maxWidth: 760 }}>
            Cuando dos cajas cambian lo mismo sin conexión, el hub se queda con el cambio más nuevo y anota acá el que
            perdió. Una alta repetida (el mismo nombre o código en dos cajas) queda rechazada hasta corregirla en la caja
            que la dio de alta.
          </p>
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={soloPendientes} onChange={(e) => { setSoloPendientes(e.target.checked); setElegido(null); }} />
            Solo pendientes
          </label>
          {pagina && pagina.enEspera > 0 && (
            <div className="alert-warn" role="note">
              {pagina.enEspera} {pagina.enEspera === 1 ? 'cambio espera' : 'cambios esperan'} en el hub a que se corrija una alta repetida (por ejemplo, productos de una marca rechazada). Entran solos al corregirla.
            </div>
          )}
          {pagina && (pagina.conflictos.length === 0 ? (
            <div className="panel" style={{ padding: '1rem', maxWidth: 640 }}>
              {soloPendientes ? 'No hay conflictos pendientes.' : 'No hay conflictos.'}
            </div>
          ) : (
            <div className="panel">
              <div className="table-wrap">
                <table aria-label="Conflictos">
                  <thead>
                    <tr><th>Fecha</th><th>Tipo</th><th>Qué</th><th>Caja</th><th>Estado</th><th className="c">Ver</th></tr>
                  </thead>
                  <tbody>
                    {pagina.conflictos.map((c) => (
                      <tr key={c.id} style={{ fontWeight: elegido?.id === c.id ? 700 : undefined }}>
                        <td className="num text-sm">{fecha(c.fecha)}</td>
                        <td>{TIPO[c.tipo]}</td>
                        <td>{nombreFila(c)}</td>
                        <td className="num">{c.origin_id}</td>
                        <td><span className={`badge ${c.resuelto ? 'ok' : 'off'}`}><span className="bd" />{estadoDe(c)}</span></td>
                        <td className="c">
                          <button type="button" className="btn-secondary" aria-label={`Ver ${nombreFila(c)}`} onClick={() => { setElegido(c); setMsg(null); }}>Ver</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagina.hayMas && <div className="table-footer text-sm text-muted">Se muestran los 50 más recientes.</div>}
            </div>
          ))}
          {elegido && (
            <Detalle c={elegido} esta={estado.origin_id} ocupado={ocupado}
              onRevisar={revisar} onRecuperar={recuperar} onDescartar={descartar} onCerrar={() => setElegido(null)} />
          )}
        </>
      )}
    </div>
  );
}

function Detalle(p: {
  c: ConflictoSync; esta: string; ocupado: boolean;
  onRevisar(c: ConflictoSync): void; onRecuperar(c: ConflictoSync): void; onDescartar(c: ConflictoSync): void; onCerrar(): void;
}) {
  const { c } = p;
  const pendiente = !c.resuelto;
  return (
    <section className="panel" style={{ padding: '1rem', maxWidth: 760 }} aria-label="Detalle del conflicto">
      <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700 }}>{nombreFila(c)} · {TIPO[c.tipo]}</h3>

      {c.tipo === 'lww' && <Comparacion c={c} />}

      {c.tipo === 'unicidad' && (
        <div style={{ fontSize: 13 }}>
          <p style={{ margin: '0 0 6px' }}>
            La caja {c.origin_id} dio de alta esta fila con un valor que ya existe en el hub
            {c.columnasUnicas.length ? <> (chocó por: <strong>{c.columnasUnicas.join(', ')}</strong>)</> : null}.
            El hub no la guardó y lo que depende de ella espera.
          </p>
          {c.origin_id === p.esta
            ? <p style={{ margin: 0, color: 'var(--ink-3)' }}>Corregila en su pantalla (otro nombre o código) y se sube sola, o descartala.</p>
            : <p style={{ margin: 0, color: 'var(--ink-3)' }}>Está solo en la caja {c.origin_id}: corregila o descartala desde esa caja.</p>}
        </div>
      )}

      {c.tipo === 'integridad' && (
        <p style={{ fontSize: 13, margin: 0 }}>
          El hub rechazó un movimiento que ya tenía con otro contenido. No es una decisión del negocio: avisá a soporte
          con este detalle. <code style={{ fontSize: 11 }}>{c.detalle ?? '—'}</code>
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {pendiente && c.tipo === 'lww' && c.recuperable && (
          <button type="button" className="btn-primary" disabled={p.ocupado} onClick={() => p.onRecuperar(c)}>Recuperar esta versión</button>
        )}
        {pendiente && c.tipo !== 'unicidad' && (
          <button type="button" className="btn-secondary" disabled={p.ocupado} onClick={() => p.onRevisar(c)}>Marcar como revisado</button>
        )}
        {pendiente && c.tipo === 'unicidad' && c.origin_id === p.esta && c.columnasUnicas.length > 0 && (
          <button type="button" className="btn-secondary" disabled={p.ocupado} onClick={() => p.onDescartar(c)}>Descartar esta alta</button>
        )}
        <button type="button" className="btn-secondary" onClick={p.onCerrar}>Cerrar</button>
      </div>
    </section>
  );
}

/** Las dos versiones de una edición simultánea, solo con las columnas que difieren. */
function Comparacion({ c }: { c: ConflictoSync }) {
  const actual = c.fila_actual ?? {};
  const entrante = c.fila_entrante ?? {};
  // `perdida` dice cuál de las dos perdió: la otra es la que quedó en el hub.
  const quedo = c.perdida === 'actual' ? entrante : actual;
  const perdio = c.perdida === 'actual' ? actual : entrante;
  const cols = [...new Set([...Object.keys(quedo), ...Object.keys(perdio)])]
    .filter((k) => !NO_COMPARAR.has(k) && valor(quedo[k]) !== valor(perdio[k]))
    .sort();
  if (cols.length === 0) return <p style={{ fontSize: 13, margin: 0 }}>Las dos versiones tienen los mismos datos.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Dato</th><th>Quedó en el hub</th><th>Se perdió</th></tr></thead>
        <tbody>
          {cols.map((k) => (
            <tr key={k} data-distinto="true" aria-label={k}>
              <td className="text-sm text-muted">{k}</td>
              <td>{valor(quedo[k])}</td>
              <td style={{ color: 'var(--warn)' }}>{valor(perdio[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
