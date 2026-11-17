// Claves de configuración del negocio propias de Retail (ADR-155 §1, F1 PR7). Viven en
// `configuracion_negocio` y se leen con `leerParametro` de `@core/main`. Las que lee el núcleo están en
// `CLAVES_NEGOCIO_CORE`. Una clave nueva del negocio se agrega acá y se siembra por migración en esa
// tabla; la baranda (`db/__tests__/configuracion-negocio.test.ts`) exige las dos cosas.
export const CLAVES_NEGOCIO_RETAIL = [
  'agenda_catchup_limite',
  'agenda_habilitado',
  'agenda_ventana_proximos_dias',
  'arqueo_diferencia_alerta_centavos',
  'busqueda_similares_habilitado',
  'cc_dias_vencimiento',
  'cliente_dias_inactividad',
  'dashboard_dias_sin_movimiento',
  'hub_precios_habilitado',
  'inicio_personalizable_habilitado',
  'motor_precios_v2_habilitado',
  'notif_bajo_minimo_email',
  'notif_cierre_caja_email',
  'notif_cierre_destinatario',
  'notif_recepcion_email',
  'precios.excluir_manuales_dias_default',
  'precios.margen_minimo_pct',
  'precios.recalculo.dias_exclusion_manual',
  'precios.variacion_maxima_pct',
  'presupuesto_validez_dias_default',
  'presupuestos_habilitado',
  'remito_valorizado',
  'remitos_habilitado',
  'sinonimos_habilitado',
  'sustitutos_habilitado',
  'vistos_recientes_habilitado',
] as const;
