import { describe, it, expect } from 'vitest';
import { problemasDeConvivencia } from './migraciones-aditivas';

// F3 PR6 (ADR-042, ADR-150 §8): con el hub una versión adelante, una caja vieja tiene que poder seguir
// subiendo filas. Solo se admiten migraciones aditivas.
describe('problemasDeConvivencia', () => {
  it('una migración aditiva no tiene problemas', () => {
    const sql = [
      'CREATE TABLE `nueva` (`id` text PRIMARY KEY NOT NULL, `x` integer NOT NULL);',
      '--> statement-breakpoint',
      'ALTER TABLE `producto` ADD `deleted_at` integer;',
      '--> statement-breakpoint',
      "ALTER TABLE `producto` ADD COLUMN `activo2` integer DEFAULT 1 NOT NULL;",
      'UPDATE `producto` SET `x` = 1; -- DROP COLUMN en un comentario no cuenta',
      'CREATE INDEX `ix` ON `producto` (`sku`);',
    ].join('\n');
    expect(problemasDeConvivencia(sql)).toEqual([]);
  });

  it('marca lo que rompe a una caja de la versión anterior', () => {
    const sql = [
      'ALTER TABLE `producto` ADD `obligatoria` text NOT NULL;',
      'ALTER TABLE `producto` DROP COLUMN `vieja`;',
      'ALTER TABLE "cliente" RENAME COLUMN "razon_social" TO "nombre";',
      'ALTER TABLE `__new_caja` RENAME TO `caja`;',
    ].join('\n');
    expect(problemasDeConvivencia(sql)).toEqual([
      'columna_obligatoria_sin_default:producto.obligatoria',
      'columna_borrada:producto.vieja',
      'columna_renombrada:cliente.razon_social',
      'tabla_renombrada:__new_caja',
    ]);
  });
});
