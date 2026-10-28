import Link from "next/link";
import type { ObjectId } from "mongodb";
import { AlertTriangle, ArrowRight, CalendarClock, Clock, PackageCheck, ShoppingBag, Truck, Users, Wallet } from "lucide-react";
import { appContext } from "@/lib/auth/guards";
import { can, storeMatch } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { liveStats } from "@/lib/domain/reports";
import { storeNames } from "@/lib/queries";
import { dayRange, luandaDay } from "@/lib/time";
import { formatDayShort, formatKz, formatNumber, formatTime } from "@/lib/format";
import { greeting } from "@/lib/greeting";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LiveDashboard } from "@/components/dashboard/LiveDashboard";
import { InstallCard } from "@/components/pwa/pwa";
import { ATTENDANCE_STATUS } from "@/lib/types";

export const metadata = { title: "Início" };

export default async function Home() {
  const ctx = await appContext();
  const { actor, storeId } = ctx;
  const db = await getDb();
  if (!can(actor, "painel.ver")) return <StaffHome />;

  const today = luandaDay();
  const scope = storeMatch(actor, "storeId", storeId);
  const [stats, names, lowStock, openTills, inTransit, shifts, attendance, unpaid] = await Promise.all([
    liveStats(db, actor, storeId),
    storeNames(db),
    col
      .stock(db)
      .aggregate<{ storeId: ObjectId; qty: number; name: string; label: string; minQty: number }>([
        { $match: scope },
        { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "p" } },
        { $unwind: "$p" },
        { $match: { "p.active": true } },
        { $addFields: { v: { $first: { $filter: { input: "$p.variants", cond: { $eq: ["$$this._id", "$variantId"] } } } } } },
        { $match: { "v.active": true, "v.minQty": { $gt: 0 }, $expr: { $lte: ["$qty", "$v.minQty"] } } },
        { $project: { storeId: 1, qty: 1, name: "$p.name", label: "$v.label", minQty: "$v.minQty" } },
        { $sort: { qty: 1 } },
        { $limit: 8 },
      ])
      .toArray(),
    col.tills(db).find({ status: "aberta", ...scope }).toArray(),
    col.stockDocs(db).find({ type: "transferencia", status: "em_transito", ...storeMatch(actor, "toStoreId", storeId) }).sort({ createdAt: -1 }).limit(5).toArray(),
    col.shifts(db).find({ day: today, ...scope }).toArray(),
    col.attendance(db).find({ day: today, ...scope }).toArray(),
    can(actor, "compras.ver") ? col.purchases(db).countDocuments({ status: { $ne: "cancelada" }, $expr: { $lt: ["$paid", "$total"] }, ...scope }) : Promise.resolve(0),
  ]);
  if (!can(actor, "painel.lucros")) stats.profit = 0;
  const present = attendance.filter((a) => a.status === "presente" || a.status === "atrasado").length;
  const late = attendance.filter((a) => a.status === "atrasado").length;
  const absent = attendance.filter((a) => a.status === "falta").length;

  return (
    <>
      <PageHeader
        eyebrow={formatDayShort(today)}
        title={greeting(ctx.user.name)}
        description={ctx.store ? `A ver ${ctx.store.name}.` : "A ver todas as lojas."}
        actions={
          can(actor, "pos.vender") && ctx.store ? (
            <Button asChild size="lg">
              <Link href="/vender">
                <ShoppingBag /> Vender
              </Link>
            </Button>
          ) : null
        }
      />
      <InstallCard />
      <LiveDashboard initial={stats} storeId={storeId?.toHexString() ?? "all"} storeNames={Object.fromEntries(ctx.stores.map((s) => [s._id.toHexString(), s.name]))} showProfit={can(actor, "painel.lucros")} />

      <div className="mt-6 grid gap-4 md:mt-8 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader title="Equipa hoje" description={`${shifts.length} pessoa(s) com turno`} action={<Users className="size-5 text-muted" />} />
          <CardBody className="pt-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Presentes" value={present} tone="success" />
              <MiniStat label="Atrasos" value={late} tone="warning" />
              <MiniStat label="Faltas" value={absent} tone="danger" />
            </div>
            {can(actor, "rh.presencas_confirmar") && (
              <Button asChild variant="soft" className="mt-4 w-full">
                <Link href="/rh/presencas">
                  Confirmar presenças <ArrowRight />
                </Link>
              </Button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Caixas abertas" description={openTills.length ? `${openTills.length} aberta(s)` : "Nenhuma caixa aberta"} action={<Wallet className="size-5 text-muted" />} />
          <CardBody className="pt-4">
            {openTills.length ? (
              <ul className="flex flex-col gap-3">
                {openTills.map((t) => (
                  <li key={t._id.toHexString()} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{names[t.storeId.toHexString()]}</span>
                      <span className="text-muted">
                        {t.openedBy.name} · desde {formatTime(t.openedAt)}
                      </span>
                    </span>
                    <Badge tone="success" dot>
                      Aberta
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">As caixas abrem-se no ponto de venda.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Para tratar" action={<AlertTriangle className="size-5 text-muted" />} />
          <CardBody className="flex flex-col gap-3 pt-4 text-sm">
            <TodoLink href="/stock/transferencias" icon={<Truck />} label="Transferências a caminho" count={inTransit.length} />
            <TodoLink href="/stock?filtro=baixo" icon={<PackageCheck />} label="Artigos com stock baixo" count={lowStock.length} />
            {can(actor, "compras.ver") && <TodoLink href="/compras?pagamento=por_pagar" icon={<Wallet />} label="Compras por pagar" count={unpaid} />}
          </CardBody>
        </Card>
      </div>

      {lowStock.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Stock baixo" description="Abaixo ou no mínimo definido no produto" />
          <CardBody className="pt-3">
            <ul className="divide-y divide-line/70">
              {lowStock.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">
                      {s.name}
                      {s.label ? ` — ${s.label}` : ""}
                    </span>
                    <span className="text-muted">{names[s.storeId.toHexString()]}</span>
                  </span>
                  <Badge tone={s.qty <= 0 ? "danger" : "warning"}>
                    {formatNumber(s.qty)} / mín. {s.minQty}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" }) {
  const c = { success: "text-success bg-success-soft", warning: "text-warning bg-warning-soft", danger: "text-danger bg-danger-soft" }[tone];
  return (
    <div className={`rounded-2xl px-2 py-3 ${c}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs font-medium opacity-90">{label}</div>
    </div>
  );
}

function TodoLink({ href, icon, label, count }: { href: string; icon: React.ReactNode; label: string; count: number }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl p-2 -m-2 hover:bg-sand">
      <span className="grid size-9 place-items-center rounded-xl bg-sand text-primary [&_svg]:size-[18px]">{icon}</span>
      <span className="flex-1 text-ink-soft">{label}</span>
      <Badge tone={count ? "primary" : "neutral"}>{count}</Badge>
    </Link>
  );
}

async function StaffHome() {
  const ctx = await appContext();
  const db = await getDb();
  const today = luandaDay();
  const { start, end } = dayRange(today);
  const [shift, nextShifts, mySales, attendance] = await Promise.all([
    col.shifts(db).findOne({ userId: ctx.user._id, day: today }),
    col.shifts(db).find({ userId: ctx.user._id, day: { $gt: today } }).sort({ day: 1 }).limit(3).toArray(),
    col
      .sales(db)
      .aggregate<{ total: number; n: number }>([
        { $match: { "seller.id": ctx.user._id, createdAt: { $gte: start, $lt: end }, status: "concluida" } },
        { $group: { _id: null, total: { $sum: { $subtract: ["$total", "$refunded"] } }, n: { $sum: 1 } } },
      ])
      .toArray(),
    col.attendance(db).findOne({ userId: ctx.user._id, day: today }),
  ]);
  const names = await storeNames(db);
  const canSell = can(ctx.actor, "pos.vender");
  return (
    <>
      <PageHeader eyebrow={formatDayShort(today)} title={greeting(ctx.user.name)} description={ctx.store ? `Loja: ${ctx.store.name}` : undefined} />
      <InstallCard />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="bg-primary-soft px-5 py-5 md:px-6">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarClock className="size-4" /> O meu turno de hoje
            </div>
            {shift ? (
              <>
                <div className="mt-2 text-3xl font-semibold text-ink">
                  {shift.start} – {shift.end}
                </div>
                <div className="mt-1 text-sm text-ink-soft">{names[shift.storeId.toHexString()]}</div>
              </>
            ) : (
              <div className="mt-2 text-lg font-medium text-ink">Hoje não tem turno marcado.</div>
            )}
          </div>
          <CardBody className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">Presença</span>
            {attendance ? (
              <Badge tone={attendance.status === "atrasado" ? "warning" : attendance.status === "falta" ? "danger" : "success"}>
                {ATTENDANCE_STATUS[attendance.status]}
                {attendance.checkIn ? ` · ${formatTime(attendance.checkIn)}` : ""}
              </Badge>
            ) : (
              <Badge>Ainda não confirmada</Badge>
            )}
          </CardBody>
        </Card>
        {canSell && (
          <Stat label="As minhas vendas hoje" value={formatKz(mySales[0]?.total ?? 0)} hint={`${mySales[0]?.n ?? 0} venda(s)`} icon={<ShoppingBag />} />
        )}
      </div>
      {canSell && (
        <Button asChild size="xl" className="mt-5 w-full md:w-auto">
          <Link href="/vender">
            <ShoppingBag /> Começar a vender
          </Link>
        </Button>
      )}
      <Card className="mt-5">
        <CardHeader title="Próximos turnos" action={<Clock className="size-5 text-muted" />} />
        <CardBody className="pt-3">
          {nextShifts.length ? (
            <ul className="divide-y divide-line/70">
              {nextShifts.map((s) => (
                <li key={s._id.toHexString()} className="flex items-center justify-between py-3">
                  <span className="font-medium text-ink first-letter:uppercase">{formatDayShort(s.day)}</span>
                  <span className="text-ink-soft tabular">
                    {s.start} – {s.end}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sem turnos marcados" description="Quando o responsável marcar o seu horário, aparece aqui." className="py-6" />
          )}
          <Button asChild variant="ghost" className="mt-2 w-full">
            <Link href="/meu-horario">
              Ver o meu horário completo <ArrowRight />
            </Link>
          </Button>
        </CardBody>
      </Card>
    </>
  );
}
