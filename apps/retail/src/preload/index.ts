// apps/retail/src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import { createBridge } from '@core/preload';
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
import type { ReporteVentasFiltros, ReporteVentasResult } from '../main/ipc/reportes';

/**
 * Puente seguro (contextBridge) entre el renderer y el main process.
 * El renderer NUNCA importa de 'electron' directamente.
 * Acceso desde el renderer: (window as any).ferreteria.getVersion()
 *
 * Los namespaces universales (auth, usuario, rol, permisos, preferencias, parametros,
 * geo, cliente, ctacte, caja, backup, restore, dialog[core], exportar, getVersion) los
 * aporta `@core/preload`; acá se declara únicamente lo propio de Retail. `createBridge`
 * hace la única llamada a `exposeInMainWorld` y valida colisiones de método.
 */
createBridge({
  exposeAs: 'ferreteria',
  app: (invoke) => ({
    actualizacion: {
      estado:             () => invoke('actualizacion:estado'),
      instalarYReiniciar: () => invoke('actualizacion:instalarYReiniciar'),
      notasPostUpdate:    () => invoke('actualizacion:notasPostUpdate'),
      marcarVersionVista: () => invoke('actualizacion:marcarVersionVista'),
    },
    precios: {
      lista: {
        list:       ()           => invoke('listaPrecio:list'),
        get:        (p: unknown) => invoke('listaPrecio:get', p),
        create:     (p: unknown) => invoke('listaPrecio:create', p),
        update:     (p: unknown) => invoke('listaPrecio:update', p),
        deactivate: (p: unknown) => invoke('listaPrecio:deactivate', p),
      },
      valor: {
        getPrecioEnLista:           (p: unknown)      => invoke('listaPrecioValor:getPrecioEnLista', p),
        listarVigentesPorLista:     (listaId: string) => invoke('listaPrecioValor:listarVigentesPorLista', listaId),
        listarVigentesParaProducto: (productoId: string) => invoke('listaPrecioValor:listarVigentesParaProducto', productoId),
        setManual:                  (p: unknown)      => invoke('listaPrecioValor:setManual', p),
        contarAfectados:            (p: unknown)      => invoke('listaPrecioValor:contarAfectados', p),
        recalcularMasivo:           (p: unknown)      => invoke('listaPrecioValor:recalcularMasivo', p),
      },
      cambioProgramado: {
        crear:   (p: unknown)        => invoke('cambioProgramado:crear', p),
        cancelar:(id: string)        => invoke('cambioProgramado:cancelar', id),
        listar:  (listaId: string)   => invoke('cambioProgramado:listar', listaId),
      },
      // ADR-049 §2 — reglas de margen por lista.
      reglas: {
        listByLista: (listaId: string)              => invoke('reglaPrecio:listByLista', listaId),
        upsert:      (p: unknown)                    => invoke('reglaPrecio:upsert', p),
        remove:      (id: string)                    => invoke('reglaPrecio:remove', id),
      },
      // ADR-049 §4-6 — lotes de publicación de precios.
      batch: {
        crear:          (p: unknown)     => invoke('priceBatch:crear', p),
        obtener:        (id: string)     => invoke('priceBatch:obtener', id),
        listar:         (f?: unknown)    => invoke('priceBatch:listar', f),
        excluirFila:    (id: string)     => invoke('priceBatch:excluirFila', id),
        excluirErrores: (id: string)     => invoke('priceBatch:excluirErrores', id),
        revalidar:      (id: string)     => invoke('priceBatch:revalidar', id),
        aprobar:        (id: string)     => invoke('priceBatch:aprobar', id),
        publicar:       (id: string)     => invoke('priceBatch:publicar', id),
        revertir:       (id: string)     => invoke('priceBatch:revertir', id),
      },
    },
    catalogo: {
      impuesto: {
        list: () => invoke('impuesto:list'),
      },
      marca: {
        list:       () => invoke('marca:list'),
        listAll:    () => invoke('marca:list-all'),
        create:     (p: unknown) => invoke('marca:create', p),
        update:     (p: unknown) => invoke('marca:update', p),
        desactivar: (p: unknown) => invoke('marca:desactivar', p),
        reactivar:  (p: unknown) => invoke('marca:reactivar', p),
      },
      categoria: {
        list:       () => invoke('categoria:list'),
        listAll:    () => invoke('categoria:list-all'),
        create:     (p: unknown) => invoke('categoria:create', p),
        update:     (p: unknown) => invoke('categoria:update', p),
        desactivar: (p: unknown) => invoke('categoria:desactivar', p),
        reactivar:  (p: unknown) => invoke('categoria:reactivar', p),
      },
      ubicacion: {
        list:         () => invoke('ubicacion:list'),
        listAll:      () => invoke('ubicacion:list-all'),
        get:          (p: unknown) => invoke('ubicacion:get', p),
        create:       (p: unknown) => invoke('ubicacion:create', p),
        update:       (p: unknown) => invoke('ubicacion:update', p),
        delete:       (p: unknown) => invoke('ubicacion:delete', p),
        dedupPreview: () => invoke('ubicacion:dedup:preview'),
        dedupAplicar: () => invoke('ubicacion:dedup:aplicar'),
      },
      existencias: {
        get: (p: unknown) => invoke('existencias:get', p),
        setMinimos: (p: unknown) => invoke('existencias:set-minimos', p),
      },
      movimientoStock: {
        list: (p: unknown) => invoke('movimiento-stock:list', p),
        create: (p: unknown) => invoke('movimiento-stock:create', p),
      },
      stock: {
        entrada:          (p: StockEntradaPayload) => invoke('stock:entrada', p),
        ajuste:           (p: StockAjustePayload)  => invoke('stock:ajuste',  p),
        merma:            (p: StockMermaPayload)   => invoke('stock:merma',   p),
      },
      producto: {
        list:            (p: unknown) => invoke('producto:list', p),
        buscarSimilares: (p: unknown) => invoke('producto:buscarSimilares', p),
        get:         (p: unknown) => invoke('producto:get', p),
        create:      (p: unknown) => invoke('producto:create', p),
        quickCreate: (p: unknown) => invoke('producto:quickCreate', p),
        update:      (p: unknown) => invoke('producto:update', p),
        deactivate:  (p: unknown) => invoke('producto:deactivate', p),
        stockCounts: ()           => invoke('producto:stockCounts'),
        setDiscontinuado: (p: unknown) => invoke('producto:setDiscontinuado', p),
        equivalencia: {
          list:   (p: unknown) => invoke('equivalencia:list', p),
          add:    (p: unknown) => invoke('equivalencia:add', p),
          remove: (p: unknown) => invoke('equivalencia:remove', p),
        },
      },
      print: {
        productLabel:  (p: unknown) => invoke('print:product-label', p),
        locationLabel: (p: unknown) => invoke('print:location-label', p),
        html:          (h: string)  => invoke('print:html', h),
      },
    },
    smtp: {
      getConfig:   ()           => invoke('smtp:getConfig'),
      setConfig:   (p: unknown) => invoke('smtp:setConfig', p),
      setPassword: (p: unknown) => invoke('smtp:setPassword', p),
      probar:      ()           => invoke('smtp:probar'),
    },
    venta: {
      confirmar:  (p: unknown) => invoke('venta:confirmar', p),
      anular:     (p: unknown) => invoke('venta:anular', p),
      listByCaja: (p: unknown) => invoke('venta:listByCaja', p),
      get:        (p: unknown) => invoke('venta:get', p),
      espera: {
        pausar:    (p: unknown) => invoke('venta.espera:pausar', p),
        listar:    ()           => invoke('venta.espera:listar'),
        retomar:   (p: unknown) => invoke('venta.espera:retomar', p),
        descartar: (p: unknown) => invoke('venta.espera:descartar', p),
      },
    },
    importar: {
      productos: {
        validar:   (p: unknown) => invoke('importar:productos:validar', p),
        confirmar: (p: unknown) => invoke('importar:productos:confirmar', p),
      },
      clientes: {
        validar:   (p: unknown) => invoke('importar:clientes:validar', p),
        confirmar: (p: unknown) => invoke('importar:clientes:confirmar', p),
      },
      proveedores: {
        validar:   (p: unknown) => invoke('importar:proveedores:validar', p),
        confirmar: (p: unknown) => invoke('importar:proveedores:confirmar', p),
      },
      ubicaciones: {
        validar:   (p: unknown) => invoke('importar:ubicaciones:validar', p),
        confirmar: (p: unknown) => invoke('importar:ubicaciones:confirmar', p),
      },
      stockInicial: {
        validar:   (p: unknown) => invoke('importar:stock-inicial:validar', p),
        confirmar: (p: unknown) => invoke('importar:stock-inicial:confirmar', p),
      },
      plantilla: (p: unknown) => invoke('importar:plantilla', p),
      validarFila: (p: unknown) => invoke('importar:validarFila', p),
    },
    dashboard: {
      ventas: (): Promise<DashboardVentas> => invoke('dashboard:ventas'),
      stock:  (): Promise<DashboardStock>  => invoke('dashboard:stock'),
      caja:   (): Promise<DashboardCaja>   => invoke('dashboard:caja'),
      ventasKpisRango:          (p: VentasKpisRangoParams)         => invoke('dashboard:ventas-kpis-rango', p) as Promise<VentasKpisRangoResult>,
      ventasEvolucion:          (p: VentasEvolucionParams)         => invoke('dashboard:ventas-evolucion', p) as Promise<EvolucionPoint[]>,
      ventasHeatmap:            (p: { desde: Date; hasta: Date; categoria_id?: string | null })  => invoke('dashboard:ventas-heatmap', p) as Promise<HeatmapEntry[]>,
      ventasDiaMes:             (p: { desde: Date; hasta: Date; categoria_id?: string | null })  => invoke('dashboard:ventas-dia-mes', p) as Promise<VentasDiaMesEntry[]>,
      ventasVendedor:           (p: { desde: Date; hasta: Date; categoria_id?: string | null })  => invoke('dashboard:ventas-vendedor', p) as Promise<VendedorEntry[]>,
      productosAbc:             (p: { desde: Date; hasta: Date })  => invoke('dashboard:productos-abc', p) as Promise<AbcEntry[]>,
      productosMargenCategoria: (p: { desde: Date; hasta: Date })  => invoke('dashboard:productos-margen-categoria', p) as Promise<MargenCategoriaEntry[]>,
      cajaRango:          (p: { desde: Date; hasta: Date }) => invoke('dashboard:caja-rango', p) as Promise<DashboardCajaRango>,
      clientesRango:      (p: { desde: Date; hasta: Date }) => invoke('dashboard:clientes-rango', p) as Promise<DashboardClientesRango>,
      clientesEstado:     ()                                => invoke('dashboard:clientes-estado') as Promise<DashboardClientesEstado>,
      proveedoresRango:   (p: { desde: Date; hasta: Date }) => invoke('dashboard:proveedores-rango', p) as Promise<DashboardProveedoresRango>,
      proveedoresEstado:  ()                                => invoke('dashboard:proveedores-estado') as Promise<DashboardProveedoresEstado>,
    },
    reportes: {
      detalleVentas: (filtros: ReporteVentasFiltros, page: number, pageSize: number): Promise<ReporteVentasResult> =>
        invoke('reportes:detalleVentas', filtros, page, pageSize),
    },
    compras: {
      proveedor: {
        list:       ()           => invoke('compras.proveedor:list'),
        get:        (id: string) => invoke('compras.proveedor:get', id),
        upsert:     (p: unknown) => invoke('compras.proveedor:upsert', p),
        deactivate: (id: string) => invoke('compras.proveedor:deactivate', id),
        productos: {
          listar:     (proveedorId: string)        => invoke('compras.pp:listByProveedor', proveedorId),
          asociar:    (p: unknown)                 => invoke('compras.pp:asociar', p),
          asociarLote: (p: unknown)                => invoke('compras.pp:asociarLote', p),
          desasociar: (id: string)                 => invoke('compras.pp:desasociar', id),
          actualizar: (id: string, patch: unknown) => invoke('compras.pp:actualizar', id, patch),
        },
      },
      pp: {
        listByProducto: (productoId: string) => invoke('compras.pp:listByProducto', productoId),
        upsert:         (p: unknown)          => invoke('compras.pp:upsert', p),
        setPreferido:   (id: string)          => invoke('compras.pp:setPreferido', id),
        remove:         (id: string)          => invoke('compras.pp:remove', id),
        setOverrides:   (id: string, patch: unknown) => invoke('compras.pp:setOverrides', id, patch),
      },
      oc: {
        list:           ()           => invoke('compras.oc:list'),
        get:            (id: string) => invoke('compras.oc:get', id),
        crear:          (p: unknown) => invoke('compras.oc:crear', p),
        agregarItem:    (p: unknown) => invoke('compras.oc:agregarItem', p),
        actualizarItem: (p: unknown) => invoke('compras.oc:actualizarItem', p),
        eliminarItem:   (id: string) => invoke('compras.oc:eliminarItem', id),
        emitir:         (id: string) => invoke('compras.oc:emitir', id),
        anular:         (id: string) => invoke('compras.oc:anular', id),
        sugerir:        ()           => invoke('compras.oc:sugerir'),
      },
      recepcion: {
        crear:     (p: unknown)  => invoke('compras.recepcion:crear', p),
        listByOC:  (ocId: string) => invoke('compras.recepcion:listByOC', ocId),
        get:       (id: string)  => invoke('compras.recepcion:get', id),
      },
    },
    demoCatalog: {
      estado: () => invoke('demoCatalog:estado'),
      cargar: () => invoke('demoCatalog:cargar'),
      vaciar: () => invoke('demoCatalog:vaciar'),
    },
    sinonimo: {
      list:   (p: unknown) => invoke('sinonimo:list', p),
      get:    (p: unknown) => invoke('sinonimo:get', p),
      create: (p: unknown) => invoke('sinonimo:create', p),
      update: (p: unknown) => invoke('sinonimo:update', p),
      delete: (p: unknown) => invoke('sinonimo:delete', p),
      importarValidar: (p: unknown) => invoke('sinonimo:importarValidar', p),
      importar:        (p: unknown) => invoke('sinonimo:importar', p),
    },
    dialog: {
      seleccionarArchivoImportCosto: (): Promise<string | null> => invoke('dialog:seleccionarArchivoImportCosto'),
    },
    etiquetas: {
      listarProductos: (p: unknown) => invoke('etiquetas:listar-productos', p),
      listarPerfiles:  ()           => invoke('etiquetas:listar-perfiles'),
      guardarPerfil:   (p: unknown) => invoke('etiquetas:guardar-perfil', p),
      generarPdf:      (p: unknown) => invoke('etiquetas:generar-pdf', p),
      vistaPrevia:     (p: unknown) => invoke('etiquetas:vista-previa', p),
      imprimir:        (p: unknown) => invoke('etiquetas:imprimir', p),
      exportarPdf:     (p: unknown) => invoke('etiquetas:exportar-pdf', p),
    },
    importacionCosto: {
      parseArchivo:    (p: unknown)          => invoke('importacionCosto:parseArchivo', p),
      revalidarFila:   (p: unknown)          => invoke('importacionCosto:revalidarFila', p),
      buscarProductos: (p: unknown)          => invoke('importacionCosto:buscarProductos', p),
      confirmar:       (p: unknown)          => invoke('importacionCosto:confirmar', p),
      getColaRevision: ()                    => invoke('importacionCosto:getColaRevision'),
      resolverFila:    (p: unknown)          => invoke('importacionCosto:resolverFila', p),
      descartarFila:   (detalleId: string)   => invoke('importacionCosto:descartarFila', detalleId),
      actualizarFila:  (p: unknown)          => invoke('importacionCosto:actualizarFila', p),
      cancelar:        (p: unknown)          => invoke('importacionCosto:cancelar', p),
      eliminar:        (p: unknown)          => invoke('importacionCosto:eliminar', p),
      getHistorial:        ()                    => invoke('importacionCosto:getHistorial'),
      getHistorialDetalle: (importacionId: string) => invoke('importacionCosto:getHistorialDetalle', importacionId),
    },
    importacionCatalogo: {
      parseArchivo:        (p: unknown)  => invoke('importacionCatalogo:parseArchivo', p),
      revalidarFila:       (p: unknown)  => invoke('importacionCatalogo:revalidarFila', p),
      confirmar:           (p: unknown)  => invoke('importacionCatalogo:confirmar', p),
      getHistorial:        ()            => invoke('importacionCatalogo:getHistorial'),
      getHistorialDetalle: (id: string)  => invoke('importacionCatalogo:getHistorialDetalle', id),
      buscarProductos:     (p: unknown)  => invoke('importacionCatalogo:buscarProductos', p),
    },
    unidad: {
      list:       () => invoke('unidad:list'),
      listAll:    () => invoke('unidad:list-all'),
      create:     (p: unknown) => invoke('unidad:create', p),
      update:     (p: unknown) => invoke('unidad:update', p),
      desactivar: (p: unknown) => invoke('unidad:desactivar', p),
      reactivar:  (p: unknown) => invoke('unidad:reactivar', p),
    },
    presentacion: {
      listByProducto: (p: unknown) => invoke('presentacion:listByProducto', p),
      create:         (p: unknown) => invoke('presentacion:create', p),
      update:         (p: unknown) => invoke('presentacion:update', p),
      setDefault:     (p: unknown) => invoke('presentacion:setDefault', p),
      desactivar:     (p: unknown) => invoke('presentacion:desactivar', p),
      eliminar:       (p: unknown) => invoke('presentacion:eliminar', p),
      reactivar:      (p: unknown) => invoke('presentacion:reactivar', p),
      buscarPorGtin:  (p: unknown) => invoke('presentacion:buscarPorGtin', p),
    },
    remito: {
      crear:     (p: unknown) => invoke('remito:crear', p),
      editar:    (p: unknown) => invoke('remito:editar', p),
      listar:    (p: unknown) => invoke('remito:listar', p),
      obtener:   (p: unknown) => invoke('remito:obtener', p),
      pendiente: (p: unknown) => invoke('remito:pendiente', p),
      conformar: (p: unknown) => invoke('remito:conformar', p),
      anular:    (p: unknown) => invoke('remito:anular', p),
      imprimir:  (p: unknown) => invoke('remito:imprimir', p),
    },
    transportista: {
      list:       (p?: unknown) => invoke('transportista:list', p),
      get:        (id: string)  => invoke('transportista:get', id),
      upsert:     (p: unknown)  => invoke('transportista:upsert', p),
      deactivate: (id: string)  => invoke('transportista:deactivate', id),
    },
    presupuesto: {
      crear:              (p: unknown) => invoke('presupuesto:crear', p),
      editar:             (p: unknown) => invoke('presupuesto:editar', p),
      listar:             (p: unknown) => invoke('presupuesto:listar', p),
      obtener:            (p: unknown) => invoke('presupuesto:obtener', p),
      anular:             (p: unknown) => invoke('presupuesto:anular', p),
      emitir:             (p: unknown) => invoke('presupuesto:emitir', p),
      prepararConversion: (p: unknown) => invoke('presupuesto:prepararConversion', p),
      config:             ()          => invoke('presupuesto:config'),
      imprimir:           (p: unknown) => invoke('presupuesto:imprimir', p),
    },
    rutina: {
      list:     (p?: unknown) => invoke('rutina:list', p),
      crear:    (p: unknown)  => invoke('rutina:crear', p),
      editar:   (p: unknown)  => invoke('rutina:editar', p),
      pausar:   (p: unknown)  => invoke('rutina:pausar', p),
      reanudar: (p: unknown)  => invoke('rutina:reanudar', p),
      eliminar: (p: unknown)  => invoke('rutina:eliminar', p),
    },
    agenda: {
      crearEvento: (p: unknown)  => invoke('agenda:crearEvento', p),
      listar:      (p?: unknown) => invoke('agenda:listar', p),
      completar:   (p: unknown)  => invoke('agenda:completar', p),
      posponer:    (p: unknown)  => invoke('agenda:posponer', p),
      descartar:   (p: unknown)  => invoke('agenda:descartar', p),
    },
    aviso: {
      listar:     (p?: unknown) => invoke('aviso:listar', p),
      reintentar: (p: unknown)  => invoke('aviso:reintentar', p),
      descartar:  (p: unknown)  => invoke('aviso:descartar', p),
      badge:      ()            => invoke('aviso:badge'),
    },
    menu: {
      // Suscribe un callback a las acciones del menú nativo. Devuelve una función para
      // desuscribir. Electron proxya la función devuelta a través del contextBridge.
      // Usa `ipcRenderer` directo (capturado del import), no `invoke`.
      onAccion: (cb: (payload: { action: string }) => void) => {
        const handler = (_e: unknown, payload: { action: string }) => cb(payload);
        ipcRenderer.on('menu:accion', handler);
        return () => ipcRenderer.removeListener('menu:accion', handler);
      },
      // Pide al main reconstruir el menú según la sesión actual.
      rebuild: () => invoke('menu:rebuild'),
    },
  }),
}, { contextBridge, ipcRenderer });
