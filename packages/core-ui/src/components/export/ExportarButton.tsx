import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import type { DefinicionExport } from '@ferreteria/shared';
import { ExportarModal } from './ExportarModal';

type Props = {
  definicion: DefinicionExport<any>;
  filtrosActivos?: Record<string, unknown> | undefined;
};

export function ExportarButton({ definicion, filtrosActivos }: Readonly<Props>) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);

  if (can(definicion.permiso)) {
    return (
      <>
        <button className="btn-secondary" onClick={() => setOpen(true)}>
          Exportar
        </button>
        {open && (
          <ExportarModal
            definicion={definicion}
            {...(filtrosActivos !== undefined ? { filtrosActivos } : {})}
            onClose={() => setOpen(false)}
          />
        )}
      </>
    );
  }

  return null;
}
