"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarCog, ChevronLeft, ChevronRight, Copy, Wand2 } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { applyTemplatesAction, copyWeekAction, deleteShiftAction, saveShiftAction, saveTemplateAction } from "@/app/actions/app";
import { addDays } from "@/lib/time";
import { cn, formatDayShort, formatMinutes } from "@/lib/format";
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Avatar, Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/dialog";
import { confirmAction } from "@/components/ui/confirm";

type Shift = { userId: string; day: string; start: string; end: string; note?: string; storeId: string };
type Tpl = { storeId: string; days: ({ start: string; end: string } | null)[] };

const mins = (s: { start: string; end: string }) => {
  const [a, b] = s.start.split(":").map(Number);
  const [c, d] = s.end.split(":").map(Number);
  return c * 60 + d - (a * 60 + b);
};

export function ScheduleBoard({
  storeId,
  stores,
  week,
  today,
  days,
  canEdit,
  staff,
  shifts,
  templates,
}: {
  storeId: string;
  stores: { id: string; name: string }[];
  week: string;
  today: string;
  days: string[];
  canEdit: boolean;
  staff: { id: string; name: string; job?: string }[];
  shifts: Shift[];
  templates: Record<string, Tpl>;
}) {
  const router = useRouter();
  const path = usePathname();
  const { pending, run } = useAction();
  const [edit, setEdit] = React.useState<null | { userId: string; name: string; day: string; start: string; end: string; note: string; exists: boolean }>(null);
  const [tplFor, setTplFor] = React.useState<null | { userId: string; name: string; days: ({ start: string; end: string } | null)[] }>(null);
  const [mobileDay, setMobileDay] = React.useState(days.includes(today) ? today : days[0]);
  const go = (w: string, s = storeId) => router.push(`${path}?semana=${w}&loja=${s}`);
  const shiftOf = (u: string, d: string) => shifts.find((s) => s.userId === u && s.day === d);
  const open = (u: { id: string; name: string }, d: string) => {
    if (!canEdit) return;
    const s = shiftOf(u.id, d);
    const tpl = templates[u.id]?.days[new Date(`${d}T12:00:00Z`).getUTCDay()];
    setEdit({ userId: u.id, name: u.name, day: d, start: s?.start ?? tpl?.start ?? "09:00", end: s?.end ?? tpl?.end ?? "17:00", note: s?.note ?? "", exists: !!s });
  };

  const Cell = ({ u, d }: { u: { id: string; name: string }; d: string }) => {
    const s = shiftOf(u.id, d);
    const other = s && s.storeId !== storeId;
    return (
      <button
        disabled={!canEdit}
        onClick={() => open(u, d)}
        className={cn(
          "flex h-14 w-full flex-col items-center justify-center rounded-xl text-[13px] transition-colors",
          s ? (other ? "bg-sand text-muted" : "bg-primary-soft font-medium text-primary") : "text-muted/60",
          canEdit && "hover:ring-2 hover:ring-primary/30",
          d === today && !s && "bg-sand/50",
        )}
      >
        {s ? (
          <>
            <span className="tabular">
              {s.start}–{s.end}
            </span>
            {other && <span className="text-[11px]">outra loja</span>}
          </>
        ) : canEdit ? (
          "+"
        ) : (
          "—"
        )}
      </button>
    );
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {stores.length > 1 && (
          <Select className="w-auto" value={storeId} onChange={(e) => go(week, e.target.value)} aria-label="Loja">
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <div className="flex items-center rounded-xl border border-line bg-surface">
          <button className="grid size-11 place-items-center text-muted hover:text-ink" onClick={() => go(addDays(week, -7))} aria-label="Semana anterior">
            <ChevronLeft className="size-5" />
          </button>
          <span className="px-2 text-sm font-medium text-ink">
            {formatDayShort(days[0])} – {formatDayShort(days[6])}
          </span>
          <button className="grid size-11 place-items-center text-muted hover:text-ink" onClick={() => go(addDays(week, 7))} aria-label="Semana seguinte">
            <ChevronRight className="size-5" />
          </button>
        </div>
        {canEdit && (
          <>
            <Button
              variant="outline"
              loading={pending}
              onClick={async () => {
                if ((await confirmAction({ title: "Copiar a semana anterior?", description: "Os turnos da semana passada são copiados para esta. Os que já existem ficam como estão.", confirm: "Copiar" })) !== false)
                  run(() => copyWeekAction({ storeId, fromWeek: addDays(week, -7), toWeek: week, overwrite: false }), { success: "Semana copiada." });
              }}
            >
              <Copy /> Copiar semana anterior
            </Button>
            <Button
              variant="outline"
              loading={pending}
              onClick={async () => {
                if ((await confirmAction({ title: "Aplicar os modelos semanais?", description: "Cria os turnos desta semana a partir do modelo de cada pessoa. Os turnos que já existem ficam como estão.", confirm: "Aplicar" })) !== false)
                  run(() => applyTemplatesAction({ storeId, from: days[0], to: days[6], overwrite: false }), { success: "Modelos aplicados." });
              }}
            >
              <Wand2 /> Aplicar modelos
            </Button>
          </>
        )}
      </div>

      {staff.length === 0 ? (
        <Card className="p-10 text-center text-muted">Ainda não há pessoas nesta loja. Crie contas em Equipa.</Card>
      ) : (
        <>
          {/* Computador: grelha da semana */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-line text-[13px] text-muted">
                  <th className="py-3 pl-6 pr-3 text-left font-medium">Pessoa</th>
                  {days.map((d, i) => (
                    <th key={d} className={cn("px-1 py-3 font-medium", d === today && "text-primary")}>
                      {WEEKDAYS_SHORT[(i + 1) % 7]} {Number(d.slice(8))}
                    </th>
                  ))}
                  <th className="py-3 pl-3 pr-6 text-right font-medium">Horas</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => {
                  const total = days.reduce((s, d) => {
                    const x = shiftOf(u.id, d);
                    return s + (x ? mins(x) : 0);
                  }, 0);
                  return (
                    <tr key={u.id} className="border-b border-line/60 last:border-0">
                      <td className="py-2 pl-6 pr-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-ink">{u.name}</div>
                            {canEdit && (
                              <button className="text-xs text-primary hover:underline" onClick={() => setTplFor({ userId: u.id, name: u.name, days: templates[u.id]?.days ?? Array(7).fill(null) })}>
                                Modelo semanal
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      {days.map((d) => (
                        <td key={d} className="px-1 py-2">
                          <Cell u={u} d={d} />
                        </td>
                      ))}
                      <td className="py-2 pl-3 pr-6 text-right text-sm text-ink-soft tabular">{formatMinutes(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Telemóvel: um dia de cada vez */}
          <div className="md:hidden">
            <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 scrollbar-none">
              {days.map((d, i) => (
                <button
                  key={d}
                  onClick={() => setMobileDay(d)}
                  className={cn("flex w-14 shrink-0 flex-col items-center rounded-2xl py-2", mobileDay === d ? "bg-ink text-bg" : d === today ? "bg-primary-soft text-primary" : "bg-sand text-ink-soft")}
                >
                  <span className="text-xs">{WEEKDAYS_SHORT[(i + 1) % 7]}</span>
                  <span className="text-lg font-semibold">{Number(d.slice(8))}</span>
                </button>
              ))}
            </div>
            <Card>
              <ul className="divide-y divide-line/70">
                {staff.map((u) => {
                  const s = shiftOf(u.id, mobileDay);
                  return (
                    <li key={u.id}>
                      <button disabled={!canEdit} onClick={() => open(u, mobileDay)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                        <Avatar name={u.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink">{u.name}</span>
                          {u.job && <span className="text-[13px] text-muted">{u.job}</span>}
                        </span>
                        <span className={cn("rounded-full px-3 py-1 text-sm tabular", s ? "bg-primary-soft font-medium text-primary" : "text-muted")}>{s ? `${s.start}–${s.end}` : "Folga"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </>
      )}

      <Sheet
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={edit ? `${edit.name}` : ""}
        description={edit ? formatDayShort(edit.day) : undefined}
        size="sm"
        footer={
          <>
            {edit?.exists && (
              <Button variant="danger-soft" loading={pending} onClick={() => edit && run(() => deleteShiftAction(edit.userId, edit.day), { onSuccess: () => setEdit(null) })}>
                Apagar turno (folga)
              </Button>
            )}
            <Button loading={pending} onClick={() => edit && run(() => saveShiftAction({ userId: edit.userId, storeId, day: edit.day, start: edit.start, end: edit.end, note: edit.note || undefined }), { onSuccess: () => setEdit(null) })}>
              Guardar turno
            </Button>
          </>
        }
      >
        {edit && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Entrada">
              <Input type="time" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} />
            </Field>
            <Field label="Saída">
              <Input type="time" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} />
            </Field>
            <Field label="Nota (opcional)" className="col-span-2">
              <Input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="ex.: cobre a Joana" />
            </Field>
          </div>
        )}
      </Sheet>

      <Sheet
        open={!!tplFor}
        onOpenChange={(o) => !o && setTplFor(null)}
        title={`Modelo semanal — ${tplFor?.name ?? ""}`}
        description="O horário habitual desta pessoa. Use «Aplicar modelos» para criar os turnos da semana."
        footer={
          <Button loading={pending} onClick={() => tplFor && run(() => saveTemplateAction({ userId: tplFor.userId, storeId, days: tplFor.days }), { onSuccess: () => setTplFor(null) })}>
            <CalendarCog /> Guardar modelo
          </Button>
        }
      >
        {tplFor && (
          <ul className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
              const slot = tplFor.days[wd];
              const set = (v: { start: string; end: string } | null) => setTplFor({ ...tplFor, days: tplFor.days.map((x, i) => (i === wd ? v : x)) });
              return (
                <li key={wd} className="grid grid-cols-[110px_1fr] items-center gap-3 rounded-xl bg-sand/60 px-3 py-2 sm:grid-cols-[130px_1fr]">
                  <label className="flex items-center gap-2 text-sm font-medium text-ink">
                    <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={!!slot} onChange={(e) => set(e.target.checked ? { start: "09:00", end: "17:00" } : null)} />
                    {WEEKDAYS[wd]}
                  </label>
                  {slot ? (
                    <div className="flex items-center gap-2">
                      <Input type="time" value={slot.start} onChange={(e) => set({ ...slot, start: e.target.value })} />
                      <span className="text-muted">–</span>
                      <Input type="time" value={slot.end} onChange={(e) => set({ ...slot, end: e.target.value })} />
                    </div>
                  ) : (
                    <span className="text-sm text-muted">Folga</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </>
  );
}
