import { requirePage } from "@/lib/auth/guards";
import { storeMatch } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/params";
import { addDays, luandaDay } from "@/lib/time";
import { formatMinutes, MONTHS_LONG } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/table";
import { ParamSelect } from "@/components/filters/Filters";
import { HrTabs } from "../shared";

export const metadata = { title: "Relatórios de RH" };

const mins = (a: string, b: string) => Number(b.slice(0, 2)) * 60 + Number(b.slice(3)) - (Number(a.slice(0, 2)) * 60 + Number(a.slice(3)));

export default async function HrReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePage("rh.relatorios");
  const get = await readParams(searchParams);
  const today = luandaDay();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const month = months.includes(get("mes")) ? get("mes") : months[0];
  const from = `${month}-01`;
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1));
  const to = addDays(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`, -1);
  const until = to < today ? to : today;
  const db = await getDb();
  const scope = storeMatch(ctx.actor, "storeId", ctx.storeId);
  const [shifts, records] = await Promise.all([col.shifts(db).find({ day: { $gte: from, $lte: until }, ...scope }).toArray(), col.attendance(db).find({ day: { $gte: from, $lte: until }, ...scope }).toArray()]);
  const ids = new Map([...shifts, ...records].map((x) => [x.userId.toHexString(), x.userId]));
  const users = await col.users(db).find({ _id: { $in: [...ids.values()] } }).toArray();
  const rows = users
    .map((u) => {
      const my = shifts.filter((s) => s.userId.equals(u._id));
      const rec = records.filter((r) => r.userId.equals(u._id));
      const count = (s: string) => rec.filter((r) => r.status === s).length;
      const worked = rec.reduce((s, r) => s + (r.checkIn && r.checkOut ? Math.max(0, (r.checkOut.getTime() - r.checkIn.getTime()) / 60000) : 0), 0);
      return {
        id: u._id.toHexString(),
        name: u.name,
        shifts: my.length,
        planned: my.reduce((s, x) => s + mins(x.start, x.end), 0),
        present: count("presente") + count("atrasado"),
        late: count("atrasado"),
        lateMin: rec.reduce((s, r) => s + (r.status === "atrasado" ? (r.lateMinutes ?? 0) : 0), 0),
        absent: count("falta"),
        justified: count("falta_justificada"),
        off: count("folga") + count("ferias"),
        unconfirmed: my.filter((s) => s.day < today && !rec.some((r) => r.day === s.day)).length,
        worked,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title="Horários e presenças" description={`Resumo de ${MONTHS_LONG[Number(month.slice(5)) - 1]} ${month.slice(0, 4)} · ${ctx.store ? ctx.store.name : "todas as lojas"}`} />
      <HrTabs actor={ctx.actor} />
      <div className="mb-4">
        <ParamSelect name="mes" label="Mês" value={month} options={months.map((m) => ({ value: m, label: `${MONTHS_LONG[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}` }))} />
      </div>
      <Card>
        <ResponsiveTable
          rows={rows}
          rowKey={(r) => r.id}
          empty={<EmptyState title="Sem dados neste mês" description="Crie horários e confirme presenças para ver o resumo." />}
          columns={[
            { header: "Pessoa", cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
            { header: "Turnos", align: "right", cell: (r) => r.shifts },
            { header: "Presenças", align: "right", cell: (r) => r.present },
            { header: "Atrasos", align: "right", cell: (r) => (r.late ? <span className="text-warning">{`${r.late} (${formatMinutes(r.lateMin)})`}</span> : "0") },
            { header: "Faltas", align: "right", cell: (r) => (r.absent ? <span className="font-semibold text-danger">{r.absent}</span> : "0") },
            { header: "Justificadas", align: "right", cell: (r) => r.justified },
            { header: "Folgas/férias", align: "right", cell: (r) => r.off },
            { header: "Sem registo", align: "right", cell: (r) => (r.unconfirmed ? <span className="text-warning">{r.unconfirmed}</span> : "0") },
            { header: "Horas", align: "right", cell: (r) => `${formatMinutes(r.worked)} / ${formatMinutes(r.planned)}` },
          ]}
          mobile={(r) => (
            <div>
              <div className="font-medium text-ink">{r.name}</div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-[13px] text-muted">
                <span>{r.present} presenças</span>
                <span className={r.late ? "text-warning" : ""}>{r.late} atrasos</span>
                <span className={r.absent ? "text-danger" : ""}>{r.absent} faltas</span>
                <span className="col-span-3">
                  {formatMinutes(r.worked)} trabalhadas de {formatMinutes(r.planned)} previstas
                </span>
              </div>
            </div>
          )}
        />
      </Card>
    </>
  );
}
