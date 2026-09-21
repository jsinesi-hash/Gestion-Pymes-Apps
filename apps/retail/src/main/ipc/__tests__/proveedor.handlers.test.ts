import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { setSession } from '../../auth/session';
import { requirePermission } from '../../auth/guard';
import {
  proveedorListHandler,
  proveedorGetHandler,
  proveedorUpsertHandler,
  proveedorDeactivateHandler,
} from '../proveedor';
import { provincia as provinciaTable, localidad as localidadTable } from '../../db/schema/geo';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { productoProveedorUpsertHandler, productoProveedorSetPreferidoHandler } from '../producto-proveedor';
import { listaPrecioCreateHandler } from '../lista-precio';
import { reglaPrecioUpsertHandler } from '../regla-precio';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';

type Db = ReturnType<typeof setupDb>;

const SESS_SIN_PERM = { userId: 'u-op', rolId: 'rol-op', permisos: new Set<string>(['venta.crear']) };
const DATA_SIN_PERM = {
  id: 'u-op', nombreCompleto: 'Operador', rolId: 'rol-op', rolNombre: '', permisos: ['venta.crear'],
  preferencias: { tema: 'claro' as const, acento: 'amber' as const, ui_font: 'Hanken Grotesk' as const, densidad: 'comfortable' as const, skin: 'actual' as const, pantalla_inicio: null, favoritos: [] },
};

