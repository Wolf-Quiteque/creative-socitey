"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Clock, LogOut, MoreHorizontal, UserX } from "lucide-react";
import { DropdownMenu as DM } from "radix-ui";
import { useAction } from "@/lib/use-action";
import { markAttendanceAction } from "@/app/actions/app";
import { ATTENDANCE_STATUS, type AttendanceStatus } from "@/lib/types";
import { cn, formatTime } from "@/lib/format";
import { addDays } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, type Tone } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/dialog";

type Row = {
  userId: string;
  name: string;
  job?: string;
  self: boolean;
  shift: { start: string; end: string } | null;
  record: null | { status: AttendanceStatus; checkIn?: string; checkOut?: string; lateMinutes?: number; note?: string; confirmedBy: string; history: { at: string; by: string; change: string }[] };
};

const TONE: Record<AttendanceStatus, Tone> = { presente: "success", atrasado: "warning", falta: "danger", falta_justificada: "info", folga: "neutral", ferias: "rose" };
type Act = "chegou" | "saiu" | "falta" | "justificar" | "folga" | "ferias" | "limpar";

export function AttendanceBoard({ rows, storeId, stores, day, today, nowMin, canEdit, canPast, isOwner }: { rows: Row[]; storeId: string; stores: { id: string; name: string }[]; day: string; today: string; nowMin: number; canEdit: boolean; canPast: boolean; isOwner: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const { pending, run } = useAction();
  const [detail, setDetail] = React.useState<null | { row: Row; action: Act; time: string; note: string }>(null);
  const isToday = day === today;
  const nowHHMM = `${String(Math.floor(nowMin / 60)).padStart(2, "0")}:${String(nowMin % 60).padStart(2, "0")}`;
  const go = (d: string, s = storeId) => router.push(`${path}?dia=${d}&loja=${s}`);
  const mark = (row: Row, action: Act, time?: string, note?: string) =>
    run(() => markAttendanceAction({ userId: row.userId, storeId, day, action, time, note: note || undefined }), {
      success: action === "chegou" ? `Entrada de ${row.name.split(" ")[0]} registada.` : action === "saiu" ? "Saída registada." : "Registo atualizado.",
      onSuccess: () => setDetail(null),
    });

  const scheduled = rows.filter((r) => r.shift);
  const present = rows.filter((r) => r.record && (r.record.status === "presente" || r.record.status === "atrasado")).length;
  const pendingCount = scheduled.filter((r) => !r.record).length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {stores.length > 1 && (
          <Select className="w-auto" value={storeId} onChange={(e) => go(day, e.target.value)} aria-label="Loja">
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        {canPast || !isToday ? (
          <Input type="date" className="w-auto" value={day} max={today} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Dia" />
        ) : null}
        {!isToday && (
          <Button variant="ghost" onClick={() => go(today)}>
            Voltar a hoje
          </Button>
        )}
        {canPast && isToday && (
          <Button variant="ghost" onClick={() => go(addDays(today, -1))}>
            Ontem
          </Button>
        )}
      </div>
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Summary label="Com turno" value={scheduled.length} />
        <Summary label="Presentes" value={present} tone="success" />
        <Summary label="Por confirmar" value={pendingCount} tone={pendingCount ? "warning" : undefined} />
      </div>
      {!canEdit && <p className="mb-4 rounded-2xl bg-warning-soft p-3 text-sm text-warning">{isToday ? "Pode ver, mas não confirmar presenças nesta loja." : "Para alterar dias anteriores precisa da permissão «Corrigir presenças»."}</p>}

      <Card>
        <ul className="divide-y divide-line/70">
          {rows.map((r) => {
            const late = r.shift && isToday && !r.record && nowMin > Number(r.shift.start.slice(0, 2)) * 60 + Number(r.shift.start.slice(3)) + 0;
            const blocked = !canEdit || (r.self && !isOwner);
            return (
              <li key={r.userId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center md:px-6">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={r.name} />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{r.name}</div>
                    <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {r.shift ? `${r.shift.start}–${r.shift.end}` : "Sem turno"}
                      </span>
                      {r.record?.checkIn && <span>· entrou {formatTime(r.record.checkIn)}</span>}
                      {r.record?.checkOut && <span>· saiu {formatTime(r.record.checkOut)}</span>}
                      {r.record?.lateMinutes ? <span className="text-warning">· {r.record.lateMinutes} min de atraso</span> : null}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {r.record ? (
                    <button onClick={() => setDetail({ row: r, action: "chegou", time: nowHHMM, note: "" })}>
                      <Badge tone={TONE[r.record.status]}>{ATTENDANCE_STATUS[r.record.status]}</Badge>
                    </button>
                  ) : r.shift ? (
                    <Badge tone={late ? "warning" : "neutral"}>{late ? "Ainda não chegou" : "Por confirmar"}</Badge>
                  ) : null}
                  {!blocked && (
                    <>
                      {(!r.record || r.record.status === "falta") && (
                        <Button size="sm" variant="success" loading={pending} onClick={() => (isToday ? mark(r, "chegou") : setDetail({ row: r, action: "chegou", time: r.shift?.start ?? "09:00", note: "" }))}>
                          <Check /> Chegou
                        </Button>
                      )}
                      {r.record?.checkIn && !r.record.checkOut && (
                        <Button size="sm" variant="outline" loading={pending} onClick={() => (isToday ? mark(r, "saiu") : setDetail({ row: r, action: "saiu", time: r.shift?.end ?? "17:00", note: "" }))}>
                          <LogOut /> Saiu
                        </Button>
                      )}
                      {!r.record && r.shift && (
                        <Button size="sm" variant="danger-soft" loading={pending} onClick={() => mark(r, "falta")}>
                          <UserX /> Faltou
                        </Button>
                      )}
                      <DM.Root>
                        <DM.Trigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label="Mais opções">
                            <MoreHorizontal />
                          </Button>
                        </DM.Trigger>
                        <DM.Portal>
                          <DM.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-lift">
                            {(
                              [
                                ["chegou", "Chegou a outra hora…"],
                                ["saiu", "Saiu a outra hora…"],
                                ["justificar", "Falta justificada…"],
                                ["folga", "Marcar folga"],
                                ["ferias", "Marcar férias"],
                                ["limpar", "Apagar registo"],
                              ] as [Act, string][]
                            )
                              .filter(([a]) => (a === "saiu" ? !!r.record?.checkIn : a === "limpar" ? !!r.record : true))
                              .map(([a, label]) => (
                                <DM.Item
                                  key={a}
                                  onSelect={() => (a === "folga" || a === "ferias" || a === "limpar" ? mark(r, a) : setDetail({ row: r, action: a, time: a === "chegou" ? (r.shift?.start ?? nowHHMM) : a === "saiu" ? (isToday ? nowHHMM : (r.shift?.end ?? "17:00")) : nowHHMM, note: "" }))}
                                  className={cn("flex h-11 cursor-pointer items-center rounded-xl px-3 text-sm outline-none data-[highlighted]:bg-sand", a === "limpar" ? "text-danger" : "text-ink")}
                                >
                                  {label}
                                </DM.Item>
                              ))}
                          </DM.Content>
                        </DM.Portal>
                      </DM.Root>
                    </>
                  )}
                  {r.self && !isOwner && canEdit && <span className="text-xs text-muted">Outra pessoa confirma a sua presença</span>}
                </div>
              </li>
            );
          })}
          {!rows.length && <li className="px-6 py-10 text-center text-muted">Ainda não há pessoas nesta loja.</li>}
        </ul>
      </Card>

      <Sheet
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail?.row.name ?? ""}
        description={detail?.action === "justificar" ? "Escreva a justificação (ex.: atestado médico)." : detail?.action === "saiu" ? "A que horas saiu?" : "A que horas chegou?"}
        size="sm"
        footer={
          !canEdit || (detail?.row.self && !isOwner) ? undefined : (
            <Button loading={pending} disabled={detail?.action === "justificar" && !detail.note.trim()} onClick={() => detail && mark(detail.row, detail.action, detail.action === "justificar" ? undefined : detail.time, detail.note)}>
              Guardar
            </Button>
          )
        }
      >
        {detail && (
          <div className="grid gap-4">
            {detail.action !== "justificar" && (
              <Field label="Hora">
                <Input type="time" value={detail.time} onChange={(e) => setDetail({ ...detail, time: e.target.value })} />
              </Field>
            )}
            <Field label={detail.action === "justificar" ? "Justificação" : "Nota (opcional)"}>
              <Textarea value={detail.note} onChange={(e) => setDetail({ ...detail, note: e.target.value })} className="min-h-16" />
            </Field>
            {detail.row.record && (
              <div>
                <div className="mb-2 text-sm font-medium text-ink-soft">Histórico do dia</div>
                <ul className="flex flex-col gap-1.5 text-[13px] text-muted">
                  {detail.row.record.history.map((h, i) => (
                    <li key={i}>
                      {formatTime(h.at)} · {h.by}: {h.change}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" }) {
  return (
    <div className={cn("rounded-2xl border border-line/70 bg-surface p-4 shadow-soft", tone === "success" && "bg-success-soft", tone === "warning" && "bg-warning-soft")}>
      <div className={cn("text-2xl font-semibold", tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-ink")}>{value}</div>
      <div className="text-[13px] text-muted">{label}</div>
    </div>
  );
}
