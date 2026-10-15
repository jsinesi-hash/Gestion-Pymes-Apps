import { useState } from 'react';
import { bridge, traducirError } from '@core/ui';
import { nombreCompletoCliente, normalizar } from '@ferreteria/shared';
import { CONSUMIDOR_FINAL, CONSUMIDOR_FINAL_ID, type ClientePos } from './consumidorFinal';

type ClienteRow = {
  id: string;
  nombre: string;
  apellido: string | null;
  numero_documento: string;
  habilita_cuenta_corriente: boolean;
};

/** Controlado: el padre es dueño del cliente elegido y de su nombre (también al retomar un pedido). */
type Props = { clienteId: string; nombre?: string; onCambiar: (cliente: ClientePos) => void };

export function ClienteSelector({ clienteId, nombre, onCambiar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abrir = async () => {
    setAbierto(true);
    setBusqueda('');
    setError(null);
    try {
      const rows = (await bridge().cliente.list()) as ClienteRow[];
      setClientes(rows.filter((c) => c.id !== CONSUMIDOR_FINAL_ID));
    } catch (e) {
      setError(traducirError(e).mensaje);
    }
  };

  const elegir = (c: ClientePos) => {
    setAbierto(false);
    onCambiar(c);
  };

  const q = normalizar(busqueda.trim());
  const visibles = clientes
    .map((c) => ({ c, nombre: nombreCompletoCliente(c) }))
    .filter(({ c, nombre }) => !q || normalizar(nombre).includes(q) || normalizar(c.numero_documento ?? '').includes(q));

  const nombreActual = clienteId === CONSUMIDOR_FINAL_ID ? CONSUMIDOR_FINAL.nombre_completo : (nombre ?? 'Cliente');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 600 }}>{nombreActual}</span>
        <button type="button" className="btn-secondary" onClick={abrir}>Cambiar</button>
      </div>
      {abierto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            className="input"
            aria-label="Buscar cliente"
            placeholder="Buscar por nombre o documento"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoFocus
          />
          {error && <div role="alert" style={{ color: 'var(--danger, #b00020)' }}>{error}</div>}
          <button type="button" className="srow" onClick={() => elegir(CONSUMIDOR_FINAL)}>
            Consumidor Final
          </button>
          {visibles.map(({ c, nombre }) => (
            <button
              key={c.id}
              type="button"
              className="srow"
              onClick={() => elegir({ id: c.id, nombre_completo: nombre, habilita_cuenta_corriente: c.habilita_cuenta_corriente })}
            >
              <span>{nombre}</span>{' '}
              <span style={{ opacity: 0.7 }}>{c.numero_documento}</span>
              {c.habilita_cuenta_corriente && <span className="badge"> Cta. cte.</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