describe('proveedor handlers', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  // ── proveedorListHandler ───────────────────────────────────────────────────

  describe('proveedorListHandler', () => {
    it('devuelve lista vacía sin proveedores', () => {
      loginAsAdmin(db);
      expect(proveedorListHandler(db)).toHaveLength(0);
    });

    it('devuelve proveedor creado con id incluido', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20111111112',
        razon_social: 'Proveedor SA', condicion_fiscal: 'Responsable Inscripto',
      });
      const list = proveedorListHandler(db);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(id);
      expect(list[0].razon_social).toBe('Proveedor SA');
    });

    it('excluye proveedores inactivos', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20222222223',
        razon_social: 'Proveedor B', condicion_fiscal: 'Responsable Inscripto',
      });
      proveedorDeactivateHandler(db, id);
      expect(proveedorListHandler(db)).toHaveLength(0);
    });

    // ── ADR-049 §1: defaults comerciales del proveedor ─────────────────────────

    it('crea proveedor sin defaults comerciales => todos en 0', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20333333334',
        razon_social: 'Proveedor C', condicion_fiscal: 'Responsable Inscripto',
      });
      const prov = proveedorGetHandler(db, id)!;
      expect(prov.bonificacion_pct_default).toBe(0);
      expect(prov.costo_financiero_pct_default).toBe(0);
      expect(prov.flete_pct_default).toBe(0);
    });

    it('persiste los defaults comerciales al crear', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20444444445',
        razon_social: 'Bosch', condicion_fiscal: 'Responsable Inscripto',
        bonificacion_pct_default: 12, costo_financiero_pct_default: 2, flete_pct_default: 1.5,
      });
      const prov = proveedorGetHandler(db, id)!;
      expect(prov.bonificacion_pct_default).toBe(12);
      expect(prov.costo_financiero_pct_default).toBe(2);
      expect(prov.flete_pct_default).toBe(1.5);
    });

    it('actualiza los defaults comerciales al editar', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20555555556',
        razon_social: 'Bosch', condicion_fiscal: 'Responsable Inscripto',
        bonificacion_pct_default: 12,
      });
      proveedorUpsertHandler(db, {
        id,
        tipo_documento: 'CUIT', numero_documento: '20555555556',
        razon_social: 'Bosch', condicion_fiscal: 'Responsable Inscripto',
        bonificacion_pct_default: 15, flete_pct_default: 3,
      });
      const prov = proveedorGetHandler(db, id)!;
      expect(prov.bonificacion_pct_default).toBe(15);
      expect(prov.flete_pct_default).toBe(3);
    });

    it('lanza UNAUTHENTICATED sin sesión', () => {
      expect(() => proveedorListHandler(db)).toThrow('UNAUTHENTICATED');
    });
  });

  // ── proveedorGetHandler ────────────────────────────────────────────────────

  describe('proveedorGetHandler', () => {
    it('devuelve proveedor por id con todos los campos', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20333333334',
        razon_social: 'Ferretería Norte', condicion_fiscal: 'Responsable Inscripto',
        telefono: '11-1234-5678', email: 'norte@ejemplo.com',
        nombre_fantasia: 'FNorte', domicilio: 'Av. Principal 1', localidad: 'CABA',
      });
      const prov = proveedorGetHandler(db, id);
      expect(prov).not.toBeNull();
      expect(prov!.razon_social).toBe('Ferretería Norte');
      expect(prov!.telefono).toBe('11-1234-5678');
      expect(prov!.email).toBe('norte@ejemplo.com');
      expect(prov!.nombre_fantasia).toBe('FNorte');
      expect(prov!.localidad).toBe('CABA');
    });

    it('devuelve null para id inexistente', () => {
      loginAsAdmin(db);
      expect(proveedorGetHandler(db, 'id-que-no-existe')).toBeNull();
    });

    it('devuelve proveedor inactivo (get no filtra por activo)', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20444444445',
        razon_social: 'Inactivo', condicion_fiscal: 'Responsable Inscripto',
      });
      proveedorDeactivateHandler(db, id);
      const prov = proveedorGetHandler(db, id);
      expect(prov!.activo).toBe(false);
    });

    it('lanza UNAUTHENTICATED sin sesión', () => {
      expect(() => proveedorGetHandler(db, 'cualquiera')).toThrow('UNAUTHENTICATED');
    });
  });

  // ── proveedorUpsertHandler ─────────────────────────────────────────────────

  describe('proveedorUpsertHandler', () => {
    it('crea proveedor y retorna id', () => {
      loginAsAdmin(db);
      const result = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20555555556',
        razon_social: 'Distribuidora Sur', condicion_fiscal: 'Monotributo',
        nombre_fantasia: 'DiSur', observaciones: 'Cliente habitual',
      });
      expect(result.id).toBeTruthy();
      const prov = proveedorGetHandler(db, result.id);
      expect(prov!.nombre_fantasia).toBe('DiSur');
      expect(prov!.condicion_fiscal).toBe('Monotributo');
      expect(prov!.activo).toBe(true);
    });

    it('actualiza proveedor existente', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20666666667',
        razon_social: 'Empresa Vieja', condicion_fiscal: 'Responsable Inscripto',
      });
      proveedorUpsertHandler(db, {
        id, tipo_documento: 'CUIT', numero_documento: '20666666667',
        razon_social: 'Empresa Nueva', condicion_fiscal: 'Responsable Inscripto',
        email: 'nuevo@empresa.com',
      });
      const updated = proveedorGetHandler(db, id);
      expect(updated!.razon_social).toBe('Empresa Nueva');
      expect(updated!.email).toBe('nuevo@empresa.com');
    });

    it('persiste localidad_id al crear y actualizar', () => {
      loginAsAdmin(db);
      // Seed geo data required by FK constraint
      db.insert(provinciaTable).values({ id: 'prov-sf', nombre: 'Santa Fe', nombreNorm: 'santa fe' }).run();
      db.insert(provinciaTable).values({ id: 'prov-co', nombre: 'Córdoba', nombreNorm: 'cordoba' }).run();
      db.insert(localidadTable).values({ id: 'loc-123', nombre: 'Rosario', nombreNorm: 'rosario', provinciaId: 'prov-sf', codigoPostal: '2000' }).run();
      db.insert(localidadTable).values({ id: 'loc-456', nombre: 'Córdoba', nombreNorm: 'cordoba', provinciaId: 'prov-co', codigoPostal: '5000' }).run();

      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20888888889',
        razon_social: 'Geo Proveedor', condicion_fiscal: 'Responsable Inscripto',
        localidad_id: 'loc-123',
        localidad: 'Rosario', provincia: 'Santa Fe', codigo_postal: '2000',
      });
      const prov = proveedorGetHandler(db, id);
      expect(prov!.localidad_id).toBe('loc-123');
      expect(prov!.localidad).toBe('Rosario');

      proveedorUpsertHandler(db, {
        id, tipo_documento: 'CUIT', numero_documento: '20888888889',
        razon_social: 'Geo Proveedor', condicion_fiscal: 'Responsable Inscripto',
        localidad_id: 'loc-456',
        localidad: 'Córdoba', provincia: 'Córdoba', codigo_postal: '5000',
      });
      const updated = proveedorGetHandler(db, id);
      expect(updated!.localidad_id).toBe('loc-456');
      expect(updated!.localidad).toBe('Córdoba');
    });

    it('lanza UNAUTHENTICATED sin sesión', () => {
      expect(() => proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20000000001',
        razon_social: 'X', condicion_fiscal: 'Responsable Inscripto',
      })).toThrow('UNAUTHENTICATED');
    });

    it('auto-genera codigo PROV-0001 al crear sin código explícito', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20100000001',
        razon_social: 'Proveedor Alfa', condicion_fiscal: 'Responsable Inscripto',
      });
      const prov = proveedorGetHandler(db, id);
      expect(prov!.codigo).toBe('PROV-0001');
    });

    it('auto-genera codigo correlativo (segundo proveedor → PROV-0002)', () => {
      loginAsAdmin(db);
      proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20100000001',
        razon_social: 'Proveedor Alfa', condicion_fiscal: 'Responsable Inscripto',
      });
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20200000002',
        razon_social: 'Proveedor Beta', condicion_fiscal: 'Responsable Inscripto',
      });
      expect(proveedorGetHandler(db, id)!.codigo).toBe('PROV-0002');
    });

    it('respeta codigo explícito al crear', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20100000001',
        razon_social: 'Proveedor Alfa', condicion_fiscal: 'Responsable Inscripto',
        codigo: 'DIST-ALFA',
      });
      expect(proveedorGetHandler(db, id)!.codigo).toBe('DIST-ALFA');
    });

    it('no cambia el codigo al editar si no se envía codigo en payload', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20100000001',
        razon_social: 'Proveedor Alfa', condicion_fiscal: 'Responsable Inscripto',
      });
      proveedorUpsertHandler(db, {
        id, tipo_documento: 'CUIT', numero_documento: '20100000001',
        razon_social: 'Proveedor Alfa Renombrado', condicion_fiscal: 'Responsable Inscripto',
      });
      expect(proveedorGetHandler(db, id)!.codigo).toBe('PROV-0001');
    });

    it('actualiza el codigo al editar si se envía codigo en payload', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20100000001',
        razon_social: 'Proveedor Alfa', condicion_fiscal: 'Responsable Inscripto',
      });
      proveedorUpsertHandler(db, {
        id, tipo_documento: 'CUIT', numero_documento: '20100000001',
        razon_social: 'Proveedor Alfa', condicion_fiscal: 'Responsable Inscripto',
        codigo: 'NUEVO-COD',
      });
      expect(proveedorGetHandler(db, id)!.codigo).toBe('NUEVO-COD');
    });
  });

  // ── proveedorDeactivateHandler ─────────────────────────────────────────────

  describe('proveedorDeactivateHandler', () => {
    it('marca proveedor como inactivo (baja lógica)', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT', numero_documento: '20777777778',
        razon_social: 'Para Dar de Baja', condicion_fiscal: 'Responsable Inscripto',
      });
      proveedorDeactivateHandler(db, id);
      expect(proveedorGetHandler(db, id)!.activo).toBe(false);
      expect(proveedorListHandler(db)).toHaveLength(0);
    });

    it('lanza UNAUTHENTICATED sin sesión', () => {
      expect(() => proveedorDeactivateHandler(db, 'x')).toThrow('UNAUTHENTICATED');
    });
  });

  // ── guard: proveedor.gestionar ─────────────────────────────────────────────

  describe('guard proveedor.gestionar', () => {
    it('rechaza usuario sin permiso proveedor.gestionar', async () => {
      setSession(SESS_SIN_PERM, DATA_SIN_PERM);
      const handler = requirePermission('proveedor.gestionar')(async () => proveedorListHandler(db));
      await expect(handler(null as any))
        .rejects.toMatchObject({ code: 'FORBIDDEN', permiso: 'proveedor.gestionar' });
    });
  });

  // ── proveedorUpsertHandler — campos domicilio extendido ────────────────────

  describe('proveedorUpsertHandler — campos domicilio extendido', () => {
    it('guarda y recupera calle, numero, aclaracion, telefono_adicional', () => {
      loginAsAdmin(db);
      const { id } = proveedorUpsertHandler(db, {
        tipo_documento: 'CUIT',
        numero_documento: '20111111112',
        razon_social: 'Distribuidora SA',
        condicion_fiscal: 'Responsable Inscripto',
        calle: 'Tucumán',
        numero: '500',
        aclaracion: 'Galpón 2',
        telefono_adicional: '0351-4444-5555',
      });
      const p = proveedorGetHandler(db, id);
      expect(p!.calle).toBe('Tucumán');
      expect(p!.numero).toBe('500');
      expect(p!.aclaracion).toBe('Galpón 2');
      expect(p!.telefono_adicional).toBe('0351-4444-5555');
    });
  });
});

