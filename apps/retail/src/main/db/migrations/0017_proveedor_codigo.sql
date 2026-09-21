ALTER TABLE proveedor ADD COLUMN codigo TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS proveedor_codigo_unique ON proveedor(codigo);
