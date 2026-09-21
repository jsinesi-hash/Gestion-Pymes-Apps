const api = () => (window as any).ferreteria.importacionCatalogo;
const dialogApi = () => (window as any).ferreteria.dialog;

export function useImportacionCatalogo() {
  return {
    parseArchivo:         (p: unknown)   => api().parseArchivo(p),
    revalidarFila:        (p: unknown)   => api().revalidarFila(p),
    confirmar:            (p: unknown)   => api().confirmar(p),
    getHistorial:         ()             => api().getHistorial(),
    getHistorialDetalle:  (id: string)   => api().getHistorialDetalle(id),
    buscarProductos:      (p: unknown)   => api().buscarProductos(p),
    seleccionarArchivo:   ()             => dialogApi().seleccionarArchivoImportCosto(),
  };
}
