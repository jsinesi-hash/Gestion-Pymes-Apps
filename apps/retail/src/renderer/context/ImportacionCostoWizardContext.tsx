import { createContext, useContext, useState } from 'react';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import type { FilaPreview } from '../views/precios/ImportarCostosView';

// Followup ADR-051: Previsualizar tiene que sobrevivir navegar a otra pantalla del menú
// y volver — nada se persiste en la base hasta Confirmar (ver importacion-costo.ts), así
// que el único lugar donde "vive" el trabajo en curso es acá, en un Context montado por
// encima de las rutas (ver App.tsx). Si ImportarCostosView guardara esto en useState
// local, se perdería al desmontar el componente al cambiar de ruta.

export type WizardStep = 'seleccion' | 'preview' | 'confirmado';
export type BatchGenerado = { id: string; lista_precio_id: string; estado: string };

export type ImportacionCostoWizardState = {
  step: WizardStep;
  proveedorId: string;
  filePath: string;
  filas: FilaPreview[];
  // 'propuestos' = filas sin_matchear que tienen candidatos por similitud sugeridos.
  filterPreview: 'all' | FilaPreview['estado'] | 'propuestos';
  filterResultado: 'all' | FilaPreview['estado'];
  batchesGenerados: BatchGenerado[];
};

const ESTADO_INICIAL: ImportacionCostoWizardState = {
  step: 'seleccion',
  proveedorId: '',
  filePath: '',
  filas: [],
  filterPreview: 'all',
  filterResultado: 'all',
  batchesGenerados: [],
};

type Ctx = {
  wizard: ImportacionCostoWizardState;
  setWizard: Dispatch<SetStateAction<ImportacionCostoWizardState>>;
  /** Descarta todo (Cancelar / Nueva importación) — no hay nada en la base que deshacer. */
  resetWizard: () => void;
};

const ImportacionCostoWizardContext = createContext<Ctx | null>(null);

export function ImportacionCostoWizardProvider({ children }: { children: ReactNode }) {
  const [wizard, setWizard] = useState<ImportacionCostoWizardState>(ESTADO_INICIAL);
  const resetWizard = () => setWizard(ESTADO_INICIAL);
  return (
    <ImportacionCostoWizardContext.Provider value={{ wizard, setWizard, resetWizard }}>
      {children}
    </ImportacionCostoWizardContext.Provider>
  );
}

export function useImportacionCostoWizard(): Ctx {
  const ctx = useContext(ImportacionCostoWizardContext);
  if (!ctx) throw new Error('useImportacionCostoWizard debe usarse dentro de ImportacionCostoWizardProvider');
  return ctx;
}
