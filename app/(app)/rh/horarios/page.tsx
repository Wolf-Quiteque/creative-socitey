import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/params";
import { addDays, isDay, luandaDay, startOfWeek } from "@/lib/time";
import { storeStaff } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { ScheduleBoard } from "@/components/hr/ScheduleBoard";
import { HrTabs, hrStore } from "../shared";

export const metadata = { title: "Horários" };

export default async function SchedulePage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePage("rh.horarios_ver");
  const get = await readParams(searchParams);
  const store = hrStore(ctx, "rh.horarios_ver", get("loja"));
  const today = luandaDay();
  const week = startOfWeek(isDay(get("semana")) ? get("semana") : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  if (!store)
    return (
      <>
        <PageHeader title="Horários e presenças" />
        <EmptyState title="Sem lojas" description="Não tem lojas onde possa ver horários." />
      </>
    );
  const db = await getDb();
  const staff = await storeStaff(db, store._id);
  const ids = staff.map((u) => u._id);
  const [shifts, templates] = await Promise.all([
    col.shifts(db).find({ userId: { $in: ids }, day: { $gte: days[0], $lte: days[6] } }).toArray(),
    col.templates(db).find({ _id: { $in: ids } }).toArray(),
  ]);
  return (
    <>
      <PageHeader title="Horários e presenças" description={`Turnos da equipa em ${store.name}. Cada pessoa vê o seu horário em «Meu horário».`} />
      <HrTabs actor={ctx.actor} />
      <ScheduleBoard
        storeId={store._id.toHexString()}
        stores={ctx.stores.filter((s) => can(ctx.actor, "rh.horarios_ver", s._id)).map((s) => ({ id: s._id.toHexString(), name: s.name }))}
        week={week}
        today={today}
        days={days}
        canEdit={can(ctx.actor, "rh.horarios_gerir", store._id)}
        staff={staff.map((u) => ({ id: u._id.toHexString(), name: u.name, job: u.jobTitle }))}
        shifts={shifts.map((s) => ({ userId: s.userId.toHexString(), day: s.day, start: s.start, end: s.end, note: s.note, storeId: s.storeId.toHexString() }))}
        templates={Object.fromEntries(templates.map((t) => [t._id.toHexString(), { storeId: t.storeId.toHexString(), days: t.days }]))}
      />
    </>
  );
}
