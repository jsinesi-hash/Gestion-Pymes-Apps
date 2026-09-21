import { randomUUID } from 'node:crypto';
import { ne } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

const NOW = new Date();
const SYNC = { version: 1, origin_id: 'system', sync_state: 'synced' as const, updated_at: NOW };
const AUDIT = { usuario_creacion_id: 'system', fecha_creacion: NOW };

type ClienteDef = {
  nombre: string;
  apellido: string;
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  condicion_fiscal: 'Consumidor Final' | 'Monotributo' | 'Responsable Inscripto' | 'Exento';
  habilita_cuenta_corriente: boolean;
  lista_mayorista?: boolean;
  telefono?: string;
};

// ADR-050 — cliente.razon_social se separó en nombre/apellido (ambos NOT NULL).
// Para las razones sociales de empresa (sin apellido de persona física real),
// se usa '(revisar)' como placeholder visible, igual que la migración de datos.
const CLIENTES: ClienteDef[] = [
  { nombre: 'María',       apellido: 'González',  tipo_documento: 'DNI',  numero_documento: '28456789',    condicion_fiscal: 'Consumidor Final', habilita_cuenta_corriente: false },
  { nombre: 'Pablo',       apellido: 'Romero',    tipo_documento: 'DNI',  numero_documento: '35678123',    condicion_fiscal: 'Consumidor Final', habilita_cuenta_corriente: false },
  { nombre: 'Ana Laura',   apellido: 'Ferreyra',  tipo_documento: 'DNI',  numero_documento: '41234567',    condicion_fiscal: 'Consumidor Final', habilita_cuenta_corriente: false },
  { nombre: 'Construcciones Giménez',    apellido: '(revisar)', tipo_documento: 'CUIT', numero_documento: '20301234561', condicion_fiscal: 'Monotributo',       habilita_cuenta_corriente: false, telefono: '2614501234' },
  { nombre: 'Pinturas y Reformas SRL',   apellido: '(revisar)', tipo_documento: 'CUIT', numero_documento: '30456789012', condicion_fiscal: 'Monotributo',       habilita_cuenta_corriente: false, telefono: '2614509876' },
  { nombre: 'Constructora Del Norte SA', apellido: '(revisar)', tipo_documento: 'CUIT', numero_documento: '30123456789', condicion_fiscal: 'Responsable Inscripto', habilita_cuenta_corriente: true,  telefono: '2614512345' },
  { nombre: 'Ferretería El Martillo',    apellido: '(revisar)', tipo_documento: 'CUIT', numero_documento: '20198765432', condicion_fiscal: 'Responsable Inscripto', habilita_cuenta_corriente: true,  telefono: '2614567890' },
  { nombre: 'Grupo Constructor Andes',   apellido: '(revisar)', tipo_documento: 'CUIT', numero_documento: '30987654321', condicion_fiscal: 'Responsable Inscripto', habilita_cuenta_corriente: true,  lista_mayorista: true, telefono: '2614598765' },
];

type ProveedorDef = {
  razon_social: string;
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  condicion_fiscal: 'Monotributo' | 'Responsable Inscripto';
  persona_contacto: string;
  telefono: string;
};

const PROVEEDORES: ProveedorDef[] = [
  { razon_social: 'Ferretería Don Roberto',    tipo_documento: 'CUIT', numero_documento: '20456789013', condicion_fiscal: 'Monotributo', persona_contacto: 'Roberto Sánchez', telefono: '2614401234' },
  { razon_social: 'Distribuidora Metálica SA', tipo_documento: 'CUIT', numero_documento: '30123789456', condicion_fiscal: 'Responsable Inscripto',          persona_contacto: 'Lucía Peralta',   telefono: '2614412345' },
  { razon_social: 'Pinturas del Sur SA',       tipo_documento: 'CUIT', numero_documento: '30987123654', condicion_fiscal: 'Responsable Inscripto',          persona_contacto: 'Diego Martínez',  telefono: '2614423456' },
];

export function wipePersonas(db: Db): void {
  db.delete(schema.movimiento_cuenta_corriente).run();
  db.delete(schema.cuenta_corriente_cliente).run();
  db.delete(schema.lista_precio_valor).run();
  db.delete(schema.lista_precio_detalle).run();
  // Preserve "Consumidor Final" inserted by migration 0003
  const cfId = 'cf000000-0000-0000-0000-000000000001';
  db.delete(schema.cliente).where(ne(schema.cliente.id, cfId)).run();
  // Compras tables referencing proveedor
  db.delete(schema.recepcion_detalle).run();
  db.delete(schema.recepcion).run();
  db.delete(schema.comprobante_compra).run();
  db.delete(schema.item_oc).run();
  db.delete(schema.orden_compra).run();
  db.delete(schema.importacion_costo_proveedor).run();
  db.delete(schema.producto_proveedor).run();
  db.delete(schema.proveedor).run();
  db.delete(schema.lista_precio).run();
}

export function seedPersonas(db: Db, force: boolean): void {
  const cfId = 'cf000000-0000-0000-0000-000000000001';
  const todos = db.select({ id: schema.cliente.id }).from(schema.cliente).all();
  const extras = todos.filter(c => c.id !== cfId);
  if (extras.length > 0 && !force) {
    console.log('[skip] personas ya tiene datos');
    return;
  }
  if (force) wipePersonas(db);

  // Lista de precios Mayorista
  const listaId = randomUUID();
  db.insert(schema.lista_precio).values({
    id: listaId,
    nombre: 'Mayorista',
    tipo: 'especial',
    ajuste_porcentual: 15,
    predeterminada: false,
    activo: true,
    ...AUDIT, ...SYNC,
  }).run();

  // Clientes
  for (const c of CLIENTES) {
    db.insert(schema.cliente).values({
      id: randomUUID(),
      tipo_documento: c.tipo_documento,
      numero_documento: c.numero_documento,
      nombre: c.nombre,
      apellido: c.apellido,
      condicion_fiscal: c.condicion_fiscal,
      habilita_cuenta_corriente: c.habilita_cuenta_corriente,
      lista_precio_id: c.lista_mayorista ? listaId : null,
      telefono: c.telefono ?? null,
      activo: true,
      ...AUDIT, ...SYNC,
    }).run();
  }

  // Proveedores
  for (const p of PROVEEDORES) {
    db.insert(schema.proveedor).values({
      id: randomUUID(),
      tipo_documento: p.tipo_documento,
      numero_documento: p.numero_documento,
      razon_social: p.razon_social,
      condicion_fiscal: p.condicion_fiscal,
      persona_contacto: p.persona_contacto,
      telefono: p.telefono,
      activo: true,
      ...AUDIT, ...SYNC,
    }).run();
  }

  console.log('[ok] personas: 1 lista de precios, 8 clientes, 3 proveedores');
}
