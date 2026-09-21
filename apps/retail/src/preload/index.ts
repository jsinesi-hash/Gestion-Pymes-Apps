// packages/client/src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { StockEntradaPayload, StockAjustePayload, StockMermaPayload } from '../main/ipc/stock';
import type { DashboardVentas, DashboardStock, DashboardCaja } from '../main/ipc/dashboard';
import type {
  VentasKpisRangoParams, VentasKpisRangoResult,
  VentasEvolucionParams, EvolucionPoint,
  HeatmapEntry, VentasDiaMesEntry, VendedorEntry,
  AbcEntry, MargenCategoriaEntry,
} from '../main/ipc/dashboard-rango';
import type { DashboardCajaRango } from '../main/ipc/dashboard-caja-rango';
import type { DashboardClientesRango, DashboardClientesEstado } from '../main/ipc/dashboard-clientes';
import type { DashboardProveedoresRango, DashboardProveedoresEstado } from '../main/ipc/dashboard-proveedores';
import type { ExportRequest } from '@ferreteria/shared';
import type { ReporteVentasFiltros, ReporteVentasResult } from '../main/ipc/reportes';

/**
 * Puente seguro (contextBridge) entre el renderer y el main process.
 * El renderer NUNCA importa de 'electron' directamente.
 * Acceso desde el renderer: (window as any).ferreteria.getVersion()
 *
 * La API crece con cada módulo de negocio.
 */
