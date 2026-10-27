import { useCallback, useEffect, useState } from 'react';

import { bridge } from '@core/ui';
export type EventoEstado = 'pendiente' | 'completada' | 'pospuesta' | 'descartada';
export type EventoOrigen = 'rutina' | 'manual' | 'orden_compra' | 'recepcion' | 'bajo_minimo' | 'cierre_caja';
export type AvisoEstado = 'pendiente' | 'enviado' | 'fallido' | 'descartado';
export type AvisoCanal = 'in_app' | 'email' | 'whatsapp';
export type FrecuenciaTipo = 'unica' | 'diaria' | 'semanal' | 'mensual' | 'cada_n_dias';

type Fecha = number | string | Date | null;

export interface AgendaEvento {
  id: string;
  origen: EventoOrigen;
  rutina_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha: Fecha;
  estado: EventoEstado;
  nota: string | null;
  destinatario_tipo: 'usuario' | 'rol';
  destinatario_usuario_id: string | null;
  destinatario_rol: string | null;
  proveedor_id: string | null;
  orden_compra_id: string | null;
  producto_id: string | null;
}

export interface Aviso {
  id: string;
  agenda_evento_id: string | null;
  origen_tipo: string;
  origen_id: string | null;
  canal: AvisoCanal;
  destinatario_usuario_id: string;
  destinatario_contacto: string | null;
  payload: string;   // JSON { titulo, cuerpo, datos }
  estado: AvisoEstado;
  intentos: number;
  ultimo_error: string | null;
  proximo_intento_at: Fecha;
  generado_at: Fecha;
  enviado_at: Fecha;
}

export interface Rutina {
  id: string;
  nombre: string;
  descripcion: string | null;
  frecuencia_tipo: FrecuenciaTipo;
  intervalo: number;
  dia_semana: number | null;
  dia_mes: number | null;
  hora: string | null;
  fecha_inicio: Fecha;
  fecha_fin: Fecha;
  proximo_disparo: Fecha;
  destinatario_tipo: 'usuario' | 'rol';
  destinatario_usuario_id: string | null;
  destinatario_rol: string | null;
  canal_in_app: boolean;
  canal_email: boolean;
  activa: boolean;
}

export interface AgendaBadge { atrasadas: number; avisos_fallidos: number; }

type AgendaApi = {
  rutina: {
    list: (p?: unknown) => Promise<Rutina[]>;
    crear: (p: unknown) => Promise<Rutina>;
    editar: (p: unknown) => Promise<Rutina>;
    pausar: (p: unknown) => Promise<{ ok: boolean }>;
    reanudar: (p: unknown) => Promise<{ ok: boolean }>;
    eliminar: (p: unknown) => Promise<{ ok: boolean }>;
  };
  agenda: {
    crearEvento: (p: unknown) => Promise<AgendaEvento>;
    listar: (p?: unknown) => Promise<AgendaEvento[]>;
    completar: (p: unknown) => Promise<{ ok: boolean }>;
    posponer: (p: unknown) => Promise<{ ok: boolean }>;
    descartar: (p: unknown) => Promise<{ ok: boolean }>;
  };
  aviso: {
    listar: (p?: unknown) => Promise<Aviso[]>;
    reintentar: (p: unknown) => Promise<Aviso>;
    descartar: (p: unknown) => Promise<{ ok: boolean }>;
    badge: () => Promise<AgendaBadge>;
  };
};

export function agendaApi(): AgendaApi {
  return bridge() as AgendaApi;
}

/** Feature flag agenda_habilitado (ADR-044/047). Default false. */
export function useAgendaHabilitado(): boolean {
  const [habilitado, setHabilitado] = useState(false);
  useEffect(() => {
    let vigente = true;
    const p = bridge()?.parametros?.get?.({ clave: 'agenda_habilitado' });
    if (p && typeof p.then === 'function') {
      p.then((v: string | null) => { if (vigente) setHabilitado(v === 'true'); })
        .catch(() => { if (vigente) setHabilitado(false); });
    }
    return () => { vigente = false; };
  }, []);
  return habilitado;
}

export function useAgendaEventos() {
  const [eventos, setEventos] = useState<AgendaEvento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recargar = useCallback(async () => {
    setCargando(true); setError(null);
    try { setEventos(await agendaApi().agenda.listar()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { void recargar(); }, [recargar]);
  return { eventos, cargando, error, recargar };
}

export function useAvisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recargar = useCallback(async () => {
    setCargando(true); setError(null);
    try { setAvisos(await agendaApi().aviso.listar()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { void recargar(); }, [recargar]);
  return { avisos, cargando, error, recargar };
}

export function useRutinas() {
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recargar = useCallback(async () => {
    setCargando(true); setError(null);
    try { setRutinas(await agendaApi().rutina.list()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { void recargar(); }, [recargar]);
  return { rutinas, cargando, error, recargar };
}

/** Contador para la campana. Refresca al montar y cada 60s. */
export function useAgendaBadge(activo = true): AgendaBadge {
  const [badge, setBadge] = useState<AgendaBadge>({ atrasadas: 0, avisos_fallidos: 0 });
  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    const cargar = () => {
      agendaApi().aviso.badge()
        .then((b) => { if (vigente) setBadge(b); })
        .catch(() => { /* sin datos, deja 0 */ });
    };
    cargar();
    const t = setInterval(cargar, 60 * 1000);
    return () => { vigente = false; clearInterval(t); };
  }, [activo]);
  return badge;
}

// Utilidades de payload/formato compartidas por las vistas.
export function parsePayload(payload: string): { titulo: string; cuerpo: string; datos?: unknown } {
  try { return JSON.parse(payload); } catch { return { titulo: '', cuerpo: '' }; }
}

export function toDate(v: Fecha): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
