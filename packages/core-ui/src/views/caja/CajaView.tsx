import { type ReactNode } from 'react';
import { useCajaActiva } from '../../hooks/useCajaActiva';
import { AperturaForm } from './AperturaForm';
import { CajaDashboard } from './CajaDashboard';

type Props = {
  renderVentaDetalle?: (ventaId: string, onClose: () => void) => ReactNode;
};

export function CajaView({ renderVentaDetalle }: Readonly<Props>) {
  const { caja, isLoading, refetch } = useCajaActiva();

  if (isLoading) return null;

  if (!caja) {
    return <AperturaForm onSuccess={refetch} />;
  }

  return (
    <div className="flex-col gap-4">
      <CajaDashboard
        caja={caja}
        onRefetch={refetch}
        {...(renderVentaDetalle !== undefined ? { renderVentaDetalle } : {})}
      />
    </div>
  );
}
