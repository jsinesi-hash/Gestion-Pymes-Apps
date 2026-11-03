
import { bridge } from '@core/ui';const api = () => bridge().importacionCosto;
const dialogApi = () => bridge().dialog;

export function useImportacionCosto() {
  return {
    parseArchivo:       (p: unknown)          => api().parseArchivo(p),
    revalidarFila:      (p: unknown)          => api().revalidarFila(p),
    buscarProductos:    (p: unknown)          => api().buscarProductos(p),
    confirmar:          (p: unknown)          => api().confirmar(p),
    getColaRevision:    ()                    => api().getColaRevision(),
    resolverFila:       (p: unknown)          => api().resolverFila(p),
    descartarFila:      (detalleId: string)   => api().descartarFila(detalleId),
    actualizarFila:     (p: unknown)          => api().actualizarFila(p),
    cancelar:           (p: unknown)          => api().cancelar(p),
    eliminar:           (p: unknown)          => api().eliminar(p),
    getHistorial:        ()                      => api().getHistorial(),
    getHistorialDetalle: (importacionId: string) => api().getHistorialDetalle(importacionId),
    seleccionarArchivo: ()                    => dialogApi().seleccionarArchivoImportCosto(),
  };
}
