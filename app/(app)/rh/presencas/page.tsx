import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";
import { col, getDb, getSettings } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/params";
import { isDay, luandaDay, luandaMinutes } from "@/lib/time";
import { storeStaff } from "@/lib/queries";
import { formatDayShort } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { AttendanceBoard } from "@/components/hr/AttendanceBoard";
import { HrTabs, hrStore } from "../shared";

export const metadata = { title: "Presenças" };

export default async function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePage(["rh.presencas_confirmar", "rh.presencas_editar"]);
  const get = await readParams(searchParams);
  const today = luandaDay();
  const day = isDay(get("dia")) && get("dia") <= today ? get("dia") : today;
  const perm = day === today ? "rh.presencas_confirmar" : "rh.presencas_editar";
  const store = hrStore(ctx, can(ctx.actor, perm) ? perm : "rh.presencas_confirmar", get("loja"));
  if (!store)
    return (
      <>
        <PageHeader title="Horários e presenças" />
        <EmptyState title="Sem lojas" description="Não tem lojas onde possa confirmar presenças." />
      </>
    );
  const db = await getDb();
  const [staff, settings] = await Promise.all([storeStaff(db, store._id), getSettings(db)]);
  const ids = staff.map((u) => u._id);
  const [shifts, records] = await Promise.all([col.shifts(db).find({ userId: { $in: ids }, day }).toArray(), col.attendance(db).find({ userId: { $in: ids }, day }).toArray()]);
  const rows = staff
    .map((u) => {
      const s = shifts.find((x) => x.userId.equals(u._id));
      const a = records.find((x) => x.userId.equals(u._id));
      return {
        userId: u._id.toHexString(),
        name: u.name,
        job: u.jobTitle,
        self: u._id.equals(ctx.actor.id),
        shift: s && s.storeId.equals(store._id) ? { start: s.start, end: s.end } : null,
        otherStore: !!s && !s.storeId.equals(store._id),
        record: a ? { status: a.status, checkIn: a.checkIn?.toISOString(), checkOut: a.checkOut?.toISOString(), lateMinutes: a.lateMinutes, note: a.note, confirmedBy: a.confirmedBy.name, history: a.history.map((h) => ({ at: h.at.toISOString(), by: h.by.name, change: h.change })) } : null,
      };
    })
    .filter((r) => !r.otherStore)
    .sort((a, b) => (a.shift ? 0 : 1) - (b.shift ? 0 : 1) || (a.shift?.start ?? "").localeCompare(b.shift?.start ?? ""));
  return (
    <>
      <PageHeader title="Horários e presenças" description={`${store.name} · ${formatDayShort(day)}. Tolerância de atraso: ${settings.lateToleranceMin} min.`} />
      <HrTabs actor={ctx.actor} />
      <AttendanceBoard
        rows={rows}
        storeId={store._id.toHexString()}
        stores={ctx.stores.filter((s) => can(ctx.actor, "rh.presencas_confirmar", s._id) || can(ctx.actor, "rh.presencas_editar", s._id)).map((s) => ({ id: s._id.toHexString(), name: s.name }))}
        day={day}
        today={today}
        nowMin={luandaMinutes()}
        canEdit={can(ctx.actor, perm, store._id)}
        canPast={can(ctx.actor, "rh.presencas_editar", store._id)}
        isOwner={ctx.actor.isOwner}
      />
    </>
  );
}
