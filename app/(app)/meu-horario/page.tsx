import { CalendarClock } from "lucide-react";
import { appContext } from "@/lib/auth/guards";
import { col, getDb } from "@/lib/db";
import { addDays, luandaDay, startOfWeek } from "@/lib/time";
import { storeNames } from "@/lib/queries";
import { cn, formatDayShort, formatMinutes, formatTime } from "@/lib/format";
import { ATTENDANCE_STATUS } from "@/lib/types";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/card";

export const metadata = { title: "Meu horário" };

const mins = (a: string, b: string) => Number(b.slice(0, 2)) * 60 + Number(b.slice(3)) - (Number(a.slice(0, 2)) * 60 + Number(a.slice(3)));

export default async function MySchedulePage() {
  const ctx = await appContext();
  const db = await getDb();
  const today = luandaDay();
  const week = startOfWeek(today);
  const days = Array.from({ length: 14 }, (_, i) => addDays(week, i));
  const [shifts, records, names] = await Promise.all([
    col.shifts(db).find({ userId: ctx.user._id, day: { $gte: days[0], $lte: days[13] } }).toArray(),
    col.attendance(db).find({ userId: ctx.user._id, day: { $gte: addDays(today, -30) } }).sort({ day: -1 }).toArray(),
    storeNames(db),
  ]);
  const monthRecs = records.filter((r) => r.day >= `${today.slice(0, 7)}-01`);
  const lateCount = monthRecs.filter((r) => r.status === "atrasado").length;
  const absences = monthRecs.filter((r) => r.status === "falta").length;
  const weekHours = shifts.filter((s) => s.day <= days[6]).reduce((s, x) => s + mins(x.start, x.end), 0);

  const WeekList = ({ list, title }: { list: string[]; title: string }) => (
    <Card>
      <CardHeader title={title} />
      <CardBody className="pt-3">
        <ul className="flex flex-col gap-2">
          {list.map((d) => {
            const s = shifts.find((x) => x.day === d);
            const r = records.find((x) => x.day === d);
            return (
              <li key={d} className={cn("flex items-center justify-between gap-3 rounded-2xl px-4 py-3", d === today ? "bg-primary-soft" : s ? "bg-sand/60" : "")}>
                <div>
                  <div className={cn("font-medium first-letter:uppercase", d === today ? "text-primary" : "text-ink")}>
                    {formatDayShort(d)}
                    {d === today && " · hoje"}
                  </div>
                  {s && <div className="text-[13px] text-muted">{names[s.storeId.toHexString()]}</div>}
                </div>
                <div className="text-right">
                  <div className={cn("font-semibold tabular", s ? "text-ink" : "text-muted")}>{s ? `${s.start} – ${s.end}` : "Folga"}</div>
                  {r && <div className="text-[13px] text-muted">{ATTENDANCE_STATUS[r.status]}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );

  return (
    <>
      <PageHeader title="Meu horário" description="Os seus turnos desta semana e da próxima, e as suas presenças." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Horas esta semana" value={formatMinutes(weekHours)} icon={<CalendarClock />} />
        <Stat label="Atrasos este mês" value={String(lateCount)} tone={lateCount ? "down" : "neutral"} />
        <Stat className="col-span-2 md:col-span-1" label="Faltas este mês" value={String(absences)} tone={absences ? "down" : "neutral"} />
      </div>
      {shifts.length === 0 && records.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarClock />} title="Ainda sem horário" description="Quando o responsável marcar os seus turnos, aparecem aqui." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <WeekList list={days.slice(0, 7)} title="Esta semana" />
          <WeekList list={days.slice(7)} title="Próxima semana" />
        </div>
      )}
      {records.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Presenças dos últimos 30 dias" />
          <CardBody className="pt-3">
            <ul className="divide-y divide-line/70">
              {records.map((r) => (
                <li key={r._id.toHexString()} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-ink first-letter:uppercase">{formatDayShort(r.day)}</span>
                  <span className="flex items-center gap-2 text-muted">
                    {r.checkIn && `${formatTime(r.checkIn)}${r.checkOut ? `–${formatTime(r.checkOut)}` : ""}`}
                    <Badge tone={r.status === "atrasado" ? "warning" : r.status === "falta" ? "danger" : r.status === "presente" ? "success" : "neutral"}>{ATTENDANCE_STATUS[r.status]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}
