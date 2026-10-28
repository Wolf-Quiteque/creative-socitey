import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { LUANDA_OFFSET_MIN } from "./time";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Kwanza sem Intl, para que servidor e browser produzam o mesmo texto.
 * 89000 → "89.000 Kz"
 */
export function formatKz(value: number | null | undefined): string {
  const rounded = Math.round(value ?? 0);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}${group(Math.abs(rounded))} Kz`;
}

/** Número com separador de milhares e até `decimals` casas (vírgula decimal) */
export function formatNumber(value: number | null | undefined, decimals = 0): string {
  const v = value ?? 0;
  const sign = v < 0 ? "-" : "";
  const fixed = Math.abs(v).toFixed(decimals);
  const [int, dec] = fixed.split(".");
  const out = group(Number(int));
  return sign + (dec && Number(dec) !== 0 ? `${out},${dec.replace(/0+$/, "")}` : out);
}

export function formatPct(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)}%`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Partes da data em hora de Luanda (UTC+1, sem horário de verão) */
function luanda(d: Date | string) {
  const t = new Date(typeof d === "string" ? d : d.getTime());
  return new Date(t.getTime() + LUANDA_OFFSET_MIN * 60_000);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const l = luanda(d);
  return `${l.getUTCDate()} ${MONTHS[l.getUTCMonth()]} ${l.getUTCFullYear()}`;
}

export function formatTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const l = luanda(d);
  return `${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}`;
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return `${formatDate(d)}, ${formatTime(d)}`;
}

/** "2026-10-28" → "28 out 2026" */
export function formatDay(day: string): string {
  const [y, m, dd] = day.split("-").map(Number);
  return `${dd} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-10-28" → "qua, 28 out" */
export function formatDayShort(day: string): string {
  const [y, m, dd] = day.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
  return `${["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][wd]}, ${dd} ${MONTHS[m - 1]}`;
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h}h${pad(m)}` : `${h}h`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Lê "45.000", "45 000" ou "45000,50" como número */
export function parseAmount(input: string): number {
  const clean = input.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

/** Valor curto para eixos e cartões: 45 mil, 1,3 M */
export function formatKzCompact(value: number): string {
  const v = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (v >= 1e9) return `${sign}${formatNumber(v / 1e9, 1)} mil M`;
  if (v >= 1e6) return `${sign}${formatNumber(v / 1e6, 1)} M`;
  if (v >= 1e3) return `${sign}${formatNumber(Math.round(v / 1e3))} mil`;
  return `${sign}${formatNumber(v)}`;
}
