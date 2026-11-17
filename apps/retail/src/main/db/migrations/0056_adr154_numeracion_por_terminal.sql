-- ADR-154 (F1 PR5) — Remito y presupuesto numeran por terminal (RE-<terminal>-NNNNNN, PR-<terminal>-NNNNNN).
-- El correlativo de cada terminal se crea con el primer documento; los contadores globales se retiran.
-- Los números ya emitidos no se tocan.
DELETE FROM `parametros_sistema` WHERE `clave` IN ('remito_proximo_secuencial', 'presupuesto_proximo_secuencial');