// ── ADR-049 §7: editar defaults comerciales dispara batch de costo ───────────

describe('proveedorUpsertHandler — cierre del circuito de costo', () => {
  let db: Db;

  beforeEach(() => {
    db = setupDb();
    runCatalogSeed(db);
    clearSession();
    loginAsAdmin(db);
  });

  it('editar un default comercial dispara un batch para todos los productos donde es preferido', () => {
    const { id: proveedorId } = proveedorUpsertHandler(db, {
      tipo_documento: 'CUIT', numero_documento: '20111111112',
      razon_social: 'Bosch', condicion_fiscal: 'Responsable Inscripto',
    });
    const cat = categoriaCreateHandler(db, { nombre: 'Test' });
    const imp = db.select().from(schema.impuesto).get()!;
    const prod = productoCreateHandler(db, {
      nombre_corto: 'Amoladora', categoria_id: cat.id, impuesto_id: imp.id,
      unidad_venta: 'u', precio_venta_lista: 100,
    });
    const pp = productoProveedorUpsertHandler(db, {
      producto_id: prod.id, proveedor_id: proveedorId, costo_centavos: 5000,
    });
    productoProveedorSetPreferidoHandler(db, pp.id);

    const lista = listaPrecioCreateHandler(db, { nombre: 'MC', ajuste_porcentual: 0, modo_calculo: 'margen_costo' });
    reglaPrecioUpsertHandler(db, { lista_precio_id: lista.id, tipo: 'lista', objetivo_id: null, margen_pct: 40 });

    proveedorUpsertHandler(db, {
      id: proveedorId,
      tipo_documento: 'CUIT', numero_documento: '20111111112',
      razon_social: 'Bosch', condicion_fiscal: 'Responsable Inscripto',
      bonificacion_pct_default: 12,
    });

    const batches = db.select().from(schema.price_batch)
      .where(eq(schema.price_batch.lista_precio_id, lista.id)).all();
    expect(batches).toHaveLength(1);
    expect(batches[0].origen).toBe('PROVIDER_COST_UPDATE');
    expect(batches[0].proveedor_id).toBe(proveedorId);
  });

  it('editar el proveedor sin tocar los defaults no dispara ningún batch', () => {
    const { id: proveedorId } = proveedorUpsertHandler(db, {
      tipo_documento: 'CUIT', numero_documento: '20111111112',
      razon_social: 'Bosch', condicion_fiscal: 'Responsable Inscripto',
    });
    const lista = listaPrecioCreateHandler(db, { nombre: 'MC', ajuste_porcentual: 0, modo_calculo: 'margen_costo' });
    reglaPrecioUpsertHandler(db, { lista_precio_id: lista.id, tipo: 'lista', objetivo_id: null, margen_pct: 40 });

    proveedorUpsertHandler(db, {
      id: proveedorId,
      tipo_documento: 'CUIT', numero_documento: '20111111112',
      razon_social: 'Bosch SA', condicion_fiscal: 'Responsable Inscripto',
    });

    expect(db.select().from(schema.price_batch).all()).toHaveLength(0);
  });
});
