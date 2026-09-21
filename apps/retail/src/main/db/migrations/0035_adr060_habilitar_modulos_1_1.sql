-- ADR-060 — Habilitar por default los módulos de 1.1.x en instalaciones nuevas.
-- Decisión de release: Remitos, Presupuestos, Agenda y el Motor de Precios v2 pasan a
-- venir ENCENDIDOS de fábrica (antes default false por ADR-042/044), para que una
-- instalación nueva muestre el menú completo tal como se ve en desarrollo. La visibilidad
-- fina se gobernará por rol/perfil más adelante.
-- Aditiva y retrocompatible: sólo cambia datos de `parametros_sistema` (no toca esquema).
-- Las filas ya fueron sembradas en 'false' por 0023/0025/0026/0028; acá se flipan a 'true'.
UPDATE parametros_sistema SET valor = 'true'
WHERE clave IN (
  'remitos_habilitado',
  'presupuestos_habilitado',
  'agenda_habilitado',
  'motor_precios_v2_habilitado'
);
