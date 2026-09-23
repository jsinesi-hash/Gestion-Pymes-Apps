import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nombreCompletoCliente } from '@ferreteria/shared';
import { useAuth } from '../../context/AuthContext';
import { useEscapeAction } from '@core/ui';
import { COMANDOS_ACCION, COMANDOS_NAV, filtrarPorTexto, type Comando } from '../../lib/comandos';

type ClienteRow = {
  id: string;
  nombre?: string | null;
  apellido?: string | null;
  razon_social?: string | null;
  nombre_fantasia?: string | null;
};

type ProveedorRow = {
  id: string;
  razon_social: string;
};

function labelCliente(c: ClienteRow): string {
  if (c.nombre) return nombreCompletoCliente({ nombre: c.nombre, apellido: c.apellido ?? null });
  return c.razon_social || c.nombre_fantasia || '(sin nombre)';
}

const RECIENTES_MAX = 6;

function leerRecientes(key: string): Comando[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function guardarReciente(key: string, c: Comando, max: number): Comando[] {
  const prev = leerRecientes(key).filter(x => x.to !== c.to);
  const next = [{ label: c.label, to: c.to, ...(c.hint ? { hint: c.hint } : {}) }, ...prev].slice(0, max);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* storage lleno/no disponible: noop */
  }
  return next;
}

/**
 * SRCH-1 (ADR-078): paleta de comandos global, Ctrl/Cmd+K. Componente autónomo: no
 * depende de un Context propio, maneja su `open` en estado local y se monta una sola
 * vez en AppShell. Busca en paralelo sobre productos (IPC debounced), clientes y
 * proveedores (cargados una vez y filtrados en cliente), más las acciones/navegación
 * de `lib/comandos.ts` filtradas por permiso.
 */
