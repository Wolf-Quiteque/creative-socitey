// Angola usa UTC+1 o ano inteiro (sem horário de verão), por isso basta um desvio fixo.
export const LUANDA_OFFSET_MIN = 60;

const pad = (n: number) => String(n).padStart(2, "0");

/** Data local de Luanda no formato AAAA-MM-DD */
export function luandaDay(d: Date = new Date()): string {
  const l = new Date(d.getTime() + LUANDA_OFFSET_MIN * 60_000);
  return `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}`;
}

/** Minutos desde a meia-noite, em hora de Luanda */
export function luandaMinutes(d: Date = new Date()): number {
  const l = new Date(d.getTime() + LUANDA_OFFSET_MIN * 60_000);
  return l.getUTCHours() * 60 + l.getUTCMinutes();
}

/** Instante UTC correspondente a AAAA-MM-DD HH:MM em Luanda */
export function luandaInstant(day: string, hhmm = "00:00"): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - LUANDA_OFFSET_MIN * 60_000);
}

/** Intervalo [início, fim) de um dia de Luanda em instantes UTC */
export function dayRange(day: string): { start: Date; end: Date } {
  const start = luandaInstant(day);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = domingo … 6 = sábado */
export function weekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Segunda-feira da semana do dia indicado */
export function startOfWeek(day: string): string {
  const wd = weekday(day);
  return addDays(day, wd === 0 ? -6 : 1 - wd);
}

export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

export const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isHHMM = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export function hhmmToMin(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

export type Period = "hoje" | "ontem" | "7d" | "mes" | "mes_anterior" | "30d" | "ano" | "personalizado";

export const PERIOD_LABELS: Record<Exclude<Period, "personalizado">, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7d": "Últimos 7 dias",
  mes: "Este mês",
  mes_anterior: "Mês anterior",
  "30d": "Últimos 30 dias",
  ano: "Este ano",
};

/** Converte um período (ou de/até) num intervalo de dias de Luanda, inclusive */
export function resolvePeriod(period: string | undefined, from?: string, to?: string): { from: string; to: string; period: Period } {
  const today = luandaDay();
  if (isDay(from) && isDay(to) && from <= to) return { from, to, period: "personalizado" };
  switch (period) {
    case "ontem":
      return { from: addDays(today, -1), to: addDays(today, -1), period };
    case "7d":
      return { from: addDays(today, -6), to: today, period };
    case "30d":
      return { from: addDays(today, -29), to: today, period };
    case "mes":
      return { from: startOfMonth(today), to: today, period };
    case "mes_anterior": {
      const firstThis = startOfMonth(today);
      const lastPrev = addDays(firstThis, -1);
      return { from: startOfMonth(lastPrev), to: lastPrev, period };
    }
    case "ano":
      return { from: `${today.slice(0, 4)}-01-01`, to: today, period };
    case "hoje":
      return { from: today, to: today, period };
    default:
      return { from: startOfMonth(today), to: today, period: "mes" };
  }
}

export function rangeOf(from: string, to: string): { start: Date; end: Date } {
  return { start: dayRange(from).start, end: dayRange(to).end };
}
