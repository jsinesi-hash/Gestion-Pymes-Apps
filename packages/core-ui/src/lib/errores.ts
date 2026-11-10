// ERR-2 (ADR-077): traductor de errores conocidos → mensaje humano y accionable.
// Los errores llegan desde el main a través del bridge IPC y suelen traer el texto crudo
// de SQLite (p. ej. "UNIQUE constraint failed: producto.gtin_barcode"), a veces envuelto
// por Electron ("Error invoking remote method '…': Error: …"). Este módulo es puro y
// testeable con vitest/jsdom, sin Electron.
import { mensajePasswordDebil, type MotivoPasswordDebil } from '@ferreteria/shared';

/** Acción opcional que un error puede ofrecer (p. ej. abrir el registro en conflicto). */
export type AccionError = { etiqueta: string; tipo: string; payload?: unknown };

export type ErrorTraducido = { mensaje: string; accion?: AccionError; campo?: string };

function textoDe(e: unknown): string {
  if (e == null) return '';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return String(e);
}

// Formatea centavos (INTEGER) a pesos "$1.500,00". Los montos de dominio viajan en centavos.
function pesos(centavosStr: string): string {
  const n = Number(centavosStr);
  if (!Number.isFinite(n)) return centavosStr;
  return (n / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

// El main envuelve el string real; extrae el último "Código:args" del texto (posible envoltura
// del bridge "Error invoking remote method '…': Error: CÓDIGO:arg").
function ultimoSegmentoError(texto: string): string {
  const m = texto.match(/.*Error:\s*([^]*)$/);
  return (m ? m[1] : texto).trim();
}

type Formateador = (args: string[]) => ErrorTraducido;
const msg = (m: string): Formateador => () => ({ mensaje: m });

// Vocabulario cerrado de detalles de ValidationError → mensaje humano.
function detalleValidacion(detalle: string, args: string[]): string {
  switch (detalle) {
    case 'REQUERIDO': case 'VACIO': return 'Este campo es obligatorio.';
    case 'TIPO': return 'El valor tiene un formato inválido.';
    case 'MIN': return `Ingresá un valor mayor o igual a ${args[0]}.`;
    case 'MAX': return `El valor no puede superar ${args[0]}.`;
    case 'RANGO': return `Ingresá un valor entre ${args[0]} y ${args[1]}.`;
    case 'ENUM': return 'El valor elegido no es válido.';
    case 'NO_ENTERO': return 'Ingresá un número entero.';
    case 'NEGATIVO': return 'El valor no puede ser negativo.';
    default: return 'El valor ingresado no es válido.';
  }
}

// Catálogo de códigos de dominio (inventario §4 del spec). Clave = primer segmento antes de ':'.
const CODIGOS: Record<string, Formateador> = {
  // Transversales
  UNAUTHENTICATED: msg('Tu sesión expiró. Volvé a iniciar sesión.'),
  FORBIDDEN: msg('No tenés permiso para hacer esta acción.'),
  NOT_FOUND: msg('No se encontró el registro. Puede que haya sido eliminado.'),
  NO_CHANGE: msg('No hay cambios para guardar.'),
  FACTOR_INVALIDO: msg('La presentación de un producto no coincide con la cargada. Volvé a agregarlo al carrito.'),
  PRESENTACION_INVALIDA: msg('La presentación de un producto ya no está disponible. Volvé a agregarlo al carrito.'),
  RESTORE_SWAP_FALLIDO: msg('No se pudo aplicar la restauración. Tus datos originales no se modificaron; la aplicación se reiniciará en unos segundos.'),
  RESTORE_ROLLBACK_FALLIDO: msg('La restauración falló y no se pudo volver atrás automáticamente. NO reinicies la aplicación: avisá a soporte. La base original quedó guardada junto a la carpeta de datos con la extensión .pre-restore.bak.'),
  RESTORE_RUTA_BD: msg('No se pudo determinar el archivo de la base de datos. Avisá a soporte.'),
  TOTALES_INCONSISTENTES: msg('Los importes de la venta no coinciden con sus líneas. Revisá el carrito y volvé a intentar.'),
  PRECIO_INVALIDO: msg('Hay una línea con un precio inválido. Revisá el carrito.'),
  CUENTA_BLOQUEADA: (args) => {
    const segundos = Number(args[0]);
    const minutos = Number.isFinite(segundos) && segundos > 0 ? Math.ceil(segundos / 60) : 15;
    return { mensaje: `Demasiados intentos fallidos. Esperá ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} para volver a intentar.` };
  },
  PASSWORD_DEBIL: (args) => {
    const motivo = args[0] as MotivoPasswordDebil;
    return { mensaje: mensajePasswordDebil(motivo) ?? 'La contraseña no cumple los requisitos de seguridad.' };
  },
  LAST_SUPERVISOR: msg('Tiene que quedar al menos un usuario activo que pueda administrar usuarios.'),
  // ADR-147: editor de permisos por rol.
  SIN_ADMINISTRADOR: msg('Tiene que quedar al menos un usuario activo que pueda administrar usuarios.'),
  PERMISO_PROPIO_ADMIN: msg('No podés quitarle «Administrar usuarios» a tu propio rol.'),
  PERMISO_DESCONOCIDO: msg('Uno de los permisos no existe. Recargá la pantalla e intentá de nuevo.'),
  AUTO_DESACTIVACION: msg('No podés desactivar tu propio usuario.'),
  CANTIDAD_INVALIDA: msg('Ingresá una cantidad válida.'),
  MOTIVO_REQUERIDO: msg('Ingresá el motivo.'),
  OBSERVACIONES_REQUERIDAS: msg('Ingresá una observación.'),
  // Venta / caja / POS
  CORRELATIVO_NOT_FOUND: msg('No se pudo asignar el número de comprobante. Avisá a soporte.'),
  CAJA_REQUERIDA: msg('Necesitás una caja abierta para operar.'),
  CAJA_NO_ABIERTA: msg('No hay una caja abierta.'),
  CAJA_ORIGEN_CERRADA: msg('La caja de la venta original está cerrada.'),
  CAJA_NOT_FOUND: msg('No se encontró la caja.'),
  CAJA_CERRADA: msg('La caja ya está cerrada.'),
  DIFERENCIA_REQUIERE_AUTORIZACION: msg('La diferencia supera el umbral. Se requiere autorización del Supervisor.'),
  PAGOS_REQUERIDOS: msg('Agregá al menos un medio de pago.'),
  MEDIO_PAGO_DUPLICADO: msg('Hay un medio de pago repetido.'),
  SALDO_PENDIENTE: msg('El pago no cubre el total de la venta.'),
  PRODUCTO_INACTIVO: msg('El producto está inactivo y no se puede vender.'),
  STOCK_INSUFICIENTE: a => ({
    mensaje: a[0] ? `No hay stock suficiente de ${a[0]} para completar la operación.` : 'No hay stock suficiente para completar la operación.',
  }),
  DEMO_EN_USO: a => {
    const frase: Record<string, string> = {
      ventas: 'ventas', compras: 'compras', movimientos: 'movimientos de stock', producciones: 'producciones', recetas: 'recetas propias',
    };
    const motivos = (a[0] ?? '').split(',').map((k) => frase[k] ?? k).filter(Boolean);
    return {
      mensaje: motivos.length
        ? `No se pueden vaciar los datos demo: ya tienen ${motivos.join(', ')}. Anulalos o dejá de usarlos primero.`
        : 'No se pueden vaciar los datos demo porque ya se usaron.',
    };
  },
  PRECIO_DESACTUALIZADO: msg('El precio cambió. Requiere autorización del supervisor.'),
  CCC_NO_DISPONIBLE: msg('El cliente no tiene cuenta corriente habilitada.'),
  LIMITE_CREDITO_EXCEDIDO: msg('La venta supera el límite de crédito. Requiere autorización del supervisor.'),
  VENTA_ESPERA_NOT_FOUND: msg('No se encontró la venta en espera.'),
  VENTA_NO_EN_ESPERA: msg('La venta ya no está en espera.'),
  VENTA_YA_ANULADA: msg('La venta ya estaba anulada.'),
  VENTA_NO_CONFIRMADA: a => ({ mensaje: a[0] ? `La venta no está confirmada (${a[0]}).` : 'La venta no está confirmada.' }),
  MAX_EN_ESPERA: msg('Llegaste al máximo de ventas en espera.'),
  CARRITO_VACIO: msg('Agregá al menos un producto a la venta.'),
  PRODUCTO_VENTA_NO_ENCONTRADO: msg('Un producto del carrito ya no está disponible.'),
  DESCUENTO_INVALIDO: msg('El descuento debe estar entre 0% y 100%.'),
  GRUPO_NO_PERMITIDO: msg('Esa opción no corresponde a este producto.'),
  OPCION_INVALIDA: msg('Una de las opciones elegidas no es válida para este producto.'),
  OPCION_DUPLICADA: msg('No podés repetir la misma opción.'),
  MODIFICADOR_MIN: msg('Elegí al menos la cantidad mínima de opciones (por ejemplo, sabores).'),
  MODIFICADOR_MAX: msg('Elegiste más opciones de las permitidas.'),
  // Producción / recetas (Elaborados)
  RECETA_NO_DEFINIDA: msg('El artículo no tiene receta definida.'),
  RINDE_INVALIDO: msg('El rinde de la receta debe ser mayor que cero.'),
  ARTICULO_NO_ELABORADO: msg('Solo los artículos elaborados pueden tener receta.'),
  CANTIDAD_PRODUCIDA_INVALIDA: msg('La cantidad producida debe ser mayor que cero.'),
  ANULACION_REQUIERE_AUTORIZACION: msg('Anular requiere la autorización de un supervisor.'),
  YA_ANULADA: msg('El registro ya estaba anulado.'),
  // Catálogos auxiliares
  TIENE_PRODUCTOS: a => ({ mensaje: `No se puede: tiene ${a[0] ?? '—'} producto(s) asociado(s).` }),
  YA_EXISTE: a => ({ mensaje: `Ya existe un registro con el código ${a[0] ?? '—'}.` }),
  DESTINO_NOT_FOUND: msg('La ubicación de destino no existe.'),
  NO_HAY_UNIDADES: msg('No hay unidades cargadas. Creá una unidad primero.'),
  IMPUESTO_PREDETERMINADO_NO_ENCONTRADO: msg('No hay un impuesto predeterminado configurado.'),
  RAZON_SOCIAL_REQUERIDA: msg('Ingresá la razón social.'),
  // Cliente / cuenta corriente
  CCC_CON_SALDO: msg('El cliente tiene saldo en cuenta corriente. Saldalo antes de dar de baja.'),
  TIENE_SALDO_CC: a => ({ mensaje: `El cliente tiene un saldo de ${pesos(a[0] ?? '0')} en cuenta corriente.` }),
  CCC_YA_TIENE_MOVIMIENTOS: msg('La cuenta corriente ya tiene movimientos.'),
  // Usuarios / auth
  USUARIO_DUPLICADO: msg('Ya existe un usuario con ese nombre.'),
  PASSWORD_REQUERIDA: msg('Ingresá tu contraseña actual.'),
  PASSWORD_INCORRECTA: msg('La contraseña es incorrecta.'),
  PASSWORD_VENCIDA: msg('Tu contraseña venció. Elegí una nueva para continuar.'),
  PASSWORD_NO_VENCIDA: msg('Tu contraseña todavía está vigente.'),
  PASSWORD_IGUAL_A_LA_ACTUAL: msg('La nueva contraseña tiene que ser distinta de la actual.'),
  EMAIL_REQUERIDO: msg('Ingresá un correo electrónico.'),
  EMAIL_INVALIDO: msg('El correo electrónico no es válido.'),
  EMAIL_YA_CARGADO: msg('Este usuario ya tiene un correo electrónico cargado.'),
  CODIGO_INVALIDO: msg('El código es incorrecto o venció. Pedí uno nuevo.'),
  SUPERVISOR_INVALIDO: msg('Las credenciales del supervisor son inválidas.'),
  // Sinónimos / equivalencias
  CANONICO_REQUERIDO: msg('Ingresá el término canónico.'),
  AUTO_RELACION: msg('Un producto no puede relacionarse consigo mismo.'),
  RELACION_DUPLICADA: msg('La relación ya existe.'),
  // Presentaciones (ADR-066/068/085)
  GTIN_DUPLICADO: msg('Otra presentación activa ya usa ese GTIN; limpiá uno de los dos primero.'),
  NO_DESACTIVAR_DEFAULT: msg('Primero establecé otra presentación como predeterminada.'),
  NO_ELIMINAR_DEFAULT: msg('No se puede eliminar la presentación predeterminada; marcá otra como predeterminada primero.'),
  INACTIVO: msg('No se puede marcar como predeterminada una presentación inactiva.'),
  // Precios (batch/motor)
  BATCH_NO_APROBABLE: msg('El lote no está en un estado aprobable.'),
  BATCH_CON_ERRORES: msg('El lote tiene errores. Revisalos antes de aprobar.'),
  BATCH_NO_APROBADO: msg('El lote todavía no fue aprobado.'),
  BATCH_NO_PUBLICADO: msg('El lote no está publicado.'),
  BATCH_NO_REVALIDABLE: msg('El lote no se puede revalidar en su estado actual.'),
  // Remitos
  SIN_LINEAS: msg('Agregá al menos una línea.'),
  VENTA_NOT_FOUND: msg('No se encontró la venta.'),
  DOMICILIO_REQUERIDO: msg('Ingresá el domicilio de entrega.'),
  TRANSPORTISTA_REQUERIDO: msg('Elegí un transportista.'),
  TRANSPORTISTA_INVALIDO: msg('El transportista elegido no es válido.'),
  RECIBIDO_POR_REQUERIDO: msg('Ingresá quién recibió.'),
  EXCEDE_PENDIENTE: a => ({ mensaje: `La cantidad supera lo pendiente (${a[1] ?? ''}).` }),
  ESTADO_INVALIDO: a => ({ mensaje: a[0] ? `La operación no es válida en el estado "${a[0]}".` : 'Estado inválido para la operación.' }),
  LINEA_NO_PERTENECE_A_VENTA: msg('Una línea no pertenece a la venta.'),
  LINEA_NO_PERTENECE_AL_REMITO: msg('Una línea no pertenece al remito.'),
  FRACCION_NO_PERMITIDA: msg('Este producto no admite fracciones.'),
  REMITO_QUEDARIA_SIN_LINEAS: msg('El remito quedaría sin líneas.'),
  // Export / backup / import
  ENTIDAD_DESCONOCIDA: msg('Tipo de dato desconocido para exportar.'),
  PERFIL_DESCONOCIDO: msg('Perfil de exportación desconocido.'),
  FORMATO_NO_PERMITIDO: msg('Formato de archivo no permitido.'),
  PASSWORD_REQUIRED: msg('Ingresá una contraseña.'),
  INVALID_PATH: msg('La ruta del archivo no es válida.'),
  SAFE_STORAGE_NO_DISPONIBLE: msg('El almacenamiento seguro del sistema no está disponible.'),
  OC_NO_EMITIDA: msg('La orden de compra no está emitida.'),
};

const REGLAS: ReadonlyArray<{ test: (t: string) => boolean; mensaje: string }> = [
  { test: t => /UNIQUE constraint failed[^]*gtin_barcode/i.test(t), mensaje: 'Ya existe un producto con ese código de barras (EAN).' },
  { test: t => /UNIQUE constraint failed/i.test(t), mensaje: 'Ya existe un registro con ese valor único.' },
  { test: t => /NOT NULL constraint failed/i.test(t), mensaje: 'Falta completar un dato obligatorio.' },
  { test: t => /FOREIGN KEY constraint failed/i.test(t), mensaje: 'El dato referenciado no existe o está en uso.' },
];

const FALLBACK = 'No se pudo completar la operación. Reintentá; si el problema persiste, avisá a soporte.';

export function traducirError(e: unknown): ErrorTraducido {
  const texto = textoDe(e);
  const seg = ultimoSegmentoError(texto);
  const partes = seg.split(':');
  const codigo = partes[0]?.trim();

  if (codigo === 'VALIDATION') {
    const campo = partes[1]?.trim() ?? '';
    const detalle = partes[2]?.trim() ?? '';
    return { campo, mensaje: detalleValidacion(detalle, partes.slice(3)) };
  }
  // Object.hasOwn evita que tokens como "toString" o "__proto__" caigan en miembros
  // heredados de Object.prototype (romperían la invariante: devolverían algo malformado o
  // lanzarían). Solo entradas propias del catálogo resuelven acá.
  if (codigo && Object.hasOwn(CODIGOS, codigo)) {
    return CODIGOS[codigo](partes.slice(1).map(s => s.trim()));
  }
  for (const regla of REGLAS) {
    if (regla.test(texto)) return { mensaje: regla.mensaje };
  }
  return { mensaje: FALLBACK };
}