export function CommandPalette({ disabled = false }: Readonly<{ disabled?: boolean }>) {
  const { can, session } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [productos, setProductos] = useState<Comando[]>([]);
  const [clientesTodos, setClientesTodos] = useState<ClienteRow[] | null>(null);
  const [proveedoresTodos, setProveedoresTodos] = useState<ProveedorRow[] | null>(null);
  const [recientes, setRecientes] = useState<Comando[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const reqIdRef = useRef(0);
  const uid = session?.id ?? 'anon';
  const recientesKey = `cmdk_recientes_${uid}`;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Ctrl/Cmd+K togglea. Un único listener global, siempre montado (independiente de
  // `open`) para poder abrir la paleta desde cualquier pantalla.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (disabled) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled]);

  // Si se deshabilita mientras está abierta (p. ej. se activa el bloqueo por
  // inactividad), forzar el cierre.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  // Escape cierra la paleta solo cuando es el overlay más arriba de la pila LIFO: si
  // hay otro modal/drawer abierto encima, ese atiende primero. Evita el bug de que
  // Escape sobre la paleta también dispare el `navigate(-1)` de la pantalla debajo.
  useEscapeAction(() => setOpen(false), { layer: 'overlay', enabled: open });

  // Al abrir: limpiar búsqueda, resetear resaltado y enfocar el input.
  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setRecientes(leerRecientes(recientesKey));
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open, recientesKey]);

  // Clientes: se cargan una sola vez, la primera vez que se abre la paleta. Requiere
  // `ctacte.cobrar` (el mismo permiso que gatea el IPC del lado main); sin él, se deja
  // la lista vacía en vez de disparar una llamada que el Operador no puede hacer.
  useEffect(() => {
    if (!open || clientesTodos !== null) return;
    if (!can('ctacte.cobrar')) { setClientesTodos([]); return; }
    let vivo = true;
    Promise.resolve((globalThis as any).ferreteria?.cliente?.list?.())
      .then((data: ClienteRow[]) => { if (vivo) setClientesTodos(data ?? []); })
      .catch(() => { if (vivo) setClientesTodos([]); });
    return () => { vivo = false; };
  }, [open, clientesTodos, can]);

  // Proveedores: mismo patrón que clientes, gateado por `proveedor.gestionar`
  // (Supervisor-only del lado main).
  useEffect(() => {
    if (!open || proveedoresTodos !== null) return;
    if (!can('proveedor.gestionar')) { setProveedoresTodos([]); return; }
    let vivo = true;
    Promise.resolve((globalThis as any).ferreteria?.compras?.proveedor?.list?.())
      .then((data: ProveedorRow[]) => { if (vivo) setProveedoresTodos(data ?? []); })
      .catch(() => { if (vivo) setProveedoresTodos([]); });
    return () => { vivo = false; };
  }, [open, proveedoresTodos, can]);

  // Productos: búsqueda IPC debounced ~200ms. Query vacía → sin resultados.
  // Guarda de request: una respuesta lenta de una búsqueda anterior no debe pisar el
  // resultado de una más reciente (myReq !== reqIdRef.current descarta la obsoleta).
  useEffect(() => {
    if (!open || q.trim() === '') { setProductos([]); return; }
    const t = setTimeout(() => {
      const myReq = ++reqIdRef.current;
      Promise.resolve(
        (globalThis as any).ferreteria?.catalogo?.producto?.list?.({
          busqueda: q, activo: true, page: 1, pageSize: 8,
        }),
      )
        .then((r: any) => {
          if (!mountedRef.current || myReq !== reqIdRef.current) return;
          setProductos((r?.items ?? []).map((p: any) => ({
            label: p.nombre_corto, to: `/productos/${p.id}`, hint: p.sku,
          })));
        })
        .catch(() => { if (mountedRef.current && myReq === reqIdRef.current) setProductos([]); });
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!open) return null;

  const texto = q.trim();
  const clientes: Comando[] = texto === '' ? [] : filtrarPorTexto(
    (clientesTodos ?? []).map(c => ({ label: labelCliente(c), to: `/clientes/${c.id}` })),
    q,
  );
  const proveedores: Comando[] = texto === '' ? [] : filtrarPorTexto(
    (proveedoresTodos ?? []).map(p => ({ label: p.razon_social, to: `/compras/proveedores/${p.id}` })),
    q,
  );
  const acciones = filtrarPorTexto(COMANDOS_ACCION.filter(c => !c.permiso || can(c.permiso)), q);
  const navegacion = filtrarPorTexto(COMANDOS_NAV.filter(c => !c.permiso || can(c.permiso)), q);
  const items: Comando[] = texto === ''
    ? [...recientes, ...acciones, ...navegacion]
    : [...productos, ...clientes, ...proveedores, ...acciones, ...navegacion];
  const idxSeguro = Math.min(idx, Math.max(items.length - 1, 0));

  function ejecutar(c?: Comando) {
    if (!c) return;
    setRecientes(guardarReciente(recientesKey, c, RECIENTES_MAX));
    setOpen(false);
    navigate(c.to);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx(i => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      ejecutar(items[idxSeguro]);
    }
  }

  return (
    <div className="modal-overlay cmdk-overlay" onClick={() => setOpen(false)}>
      <div
        className="modal cmdk-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="input cmdk-input"
          placeholder="Buscar productos, clientes, proveedores, acciones…"
          value={q}
          onChange={e => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={onInputKey}
        />
        <ul className="cmdk-list" role="listbox" aria-label="Resultados">
          {items.length === 0 && (
            <li className="cmdk-empty">Sin resultados</li>
          )}
          {items.map((c, i) => (
            <li
              key={`${c.to}-${i}`}
              role="option"
              aria-selected={i === idxSeguro}
              className={`cmdk-item${i === idxSeguro ? ' active' : ''}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => ejecutar(c)}
            >
              <span>{c.label}</span>
              {c.hint ? <span className="text-muted cmdk-hint"> · {c.hint}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
