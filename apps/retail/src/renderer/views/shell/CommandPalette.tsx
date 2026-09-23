import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/ui';
import { useEscapeAction } from '@core/ui';
import { filtrarPorTexto, type Comando } from '../../lib/comandos';

/**
 * Una fuente de resultados de la paleta. `buscar` recibe el texto y devuelve comandos;
 * puede cachear internamente (p. ej. la lista de clientes) o hacer IPC por consulta (p. ej.
 * productos). `permiso`, si está presente, gatea la ejecución: sin ese permiso la paleta no
 * llama a `buscar` (evita disparar un IPC que el rol no puede hacer).
 */
export type Buscador = {
  key: string;
  titulo: string;
  permiso?: string;
  /** Devuelve resultados para el texto; puede cachear internamente. */
  buscar: (q: string) => Promise<Comando[]>;
};

export type CommandPaletteProps = {
  disabled?: boolean;
  comandos: { accion: Comando[]; nav: Comando[] };
  buscadores: Buscador[];
};

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
 * vez en el shell. No conoce ninguna fuente concreta: recibe los `buscadores` (productos,
 * clientes, proveedores… en Retail) y los `comandos` (acciones/navegación) por props, y los
 * recorre en paralelo conservando el orden de secciones que definió la app. Guarda de
 * carrera (`reqIdRef`): una respuesta lenta de una búsqueda anterior no pisa una más
 * reciente.
 */
export function CommandPalette({ disabled = false, comandos, buscadores }: Readonly<CommandPaletteProps>) {
  const { can, session } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  // Resultados por buscador (mismo índice que `buscadores`), para conservar el orden de
  // secciones al aplanar.
  const [resultados, setResultados] = useState<Comando[][]>(() => buscadores.map(() => []));
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

  // Sweep de buscadores: query vacía → sin resultados (se muestran recientes/acciones/nav).
  // Debounce ~200ms + guarda de request (`myReq !== reqIdRef.current` descarta la obsoleta),
  // igual que la búsqueda IPC de productos previa, ahora extendida a todos los buscadores.
  // Los buscadores con `permiso` que el rol no tiene no se llaman (no dispara su IPC).
  useEffect(() => {
    if (!open) return;
    if (q.trim() === '') { setResultados(buscadores.map(() => [])); return; }
    const t = setTimeout(() => {
      const myReq = ++reqIdRef.current;
      const asignar = (i: number, res: Comando[]) => {
        if (!mountedRef.current || myReq !== reqIdRef.current) return;
        setResultados(prev => {
          const next = prev.slice();
          next[i] = res;
          return next;
        });
      };
      buscadores.forEach((b, i) => {
        if (b.permiso && !can(b.permiso)) { asignar(i, []); return; }
        Promise.resolve(b.buscar(q))
          .then((res) => asignar(i, res ?? []))
          .catch(() => asignar(i, []));
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, buscadores, can]);

  if (!open) return null;

  const texto = q.trim();
  const resultadosBuscadores: Comando[] = texto === '' ? [] : resultados.flat();
  const acciones = filtrarPorTexto(comandos.accion.filter(c => !c.permiso || can(c.permiso)), q);
  const navegacion = filtrarPorTexto(comandos.nav.filter(c => !c.permiso || can(c.permiso)), q);
  const items: Comando[] = texto === ''
    ? [...recientes, ...acciones, ...navegacion]
    : [...resultadosBuscadores, ...acciones, ...navegacion];
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
