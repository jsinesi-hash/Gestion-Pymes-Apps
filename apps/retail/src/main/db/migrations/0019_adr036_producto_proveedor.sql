-- ADR-036: soft-delete en producto_proveedor + índice único parcial preferido
ALTER TABLE producto_proveedor ADD COLUMN deleted_at INTEGER;
--> statement-breakpoint
-- Reemplazar índice anterior (sin condición deleted_at) por uno que lo respeta
DROP INDEX IF EXISTS pp_preferido_por_producto;
--> statement-breakpoint
CREATE UNIQUE INDEX ux_producto_proveedor_preferido
  ON producto_proveedor(producto_id)
  WHERE preferido = 1 AND deleted_at IS NULL;
