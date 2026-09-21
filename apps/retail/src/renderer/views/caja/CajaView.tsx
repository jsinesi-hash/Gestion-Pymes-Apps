import { useCajaActiva } from '../../hooks/useCajaActiva';
import { AperturaForm } from './AperturaForm';
import { CajaDashboard } from './CajaDashboard';

export function CajaView() {
  const { caja, isLoading, refetch } = useCajaActiva();

  if (isLoading) return null;

  if (!caja) {
    return <AperturaForm onSuccess={refetch} />;
  }

  return (
    <div className="flex-col gap-4">
      <CajaDashboard caja={caja} onRefetch={refetch} />
    </div>
  );
}
