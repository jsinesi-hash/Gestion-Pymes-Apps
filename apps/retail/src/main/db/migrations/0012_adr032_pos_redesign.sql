-- ADR-032: pagos múltiples por venta
ALTER TABLE venta ADD COLUMN vuelto_centavos INTEGER;
--> statement-breakpoint
CREATE TABLE venta_pago (
  id TEXT NOT NULL PRIMARY KEY,
  venta_id TEXT NOT NULL REFERENCES venta(id),
  medio_pago TEXT NOT NULL,
  monto_centavos INTEGER NOT NULL,
  recargo_pct REAL NOT NULL DEFAULT 0,
  recargo_centavos INTEGER NOT NULL DEFAULT 0,
  numero_cheque TEXT,
  banco TEXT,
  fecha_cheque INTEGER,
  titular_cheque TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  origin_id TEXT NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'pending',
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_venta_pago_venta_id ON venta_pago(venta_id);
