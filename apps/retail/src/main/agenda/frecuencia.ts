// ADR-047 §3: calculo de proximo_disparo por frecuencia_tipo con aritmetica propia,
// sin librería. dia_mes=31 en meses cortos -> clamp al ultimo dia.

export type FrecuenciaTipo = 'unica' | 'diaria' | 'semanal' | 'mensual' | 'cada_n_dias';

export interface FrecuenciaDef {
  frecuencia_tipo: FrecuenciaTipo;
  intervalo: number;
  dia_semana?: number | null;   // 0..6 (semanal)
  dia_mes?: number | null;      // 1..31 (mensual)
  hora?: string | null;         // "HH:MM" 24h
  fecha_inicio: Date;
  fecha_fin?: Date | null;
}

function parseHora(hora?: string | null): { h: number; m: number } {
  if (!hora) return { h: 9, m: 0 };
  const [h, m] = hora.split(':').map((x) => Number.parseInt(x, 10));
  return { h: Number.isFinite(h) ? h : 9, m: Number.isFinite(m) ? m : 0 };
}

function conHora(fecha: Date, hora?: string | null): Date {
  const { h, m } = parseHora(hora);
  const d = new Date(fecha);
  d.setHours(h, m, 0, 0);
  return d;
}

function ultimoDiaDeMes(anio: number, mes: number): number {
  return new Date(anio, mes + 1, 0).getDate();
}

function sumarDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Proxima ocurrencia ESTRICTAMENTE posterior a `desde`, respetando fecha_inicio,
 * fecha_fin y la hora. Devuelve null si no hay proxima (unica ya pasada, o supera fecha_fin).
 */
export function calcularProximoDisparo(def: FrecuenciaDef, desde: Date): Date | null {
  const inicio = conHora(def.fecha_inicio, def.hora);
  const paso = Math.max(1, def.intervalo || 1);

  const dentroDeFin = (c: Date): Date | null =>
    def.fecha_fin && c.getTime() > def.fecha_fin.getTime() ? null : c;

  switch (def.frecuencia_tipo) {
    case 'unica':
      return inicio.getTime() > desde.getTime() ? dentroDeFin(inicio) : null;

    case 'diaria':
    case 'cada_n_dias': {
      const stride = paso;   // 'diaria' con intervalo>1 se comporta como cada_n_dias
      if (inicio.getTime() > desde.getTime()) return dentroDeFin(inicio);
      const msDia = 24 * 60 * 60 * 1000;
      const diff = desde.getTime() - inicio.getTime();
      const saltos = Math.floor(diff / (stride * msDia)) + 1;
      return dentroDeFin(conHora(sumarDias(def.fecha_inicio, saltos * stride), def.hora));
    }

    case 'semanal': {
      const objetivo = def.dia_semana ?? inicio.getDay();
      let c = new Date(inicio);
      const delta = (objetivo - c.getDay() + 7) % 7;
      c = conHora(sumarDias(c, delta), def.hora);
      while (c.getTime() <= desde.getTime()) c = conHora(sumarDias(c, 7 * paso), def.hora);
      return dentroDeFin(c);
    }

    case 'mensual': {
      const diaPedido = def.dia_mes ?? inicio.getDate();
      const construir = (anio: number, mes: number): Date => {
        const dia = Math.min(diaPedido, ultimoDiaDeMes(anio, mes));   // clamp
        return conHora(new Date(anio, mes, dia), def.hora);
      };
      let anio = Math.max(inicio.getFullYear(), desde.getFullYear());
      let mes = anio === inicio.getFullYear() ? inicio.getMonth() : 0;
      for (let i = 0; i < 480; i++) {   // tope defensivo (40 años)
        const c = construir(anio, mes);
        if (c.getTime() > desde.getTime() && c.getTime() >= inicio.getTime()) {
          return dentroDeFin(c);
        }
        mes += paso;
        while (mes > 11) { mes -= 12; anio += 1; }
      }
      return null;
    }

    default:
      return null;
  }
}
