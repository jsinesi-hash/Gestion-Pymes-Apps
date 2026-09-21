import { PosScanBar } from './PosScanBar';
import { PosClienteSelector } from './PosClienteSelector';

type Props = {
  onAdd: (productoId: string, presentacionId?: string | null, factorAStock?: number) => Promise<void>;
  disabled: boolean;
  clienteInfo: { nombre_completo: string; habilita_ccc: boolean } | null;
  onSeleccionarCliente: (id: string, info: { nombre_completo: string; habilita_ccc: boolean } | null) => void;
  clienteId: string | null;
};

export function PosTopBar({
  onAdd, disabled, clienteInfo, onSeleccionarCliente, clienteId,
}: Readonly<Props>) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px var(--pad)',
      borderBottom: '1px solid var(--line)',
      background: 'var(--surface)',
      flexWrap: 'nowrap',
    }}>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <PosScanBar onAdd={onAdd} disabled={disabled} clienteId={clienteId} />
      </div>
      <div style={{ flexShrink: 0, minWidth: 0 }}>
        <PosClienteSelector clienteInfo={clienteInfo} onSeleccionar={onSeleccionarCliente} />
      </div>
    </div>
  );
}
