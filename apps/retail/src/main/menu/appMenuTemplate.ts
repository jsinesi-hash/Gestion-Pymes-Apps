import type { MenuItemConstructorOptions } from 'electron';

// Acciones que el main envía al renderer (canal 'menu:accion').
export type MenuAccion =
  | 'nueva-venta' | 'importar-datos' | 'backup' | 'cerrar-sesion'
  | 'abrir-caja' | 'cerrar-caja' | 'movimiento-caja'
  | 'buscar-producto' | 'entrada-stock' | 'recepcion-compra'
  | 'cobro-ctacte' | 'ventas-espera';

// Acciones de Ayuda resueltas en el main (diálogos nativos / abrir manual).
export type AyudaAccion = 'atajos' | 'acerca' | 'guia';

export interface MenuTemplateOpts {
  permisos: Set<string>;
  autenticado: boolean;
  isDev: boolean;
  onAccion: (a: MenuAccion) => void;
  onAyuda: (a: AyudaAccion) => void;
}

// Ítem con metadatos de visibilidad que se filtran antes de entregar el template.
type Item = MenuItemConstructorOptions & { permiso?: string; soloAutenticado?: boolean };

function collapseSeparators(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  const out: MenuItemConstructorOptions[] = [];
  for (const it of items) {
    if (it.type === 'separator') {
      if (out.length === 0) continue;
      if (out[out.length - 1].type === 'separator') continue;
    }
    out.push(it);
  }
  while (out.length && out[out.length - 1].type === 'separator') out.pop();
  return out;
}

export function buildMenuTemplate(opts: MenuTemplateOpts): MenuItemConstructorOptions[] {
  const { permisos, autenticado, isDev, onAccion, onAyuda } = opts;
  const puede = (permiso?: string) => !permiso || permisos.has(permiso);

  // Helper: ítem que dispara una MenuAccion.
  const A = (
    label: string,
    id: MenuAccion,
    extra: Partial<Item> = {},
  ): Item => ({ label, click: () => onAccion(id), ...extra });

  const archivoItems: Item[] = [
    A('Nueva venta', 'nueva-venta', { accelerator: 'CmdOrCtrl+N', permiso: 'venta.crear' }),
    { type: 'separator' },
    A('Importar datos…', 'importar-datos', { permiso: 'import.masiva' }),
    A('Copia de seguridad…', 'backup', { permiso: 'backup.crear' }),
    { type: 'separator' },
    A('Cerrar sesión', 'cerrar-sesion', { soloAutenticado: true }),
    { role: 'quit', label: 'Salir', accelerator: 'CmdOrCtrl+Q' },
  ];

  const operacionItems: Item[] = [
    A('Abrir caja', 'abrir-caja', { permiso: 'caja.operar' }),
    A('Cerrar caja', 'cerrar-caja', { accelerator: 'CmdOrCtrl+F4', permiso: 'caja.operar' }),
    A('Movimiento de caja', 'movimiento-caja', { permiso: 'caja.operar' }),
    { type: 'separator' },
    A('Buscar producto', 'buscar-producto', { accelerator: 'CmdOrCtrl+F', permiso: 'producto.consultar' }),
    A('Entrada de stock', 'entrada-stock', { permiso: 'stock.entrada' }),
    A('Recepción de compra', 'recepcion-compra', { permiso: 'compra.recibir' }),
    A('Cobro de cuenta corriente', 'cobro-ctacte', { permiso: 'ctacte.cobrar' }),
    { type: 'separator' },
    A('Ventas en espera', 'ventas-espera', { accelerator: 'CmdOrCtrl+E', permiso: 'venta.crear' }),
  ];

  const editarItems: MenuItemConstructorOptions[] = [
    { role: 'undo', label: 'Deshacer' },
    { role: 'redo', label: 'Rehacer' },
    { type: 'separator' },
    { role: 'cut', label: 'Cortar' },
    { role: 'copy', label: 'Copiar' },
    { role: 'paste', label: 'Pegar' },
    { role: 'selectAll', label: 'Seleccionar todo' },
  ];

  const verItems: MenuItemConstructorOptions[] = [
    { role: 'togglefullscreen', label: 'Pantalla completa' },
    { type: 'separator' },
    { role: 'resetZoom', label: 'Restablecer zoom' },
    { role: 'zoomIn', label: 'Acercar' },
    { role: 'zoomOut', label: 'Alejar' },
    ...(isDev
      ? ([
          { type: 'separator' },
          { role: 'reload', label: 'Recargar' },
          { role: 'forceReload', label: 'Forzar recarga' },
          { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
        ] as MenuItemConstructorOptions[])
      : []),
  ];

  const ayudaItems: MenuItemConstructorOptions[] = [
    { label: 'Manual de usuario', click: () => onAyuda('guia') },
    { type: 'separator' },
    { label: 'Atajos de teclado', accelerator: 'F1', click: () => onAyuda('atajos') },
    { type: 'separator' },
    { label: 'Acerca de Ferretería', click: () => onAyuda('acerca') },
  ];

  // Filtra por permiso/autenticación y limpia los metadatos antes de devolver.
  const visible = (items: Item[]): MenuItemConstructorOptions[] =>
    collapseSeparators(
      items
        .filter(it =>
          it.type === 'separator'
            ? true
            : puede(it.permiso)
              && (!it.soloAutenticado || autenticado)
              && (it.permiso === undefined || autenticado),
        )
        .map(({ permiso: _p, soloAutenticado: _s, ...rest }) => rest),
    );

  const template: MenuItemConstructorOptions[] = [
    { label: 'Archivo', submenu: visible(archivoItems) },
    { label: 'Editar', submenu: editarItems },
    { label: 'Ver', submenu: verItems },
  ];

  const operacion = visible(operacionItems);
  if (operacion.length > 0) template.push({ label: 'Operación', submenu: operacion });

  template.push({ label: 'Ayuda', role: 'help', submenu: ayudaItems });
  return template;
}
