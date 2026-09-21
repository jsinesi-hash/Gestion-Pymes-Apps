import { useState, useRef, useEffect } from 'react';
import { nombreCompletoCliente } from '@ferreteria/shared';
import { CONSUMIDOR_FINAL_ID } from '../../hooks/usePosSession';

type ClienteInfo = {
  nombre_completo: string;
  habilita_ccc: boolean;
  tipo_documento?: string;
  numero_documento?: string;
  condicion_fiscal?: string;
  telefono?: string | null;
};

type Props = {
  clienteInfo: ClienteInfo | null;
  onSeleccionar: (id: string, info: ClienteInfo | null) => void;
};

type ClienteRow = {
  id: string;
  nombre: string;
  apellido: string | null;
  numero_documento: string;
  tipo_documento: string;
  condicion_fiscal: string;
  habilita_cuenta_corriente: boolean;
  telefono: string | null;
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--ink-3)',
  fontWeight: 700,
  lineHeight: 1,
  marginBottom: 2,
};

const nameStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 13,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 200,
  lineHeight: 1.2,
};

const iconBtnStyle: React.CSSProperties = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: 'var(--ink-3)',
  fontSize: 14,
  padding: '0 4px',
  flexShrink: 0,
  lineHeight: 1,
};

export function PosClienteSelector({ clienteInfo, onSeleccionar }: Readonly<Props>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<ClienteRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  function handleCambiar() {
    setOpen(true);
    setQuery('');
    setResultados([]);
  }

  function handleReset() {
    onSeleccionar(CONSUMIDOR_FINAL_ID, null);
    setOpen(false);
    setQuery('');
    setResultados([]);
  }

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const myReq = ++reqIdRef.current;
    debounceRef.current = setTimeout(async () => {
      if (!value.trim()) {
        setResultados([]);
        return;
      }
      try {
        const todos: ClienteRow[] = await (globalThis as any).ferreteria.cliente.list();
        if (!mountedRef.current || myReq !== reqIdRef.current) return;
        const lower = value.toLowerCase();
        const filtered = todos.filter(c =>
          nombreCompletoCliente(c).toLowerCase().includes(lower) ||
          c.numero_documento?.toLowerCase().includes(lower),
        ).slice(0, 10);
        setResultados(filtered);
      } catch {
        if (!mountedRef.current || myReq !== reqIdRef.current) return;
        setResultados([]);
      }
    }, 200);
  }

  function handleSeleccionar(c: ClienteRow) {
    onSeleccionar(c.id, {
      nombre_completo: nombreCompletoCliente(c),
      habilita_ccc: c.habilita_cuenta_corriente,
      tipo_documento: c.tipo_documento,
      numero_documento: c.numero_documento,
      condicion_fiscal: c.condicion_fiscal,
      telefono: c.telefono,
    });
    setOpen(false);
    setQuery('');
    setResultados([]);
  }

  if (clienteInfo !== null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={labelStyle}>Cliente</div>
          <div style={nameStyle}>{clienteInfo.nombre_completo}</div>
        </div>
        <button type="button" onClick={handleReset} style={iconBtnStyle} title="Quitar cliente">
          ✕
        </button>
      </div>
    );
  }

  if (open) {
    return (
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="Buscar cliente..."
          className="input"
          style={{ width: 200, fontSize: 13 }}
          onBlur={() => { if (!resultados.length) { setOpen(false); } }}
        />
        {resultados.length > 0 && (
          <ul
            data-testid="cliente-dropdown"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              listStyle: 'none',
              margin: '4px 0 0',
              padding: 0,
              zIndex: 200,
              maxHeight: 260,
              overflowY: 'auto',
              minWidth: 260,
            }}
          >
            {resultados.map(c => (
              <li
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSeleccionar(c)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSeleccionar(c); }}
                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{nombreCompletoCliente(c)}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.tipo_documento} · {c.numero_documento}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div>
        <div style={labelStyle}>Cliente</div>
        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>Consumidor Final</div>
      </div>
      <button
        type="button"
        onClick={handleCambiar}
        style={{ fontSize: 12, padding: '2px 8px', border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer', color: 'var(--ink-2)', flexShrink: 0 }}
      >
        Cambiar
      </button>
    </div>
  );
}