contextBridge.exposeInMainWorld('ferreteria', {
  getVersion: () => ipcRenderer.invoke('app:version'),
  actualizacion: {
    estado:             () => ipcRenderer.invoke('actualizacion:estado'),
    instalarYReiniciar: () => ipcRenderer.invoke('actualizacion:instalarYReiniciar'),
    notasPostUpdate:    () => ipcRenderer.invoke('actualizacion:notasPostUpdate'),
    marcarVersionVista: () => ipcRenderer.invoke('actualizacion:marcarVersionVista'),
  },
  auth: {
    login:  (creds: unknown) => ipcRenderer.invoke('auth:login', creds),
    logout: ()               => ipcRenderer.invoke('auth:logout'),
    whoami: ()               => ipcRenderer.invoke('auth:whoami'),
    verifyPassword: (p: unknown) => ipcRenderer.invoke('auth:verifyPassword', p),
  },
  usuario: {
    list:           ()           => ipcRenderer.invoke('usuario:list'),
    create:         (p: unknown) => ipcRenderer.invoke('usuario:create', p),
    update:         (p: unknown) => ipcRenderer.invoke('usuario:update', p),
    changePassword: (p: unknown) => ipcRenderer.invoke('usuario:changePassword', p),
    desactivar:     (p: unknown) => ipcRenderer.invoke('usuario:desactivar', p),
    reactivar:      (p: unknown) => ipcRenderer.invoke('usuario:reactivar', p),
  },
  rol: {
    list: () => ipcRenderer.invoke('rol:list'),
  },
  permisos: {
    matriz: () => ipcRenderer.invoke('permiso:matriz'),
  },
  precios: {
    lista: {
      list:       ()           => ipcRenderer.invoke('listaPrecio:list'),
      get:        (p: unknown) => ipcRenderer.invoke('listaPrecio:get', p),
      create:     (p: unknown) => ipcRenderer.invoke('listaPrecio:create', p),
      update:     (p: unknown) => ipcRenderer.invoke('listaPrecio:update', p),
      deactivate: (p: unknown) => ipcRenderer.invoke('listaPrecio:deactivate', p),
    },
    valor: {
      getPrecioEnLista:           (p: unknown)      => ipcRenderer.invoke('listaPrecioValor:getPrecioEnLista', p),
      listarVigentesPorLista:     (listaId: string) => ipcRenderer.invoke('listaPrecioValor:listarVigentesPorLista', listaId),
      listarVigentesParaProducto: (productoId: string) => ipcRenderer.invoke('listaPrecioValor:listarVigentesParaProducto', productoId),
      setManual:                  (p: unknown)      => ipcRenderer.invoke('listaPrecioValor:setManual', p),
      contarAfectados:            (p: unknown)      => ipcRenderer.invoke('listaPrecioValor:contarAfectados', p),
      recalcularMasivo:           (p: unknown)      => ipcRenderer.invoke('listaPrecioValor:recalcularMasivo', p),
    },
    cambioProgramado: {
      crear:   (p: unknown)        => ipcRenderer.invoke('cambioProgramado:crear', p),
      cancelar:(id: string)        => ipcRenderer.invoke('cambioProgramado:cancelar', id),
      listar:  (listaId: string)   => ipcRenderer.invoke('cambioProgramado:listar', listaId),
    },
    // ADR-049 §2 — reglas de margen por lista.
    reglas: {
      listByLista: (listaId: string)              => ipcRenderer.invoke('reglaPrecio:listByLista', listaId),
      upsert:      (p: unknown)                    => ipcRenderer.invoke('reglaPrecio:upsert', p),
      remove:      (id: string)                    => ipcRenderer.invoke('reglaPrecio:remove', id),
    },
    // ADR-049 §4-6 — lotes de publicación de precios.
    batch: {
      crear:          (p: unknown)     => ipcRenderer.invoke('priceBatch:crear', p),
      obtener:        (id: string)     => ipcRenderer.invoke('priceBatch:obtener', id),
      listar:         (f?: unknown)    => ipcRenderer.invoke('priceBatch:listar', f),
      excluirFila:    (id: string)     => ipcRenderer.invoke('priceBatch:excluirFila', id),
      excluirErrores: (id: string)     => ipcRenderer.invoke('priceBatch:excluirErrores', id),
      revalidar:      (id: string)     => ipcRenderer.invoke('priceBatch:revalidar', id),
      aprobar:        (id: string)     => ipcRenderer.invoke('priceBatch:aprobar', id),
      publicar:       (id: string)     => ipcRenderer.invoke('priceBatch:publicar', id),
      revertir:       (id: string)     => ipcRenderer.invoke('priceBatch:revertir', id),
    },
  },
  catalogo: {
    impuesto: {
      list: () => ipcRenderer.invoke('impuesto:list'),
    },
    marca: {
      list:       () => ipcRenderer.invoke('marca:list'),
      listAll:    () => ipcRenderer.invoke('marca:list-all'),
      create:     (p: unknown) => ipcRenderer.invoke('marca:create', p),
      update:     (p: unknown) => ipcRenderer.invoke('marca:update', p),
      desactivar: (p: unknown) => ipcRenderer.invoke('marca:desactivar', p),
      reactivar:  (p: unknown) => ipcRenderer.invoke('marca:reactivar', p),
    },
    categoria: {
      list:       () => ipcRenderer.invoke('categoria:list'),
      listAll:    () => ipcRenderer.invoke('categoria:list-all'),
      create:     (p: unknown) => ipcRenderer.invoke('categoria:create', p),
      update:     (p: unknown) => ipcRenderer.invoke('categoria:update', p),
      desactivar: (p: unknown) => ipcRenderer.invoke('categoria:desactivar', p),
      reactivar:  (p: unknown) => ipcRenderer.invoke('categoria:reactivar', p),
    },
    ubicacion: {
      list:         () => ipcRenderer.invoke('ubicacion:list'),
      listAll:      () => ipcRenderer.invoke('ubicacion:list-all'),
      get:          (p: unknown) => ipcRenderer.invoke('ubicacion:get', p),
      create:       (p: unknown) => ipcRenderer.invoke('ubicacion:create', p),
      update:       (p: unknown) => ipcRenderer.invoke('ubicacion:update', p),
      delete:       (p: unknown) => ipcRenderer.invoke('ubicacion:delete', p),
      dedupPreview: () => ipcRenderer.invoke('ubicacion:dedup:preview'),
      dedupAplicar: () => ipcRenderer.invoke('ubicacion:dedup:aplicar'),
    },
    existencias: {
      get: (p: unknown) => ipcRenderer.invoke('existencias:get', p),
      setMinimos: (p: unknown) => ipcRenderer.invoke('existencias:set-minimos', p),
    },
    movimientoStock: {
      list: (p: unknown) => ipcRenderer.invoke('movimiento-stock:list', p),
      create: (p: unknown) => ipcRenderer.invoke('movimiento-stock:create', p),
    },
    stock: {
      entrada:          (p: StockEntradaPayload) => ipcRenderer.invoke('stock:entrada', p),
      ajuste:           (p: StockAjustePayload)  => ipcRenderer.invoke('stock:ajuste',  p),
      merma:            (p: StockMermaPayload)   => ipcRenderer.invoke('stock:merma',   p),
    },
    producto: {
      list:            (p: unknown) => ipcRenderer.invoke('producto:list', p),
      buscarSimilares: (p: unknown) => ipcRenderer.invoke('producto:buscarSimilares', p),
      get:         (p: unknown) => ipcRenderer.invoke('producto:get', p),
      create:      (p: unknown) => ipcRenderer.invoke('producto:create', p),
      quickCreate: (p: unknown) => ipcRenderer.invoke('producto:quickCreate', p),
      update:      (p: unknown) => ipcRenderer.invoke('producto:update', p),
      deactivate:  (p: unknown) => ipcRenderer.invoke('producto:deactivate', p),
      stockCounts: ()           => ipcRenderer.invoke('producto:stockCounts'),
      setDiscontinuado: (p: unknown) => ipcRenderer.invoke('producto:setDiscontinuado', p),
      equivalencia: {
        list:   (p: unknown) => ipcRenderer.invoke('equivalencia:list', p),
        add:    (p: unknown) => ipcRenderer.invoke('equivalencia:add', p),
        remove: (p: unknown) => ipcRenderer.invoke('equivalencia:remove', p),
      },
    },
    preferencias: {
      get: (p: unknown) => ipcRenderer.invoke('preferencias:get', p),
      save: (p: unknown) => ipcRenderer.invoke('preferencias:save', p),
    },
    print: {
      productLabel:  (p: unknown) => ipcRenderer.invoke('print:product-label', p),
      locationLabel: (p: unknown) => ipcRenderer.invoke('print:location-label', p),
      html:          (h: string)  => ipcRenderer.invoke('print:html', h),
    },
  },
  caja: {
    getActiva:       ()           => ipcRenderer.invoke('caja:getActiva'),
    abrir:           (p: unknown) => ipcRenderer.invoke('caja:abrir', p),
    addMovimiento:   (p: unknown) => ipcRenderer.invoke('caja:addMovimiento', p),
    calcularCierre:  (p: unknown) => ipcRenderer.invoke('caja:calcularCierre', p),
    cerrar:          (p: unknown) => ipcRenderer.invoke('caja:cerrar', p),
    listMovimientos: (p: unknown) => ipcRenderer.invoke('caja:listMovimientos', p),
  },
  parametros: {
    get: (p: unknown) => ipcRenderer.invoke('parametros:get', p),
    set: (p: unknown) => ipcRenderer.invoke('parametros:set', p),
    listFlags: () => ipcRenderer.invoke('parametros:listFlags'),
  },
  smtp: {
    getConfig:   ()           => ipcRenderer.invoke('smtp:getConfig'),
    setConfig:   (p: unknown) => ipcRenderer.invoke('smtp:setConfig', p),
    setPassword: (p: unknown) => ipcRenderer.invoke('smtp:setPassword', p),
    probar:      ()           => ipcRenderer.invoke('smtp:probar'),
  },
  venta: {
    confirmar:  (p: unknown) => ipcRenderer.invoke('venta:confirmar', p),
    anular:     (p: unknown) => ipcRenderer.invoke('venta:anular', p),
    listByCaja: (p: unknown) => ipcRenderer.invoke('venta:listByCaja', p),
    get:        (p: unknown) => ipcRenderer.invoke('venta:get', p),
    espera: {
      pausar:    (p: unknown) => ipcRenderer.invoke('venta.espera:pausar', p),
      listar:    ()           => ipcRenderer.invoke('venta.espera:listar'),
      retomar:   (p: unknown) => ipcRenderer.invoke('venta.espera:retomar', p),
      descartar: (p: unknown) => ipcRenderer.invoke('venta.espera:descartar', p),
    },
  },
  importar: {
    productos: {
      validar:   (p: unknown) => ipcRenderer.invoke('importar:productos:validar', p),
      confirmar: (p: unknown) => ipcRenderer.invoke('importar:productos:confirmar', p),
    },
    clientes: {
      validar:   (p: unknown) => ipcRenderer.invoke('importar:clientes:validar', p),
      confirmar: (p: unknown) => ipcRenderer.invoke('importar:clientes:confirmar', p),
    },
    proveedores: {
      validar:   (p: unknown) => ipcRenderer.invoke('importar:proveedores:validar', p),
      confirmar: (p: unknown) => ipcRenderer.invoke('importar:proveedores:confirmar', p),
    },
    ubicaciones: {
      validar:   (p: unknown) => ipcRenderer.invoke('importar:ubicaciones:validar', p),
      confirmar: (p: unknown) => ipcRenderer.invoke('importar:ubicaciones:confirmar', p),
    },
    stockInicial: {
      validar:   (p: unknown) => ipcRenderer.invoke('importar:stock-inicial:validar', p),
      confirmar: (p: unknown) => ipcRenderer.invoke('importar:stock-inicial:confirmar', p),
    },
    plantilla: (p: unknown) => ipcRenderer.invoke('importar:plantilla', p),
    validarFila: (p: unknown) => ipcRenderer.invoke('importar:validarFila', p),
  },
  dashboard: {
    ventas: (): Promise<DashboardVentas> => ipcRenderer.invoke('dashboard:ventas'),
    stock:  (): Promise<DashboardStock>  => ipcRenderer.invoke('dashboard:stock'),
    caja:   (): Promise<DashboardCaja>   => ipcRenderer.invoke('dashboard:caja'),
    ventasKpisRango:          (p: VentasKpisRangoParams)         => ipcRenderer.invoke('dashboard:ventas-kpis-rango', p) as Promise<VentasKpisRangoResult>,
    ventasEvolucion:          (p: VentasEvolucionParams)         => ipcRenderer.invoke('dashboard:ventas-evolucion', p) as Promise<EvolucionPoint[]>,
    ventasHeatmap:            (p: { desde: Date; hasta: Date; categoria_id?: string | null })  => ipcRenderer.invoke('dashboard:ventas-heatmap', p) as Promise<HeatmapEntry[]>,
    ventasDiaMes:             (p: { desde: Date; hasta: Date; categoria_id?: string | null })  => ipcRenderer.invoke('dashboard:ventas-dia-mes', p) as Promise<VentasDiaMesEntry[]>,
    ventasVendedor:           (p: { desde: Date; hasta: Date; categoria_id?: string | null })  => ipcRenderer.invoke('dashboard:ventas-vendedor', p) as Promise<VendedorEntry[]>,
    productosAbc:             (p: { desde: Date; hasta: Date })  => ipcRenderer.invoke('dashboard:productos-abc', p) as Promise<AbcEntry[]>,
    productosMargenCategoria: (p: { desde: Date; hasta: Date })  => ipcRenderer.invoke('dashboard:productos-margen-categoria', p) as Promise<MargenCategoriaEntry[]>,
    cajaRango:          (p: { desde: Date; hasta: Date }) => ipcRenderer.invoke('dashboard:caja-rango', p) as Promise<DashboardCajaRango>,
    clientesRango:      (p: { desde: Date; hasta: Date }) => ipcRenderer.invoke('dashboard:clientes-rango', p) as Promise<DashboardClientesRango>,
    clientesEstado:     ()                                => ipcRenderer.invoke('dashboard:clientes-estado') as Promise<DashboardClientesEstado>,
    proveedoresRango:   (p: { desde: Date; hasta: Date }) => ipcRenderer.invoke('dashboard:proveedores-rango', p) as Promise<DashboardProveedoresRango>,
    proveedoresEstado:  ()                                => ipcRenderer.invoke('dashboard:proveedores-estado') as Promise<DashboardProveedoresEstado>,
  },
  exportar: {
    ejecutar: (req: ExportRequest): Promise<void> => ipcRenderer.invoke('exportar:ejecutar', req),
  },
  reportes: {
    detalleVentas: (filtros: ReporteVentasFiltros, page: number, pageSize: number): Promise<ReporteVentasResult> =>
      ipcRenderer.invoke('reportes:detalleVentas', filtros, page, pageSize),
  },
  compras: {
    proveedor: {
      list:       ()           => ipcRenderer.invoke('compras.proveedor:list'),
      get:        (id: string) => ipcRenderer.invoke('compras.proveedor:get', id),
      upsert:     (p: unknown) => ipcRenderer.invoke('compras.proveedor:upsert', p),
      deactivate: (id: string) => ipcRenderer.invoke('compras.proveedor:deactivate', id),
      productos: {
        listar:     (proveedorId: string)        => ipcRenderer.invoke('compras.pp:listByProveedor', proveedorId),
        asociar:    (p: unknown)                 => ipcRenderer.invoke('compras.pp:asociar', p),
        asociarLote: (p: unknown)                => ipcRenderer.invoke('compras.pp:asociarLote', p),
        desasociar: (id: string)                 => ipcRenderer.invoke('compras.pp:desasociar', id),
        actualizar: (id: string, patch: unknown) => ipcRenderer.invoke('compras.pp:actualizar', id, patch),
      },
    },
    pp: {
      listByProducto: (productoId: string) => ipcRenderer.invoke('compras.pp:listByProducto', productoId),
      upsert:         (p: unknown)          => ipcRenderer.invoke('compras.pp:upsert', p),
      setPreferido:   (id: string)          => ipcRenderer.invoke('compras.pp:setPreferido', id),
      remove:         (id: string)          => ipcRenderer.invoke('compras.pp:remove', id),
      setOverrides:   (id: string, patch: unknown) => ipcRenderer.invoke('compras.pp:setOverrides', id, patch),
    },
    oc: {
      list:           ()           => ipcRenderer.invoke('compras.oc:list'),
      get:            (id: string) => ipcRenderer.invoke('compras.oc:get', id),
      crear:          (p: unknown) => ipcRenderer.invoke('compras.oc:crear', p),
      agregarItem:    (p: unknown) => ipcRenderer.invoke('compras.oc:agregarItem', p),
      actualizarItem: (p: unknown) => ipcRenderer.invoke('compras.oc:actualizarItem', p),
      eliminarItem:   (id: string) => ipcRenderer.invoke('compras.oc:eliminarItem', id),
      emitir:         (id: string) => ipcRenderer.invoke('compras.oc:emitir', id),
      anular:         (id: string) => ipcRenderer.invoke('compras.oc:anular', id),
      sugerir:        ()           => ipcRenderer.invoke('compras.oc:sugerir'),
    },
    recepcion: {
      crear:     (p: unknown)  => ipcRenderer.invoke('compras.recepcion:crear', p),
      listByOC:  (ocId: string) => ipcRenderer.invoke('compras.recepcion:listByOC', ocId),
      get:       (id: string)  => ipcRenderer.invoke('compras.recepcion:get', id),
    },
  },
  geo: {
    provincias:   ()                              => ipcRenderer.invoke('geo:provincias'),
    localidades:  (provinciaId: string, q = '')   => ipcRenderer.invoke('geo:localidades', provinciaId, q),
  },
  cliente: {
    list:       (p?: unknown) => ipcRenderer.invoke('cliente:list', p),
    get:        (id: string)  => ipcRenderer.invoke('cliente:get', id),
    upsert:     (p: unknown)  => ipcRenderer.invoke('cliente:upsert', p),
    desactivar: (p: unknown)  => ipcRenderer.invoke('cliente:desactivar', p),
    reactivar:  (p: unknown)  => ipcRenderer.invoke('cliente:reactivar', p),
  },
  ctacte: {
    list:                  ()           => ipcRenderer.invoke('ctacte:list'),
    getByCliente:          (id: string) => ipcRenderer.invoke('ctacte:getByCliente', id),
    setLimite:             (p: unknown) => ipcRenderer.invoke('ctacte:setLimite', p),
    registrarSaldoInicial: (p: unknown) => ipcRenderer.invoke('ctacte:registrarSaldoInicial', p),
    registrarCobro:        (p: unknown) => ipcRenderer.invoke('ctacte:registrarCobro', p),
  },
  backup: {
    ejecutar: (p: unknown) => ipcRenderer.invoke('backup:ejecutar', p),
    listar:   (p: unknown) => ipcRenderer.invoke('backup:listar', p),
    eliminar: (p: unknown) => ipcRenderer.invoke('backup:eliminar', p),
    evaluarDepuracion: () => ipcRenderer.invoke('backup:evaluarDepuracion'),
    depurar: (p: unknown) => ipcRenderer.invoke('backup:depurar', p),
  },
  demoCatalog: {
    estado: () => ipcRenderer.invoke('demoCatalog:estado'),
    cargar: () => ipcRenderer.invoke('demoCatalog:cargar'),
    vaciar: () => ipcRenderer.invoke('demoCatalog:vaciar'),
  },
  sinonimo: {
    list:   (p: unknown) => ipcRenderer.invoke('sinonimo:list', p),
    get:    (p: unknown) => ipcRenderer.invoke('sinonimo:get', p),
    create: (p: unknown) => ipcRenderer.invoke('sinonimo:create', p),
    update: (p: unknown) => ipcRenderer.invoke('sinonimo:update', p),
    delete: (p: unknown) => ipcRenderer.invoke('sinonimo:delete', p),
    importarValidar: (p: unknown) => ipcRenderer.invoke('sinonimo:importarValidar', p),
    importar:        (p: unknown) => ipcRenderer.invoke('sinonimo:importar', p),
  },
  restore: {
    validar:  (p: unknown) => ipcRenderer.invoke('restore:validar', p),
    ejecutar: (p: unknown) => ipcRenderer.invoke('restore:ejecutar', p),
  },
  dialog: {
    seleccionarCarpeta:              (): Promise<string | null> => ipcRenderer.invoke('dialog:seleccionarCarpeta'),
    seleccionarArchivo:              (): Promise<string | null> => ipcRenderer.invoke('dialog:seleccionarArchivo'),
    getDefaultBackupPath:            (): Promise<string>        => ipcRenderer.invoke('dialog:getDefaultBackupPath'),
    seleccionarArchivoImportCosto:   (): Promise<string | null> => ipcRenderer.invoke('dialog:seleccionarArchivoImportCosto'),
  },
  etiquetas: {
    listarProductos: (p: unknown) => ipcRenderer.invoke('etiquetas:listar-productos', p),
    listarPerfiles:  ()           => ipcRenderer.invoke('etiquetas:listar-perfiles'),
    guardarPerfil:   (p: unknown) => ipcRenderer.invoke('etiquetas:guardar-perfil', p),
    generarPdf:      (p: unknown) => ipcRenderer.invoke('etiquetas:generar-pdf', p),
    vistaPrevia:     (p: unknown) => ipcRenderer.invoke('etiquetas:vista-previa', p),
    imprimir:        (p: unknown) => ipcRenderer.invoke('etiquetas:imprimir', p),
    exportarPdf:     (p: unknown) => ipcRenderer.invoke('etiquetas:exportar-pdf', p),
  },
  importacionCosto: {
    parseArchivo:    (p: unknown)          => ipcRenderer.invoke('importacionCosto:parseArchivo', p),
    revalidarFila:   (p: unknown)          => ipcRenderer.invoke('importacionCosto:revalidarFila', p),
    buscarProductos: (p: unknown)          => ipcRenderer.invoke('importacionCosto:buscarProductos', p),
    confirmar:       (p: unknown)          => ipcRenderer.invoke('importacionCosto:confirmar', p),
    getColaRevision: ()                    => ipcRenderer.invoke('importacionCosto:getColaRevision'),
    resolverFila:    (p: unknown)          => ipcRenderer.invoke('importacionCosto:resolverFila', p),
    descartarFila:   (detalleId: string)   => ipcRenderer.invoke('importacionCosto:descartarFila', detalleId),
    actualizarFila:  (p: unknown)          => ipcRenderer.invoke('importacionCosto:actualizarFila', p),
    cancelar:        (p: unknown)          => ipcRenderer.invoke('importacionCosto:cancelar', p),
    eliminar:        (p: unknown)          => ipcRenderer.invoke('importacionCosto:eliminar', p),
    getHistorial:        ()                    => ipcRenderer.invoke('importacionCosto:getHistorial'),
    getHistorialDetalle: (importacionId: string) => ipcRenderer.invoke('importacionCosto:getHistorialDetalle', importacionId),
  },
  importacionCatalogo: {
    parseArchivo:        (p: unknown)  => ipcRenderer.invoke('importacionCatalogo:parseArchivo', p),
    revalidarFila:       (p: unknown)  => ipcRenderer.invoke('importacionCatalogo:revalidarFila', p),
    confirmar:           (p: unknown)  => ipcRenderer.invoke('importacionCatalogo:confirmar', p),
    getHistorial:        ()            => ipcRenderer.invoke('importacionCatalogo:getHistorial'),
    getHistorialDetalle: (id: string)  => ipcRenderer.invoke('importacionCatalogo:getHistorialDetalle', id),
    buscarProductos:     (p: unknown)  => ipcRenderer.invoke('importacionCatalogo:buscarProductos', p),
  },
  unidad: {
    list:       () => ipcRenderer.invoke('unidad:list'),
    listAll:    () => ipcRenderer.invoke('unidad:list-all'),
    create:     (p: unknown) => ipcRenderer.invoke('unidad:create', p),
    update:     (p: unknown) => ipcRenderer.invoke('unidad:update', p),
    desactivar: (p: unknown) => ipcRenderer.invoke('unidad:desactivar', p),
    reactivar:  (p: unknown) => ipcRenderer.invoke('unidad:reactivar', p),
  },
  presentacion: {
    listByProducto: (p: unknown) => ipcRenderer.invoke('presentacion:listByProducto', p),
    create:         (p: unknown) => ipcRenderer.invoke('presentacion:create', p),
    update:         (p: unknown) => ipcRenderer.invoke('presentacion:update', p),
    setDefault:     (p: unknown) => ipcRenderer.invoke('presentacion:setDefault', p),
    desactivar:     (p: unknown) => ipcRenderer.invoke('presentacion:desactivar', p),
    eliminar:       (p: unknown) => ipcRenderer.invoke('presentacion:eliminar', p),
    reactivar:      (p: unknown) => ipcRenderer.invoke('presentacion:reactivar', p),
    buscarPorGtin:  (p: unknown) => ipcRenderer.invoke('presentacion:buscarPorGtin', p),
  },
  remito: {
    crear:     (p: unknown) => ipcRenderer.invoke('remito:crear', p),
    editar:    (p: unknown) => ipcRenderer.invoke('remito:editar', p),
    listar:    (p: unknown) => ipcRenderer.invoke('remito:listar', p),
    obtener:   (p: unknown) => ipcRenderer.invoke('remito:obtener', p),
    pendiente: (p: unknown) => ipcRenderer.invoke('remito:pendiente', p),
    conformar: (p: unknown) => ipcRenderer.invoke('remito:conformar', p),
    anular:    (p: unknown) => ipcRenderer.invoke('remito:anular', p),
    imprimir:  (p: unknown) => ipcRenderer.invoke('remito:imprimir', p),
  },
  transportista: {
    list:       (p?: unknown) => ipcRenderer.invoke('transportista:list', p),
    get:        (id: string)  => ipcRenderer.invoke('transportista:get', id),
    upsert:     (p: unknown)  => ipcRenderer.invoke('transportista:upsert', p),
    deactivate: (id: string)  => ipcRenderer.invoke('transportista:deactivate', id),
  },
  presupuesto: {
    crear:              (p: unknown) => ipcRenderer.invoke('presupuesto:crear', p),
    editar:             (p: unknown) => ipcRenderer.invoke('presupuesto:editar', p),
    listar:             (p: unknown) => ipcRenderer.invoke('presupuesto:listar', p),
    obtener:            (p: unknown) => ipcRenderer.invoke('presupuesto:obtener', p),
    anular:             (p: unknown) => ipcRenderer.invoke('presupuesto:anular', p),
    emitir:             (p: unknown) => ipcRenderer.invoke('presupuesto:emitir', p),
    prepararConversion: (p: unknown) => ipcRenderer.invoke('presupuesto:prepararConversion', p),
    config:             ()          => ipcRenderer.invoke('presupuesto:config'),
    imprimir:           (p: unknown) => ipcRenderer.invoke('presupuesto:imprimir', p),
  },
  rutina: {
    list:     (p?: unknown) => ipcRenderer.invoke('rutina:list', p),
    crear:    (p: unknown)  => ipcRenderer.invoke('rutina:crear', p),
    editar:   (p: unknown)  => ipcRenderer.invoke('rutina:editar', p),
    pausar:   (p: unknown)  => ipcRenderer.invoke('rutina:pausar', p),
    reanudar: (p: unknown)  => ipcRenderer.invoke('rutina:reanudar', p),
    eliminar: (p: unknown)  => ipcRenderer.invoke('rutina:eliminar', p),
  },
  agenda: {
    crearEvento: (p: unknown)  => ipcRenderer.invoke('agenda:crearEvento', p),
    listar:      (p?: unknown) => ipcRenderer.invoke('agenda:listar', p),
    completar:   (p: unknown)  => ipcRenderer.invoke('agenda:completar', p),
    posponer:    (p: unknown)  => ipcRenderer.invoke('agenda:posponer', p),
    descartar:   (p: unknown)  => ipcRenderer.invoke('agenda:descartar', p),
  },
  aviso: {
    listar:     (p?: unknown) => ipcRenderer.invoke('aviso:listar', p),
    reintentar: (p: unknown)  => ipcRenderer.invoke('aviso:reintentar', p),
    descartar:  (p: unknown)  => ipcRenderer.invoke('aviso:descartar', p),
    badge:      ()            => ipcRenderer.invoke('aviso:badge'),
  },
  menu: {
    // Suscribe un callback a las acciones del menú nativo. Devuelve una función para
    // desuscribir. Electron proxya la función devuelta a través del contextBridge.
    onAccion: (cb: (payload: { action: string }) => void) => {
      const handler = (_e: unknown, payload: { action: string }) => cb(payload);
      ipcRenderer.on('menu:accion', handler);
      return () => ipcRenderer.removeListener('menu:accion', handler);
    },
    // Pide al main reconstruir el menú según la sesión actual.
    rebuild: () => ipcRenderer.invoke('menu:rebuild'),
  },
});
