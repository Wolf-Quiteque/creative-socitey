import { ObjectId, type Db } from "mongodb";
import { col } from "../db";
import { storeMatch, type Actor } from "../actor";
import { LOSS_MOVEMENTS, type CategoryKind, type PaymentMethod } from "../types";
import { addDays, dayRange, luandaDay, rangeOf } from "../time";

export type ReportScope = { from: string; to: string; storeId: ObjectId | null };

const notVoided = { voided: { $exists: false } };

/** Filtro de loja para o livro de caixa: com "todas as lojas" inclui também movimentos gerais (sem loja) */
function cashStoreMatch(actor: Actor, storeId: ObjectId | null) {
  if (storeId) return storeMatch(actor, "storeId", storeId);
  return actor.allStores ? {} : storeMatch(actor, "storeId");
}

export type ProfitReport = {
  revenue: number;
  grossSales: number;
  discounts: number;
  refunds: number;
  cogs: number;
  grossProfit: number;
  margin: number;
  otherIncome: number;
  expenses: number;
  losses: number;
  netProfit: number;
  salesCount: number;
  expensesByCategory: { name: string; amount: number }[];
  incomeByCategory: { name: string; amount: number }[];
  lossesByType: { type: string; amount: number }[];
};

export async function profitReport(db: Db, actor: Actor, scope: ReportScope): Promise<ProfitReport> {
  const { start, end } = rangeOf(scope.from, scope.to);
  const saleMatch = { createdAt: { $gte: start, $lt: end }, status: "concluida", ...storeMatch(actor, "storeId", scope.storeId) };
  const [s] = await col
    .sales(db)
    .aggregate<{ total: number; subtotal: number; discount: number; refunded: number; cost: number; returnedCost: number; n: number }>([
      { $match: saleMatch },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" },
          subtotal: { $sum: "$subtotal" },
          discount: { $sum: "$discount" },
          refunded: { $sum: "$refunded" },
          cost: { $sum: "$cost" },
          returnedCost: { $sum: "$returnedCost" },
          n: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const cashMatch = { at: { $gte: start, $lt: end }, ...notVoided, ...cashStoreMatch(actor, scope.storeId) };
  const cats = await col
    .cashbook(db)
    .aggregate<{ _id: { name: string; kind: CategoryKind; type: string }; amount: number }>([
      { $match: { ...cashMatch, "category.kind": { $in: ["despesa", "receita"] } } },
      { $group: { _id: { name: "$category.name", kind: "$category.kind", type: "$type" }, amount: { $sum: "$amount" } } },
      { $sort: { amount: -1 } },
    ])
    .toArray();
  // Uma "sobra de caixa" é receita; uma devolução de despesa (entrada em categoria de despesa) reduz a despesa
  const expensesMap = new Map<string, number>();
  const incomeMap = new Map<string, number>();
  for (const c of cats) {
    if (c._id.kind === "despesa") expensesMap.set(c._id.name, (expensesMap.get(c._id.name) ?? 0) + (c._id.type === "saida" ? c.amount : -c.amount));
    else incomeMap.set(c._id.name, (incomeMap.get(c._id.name) ?? 0) + (c._id.type === "entrada" ? c.amount : -c.amount));
  }
  const expensesByCategory = [...expensesMap].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const incomeByCategory = [...incomeMap].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

  const lossRows = await col
    .movements(db)
    .aggregate<{ _id: string; amount: number }>([
      { $match: { at: { $gte: start, $lt: end }, type: { $in: LOSS_MOVEMENTS }, ...storeMatch(actor, "storeId", scope.storeId) } },
      { $group: { _id: "$type", amount: { $sum: { $multiply: [{ $multiply: ["$qty", -1] }, "$unitCost"] } } } },
    ])
    .toArray();

  const grossSales = s?.subtotal ?? 0;
  const discounts = s?.discount ?? 0;
  const refunds = s?.refunded ?? 0;
  const revenue = (s?.total ?? 0) - refunds;
  const cogs = Math.round((s?.cost ?? 0) - (s?.returnedCost ?? 0));
  const grossProfit = revenue - cogs;
  const otherIncome = incomeByCategory.reduce((a, c) => a + c.amount, 0);
  const expenses = expensesByCategory.reduce((a, c) => a + c.amount, 0);
  const losses = Math.round(lossRows.reduce((a, r) => a + r.amount, 0));
  return {
    revenue,
    grossSales,
    discounts,
    refunds,
    cogs,
    grossProfit,
    margin: revenue ? (grossProfit / revenue) * 100 : 0,
    otherIncome,
    expenses,
    losses,
    netProfit: grossProfit + otherIncome - expenses - losses,
    salesCount: s?.n ?? 0,
    expensesByCategory,
    incomeByCategory,
    lossesByType: lossRows.map((r) => ({ type: r._id, amount: Math.round(r.amount) })),
  };
}

export type CashFlowReport = {
  totalIn: number;
  totalOut: number;
  net: number;
  byKind: { kind: CategoryKind; type: "entrada" | "saida"; amount: number }[];
  byDay: { day: string; in: number; out: number }[];
};

export async function cashFlowReport(db: Db, actor: Actor, scope: ReportScope): Promise<CashFlowReport> {
  const { start, end } = rangeOf(scope.from, scope.to);
  const match = { at: { $gte: start, $lt: end }, ...notVoided, ...cashStoreMatch(actor, scope.storeId) };
  const byKindRaw = await col
    .cashbook(db)
    .aggregate<{ _id: { kind: CategoryKind; type: "entrada" | "saida" }; amount: number }>([
      // Transferências entre contas não são dinheiro novo, só mudam de sítio
      { $match: { ...match, "category.kind": { $ne: "transferencia" } } },
      { $group: { _id: { kind: "$category.kind", type: "$type" }, amount: { $sum: "$amount" } } },
    ])
    .toArray();
  const byDayRaw = await col
    .cashbook(db)
    .aggregate<{ _id: { day: string; type: string }; amount: number }>([
      { $match: { ...match, "category.kind": { $ne: "transferencia" } } },
      { $group: { _id: { day: "$day", type: "$type" }, amount: { $sum: "$amount" } } },
    ])
    .toArray();
  const dayMap = new Map<string, { in: number; out: number }>();
  for (let d = scope.from; d <= scope.to; d = addDays(d, 1)) dayMap.set(d, { in: 0, out: 0 });
  for (const r of byDayRaw) {
    const e = dayMap.get(r._id.day);
    if (e) e[r._id.type === "entrada" ? "in" : "out"] += r.amount;
  }
  const byKind = byKindRaw.map((r) => ({ kind: r._id.kind, type: r._id.type, amount: r.amount })).sort((a, b) => b.amount - a.amount);
  const totalIn = byKind.filter((k) => k.type === "entrada").reduce((a, k) => a + k.amount, 0);
  const totalOut = byKind.filter((k) => k.type === "saida").reduce((a, k) => a + k.amount, 0);
  return { totalIn, totalOut, net: totalIn - totalOut, byKind, byDay: [...dayMap].map(([day, v]) => ({ day, ...v })) };
}

export type SalesBreakdown = {
  byDay: { day: string; revenue: number; profit: number; count: number }[];
  byStore: { storeId: string; revenue: number; profit: number; count: number }[];
  bySeller: { name: string; revenue: number; count: number }[];
  byMethod: { method: PaymentMethod; amount: number }[];
  topProducts: { name: string; qty: number; revenue: number; profit: number }[];
};

export async function salesBreakdown(db: Db, actor: Actor, scope: ReportScope, opts: { onlySeller?: ObjectId } = {}): Promise<SalesBreakdown> {
  const { start, end } = rangeOf(scope.from, scope.to);
  const match: Record<string, unknown> = { createdAt: { $gte: start, $lt: end }, status: "concluida", ...storeMatch(actor, "storeId", scope.storeId) };
  if (opts.onlySeller) match["seller.id"] = opts.onlySeller;
  const netRev = { $subtract: ["$total", "$refunded"] };
  const netProfit = { $subtract: [{ $subtract: ["$total", "$refunded"] }, { $subtract: ["$cost", "$returnedCost"] }] };
  const [res] = await col
    .sales(db)
    .aggregate<{
      byDay: { _id: string; revenue: number; profit: number; count: number }[];
      byStore: { _id: ObjectId; revenue: number; profit: number; count: number }[];
      bySeller: { _id: string; revenue: number; count: number }[];
      byMethod: { _id: PaymentMethod; amount: number }[];
      topProducts: { _id: string; qty: number; revenue: number; profit: number }[];
    }>([
      { $match: match },
      {
        $facet: {
          byDay: [
            { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: "+01:00" } }, revenue: { $sum: netRev }, profit: { $sum: netProfit }, count: { $sum: 1 } } },
          ],
          byStore: [{ $group: { _id: "$storeId", revenue: { $sum: netRev }, profit: { $sum: netProfit }, count: { $sum: 1 } } }, { $sort: { revenue: -1 } }],
          bySeller: [{ $group: { _id: "$seller.name", revenue: { $sum: netRev }, count: { $sum: 1 } } }, { $sort: { revenue: -1 } }, { $limit: 20 }],
          byMethod: [{ $unwind: "$payments" }, { $group: { _id: "$payments.method", amount: { $sum: "$payments.amount" } } }, { $sort: { amount: -1 } }],
          topProducts: [
            { $unwind: "$lines" },
            {
              $project: {
                name: "$lines.name",
                qty: { $subtract: ["$lines.qty", "$lines.returnedQty"] },
                revenue: { $multiply: [{ $divide: ["$lines.lineTotal", "$lines.qty"] }, { $subtract: ["$lines.qty", "$lines.returnedQty"] }] },
                cost: { $multiply: ["$lines.unitCost", { $subtract: ["$lines.qty", "$lines.returnedQty"] }] },
              },
            },
            { $group: { _id: "$name", qty: { $sum: "$qty" }, revenue: { $sum: "$revenue" }, profit: { $sum: { $subtract: ["$revenue", "$cost"] } } } },
            { $match: { qty: { $gt: 0 } } },
            { $sort: { revenue: -1 } },
            { $limit: 15 },
          ],
        },
      },
    ])
    .toArray();
  const dayMap = new Map(res.byDay.map((d) => [d._id, d]));
  const byDay: SalesBreakdown["byDay"] = [];
  for (let d = scope.from; d <= scope.to && byDay.length < 400; d = addDays(d, 1)) {
    const r = dayMap.get(d);
    byDay.push({ day: d, revenue: r?.revenue ?? 0, profit: Math.round(r?.profit ?? 0), count: r?.count ?? 0 });
  }
  return {
    byDay,
    byStore: res.byStore.map((r) => ({ storeId: r._id.toHexString(), revenue: r.revenue, profit: Math.round(r.profit), count: r.count })),
    bySeller: res.bySeller.map((r) => ({ name: r._id, revenue: r.revenue, count: r.count })),
    byMethod: res.byMethod.map((r) => ({ method: r._id, amount: r.amount })),
    topProducts: res.topProducts.map((r) => ({ name: r._id, qty: r.qty, revenue: Math.round(r.revenue), profit: Math.round(r.profit) })),
  };
}

/** Valor do stock por loja, ao custo médio e ao preço de venda */
export async function stockValue(db: Db, actor: Actor, storeId: ObjectId | null) {
  const rows = await col
    .stock(db)
    .aggregate<{ _id: ObjectId; units: number; cost: number; retail: number }>([
      { $match: { qty: { $gt: 0 }, ...storeMatch(actor, "storeId", storeId) } },
      { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "p" } },
      { $unwind: "$p" },
      { $addFields: { v: { $first: { $filter: { input: "$p.variants", cond: { $eq: ["$$this._id", "$variantId"] } } } } } },
      {
        $group: {
          _id: "$storeId",
          units: { $sum: "$qty" },
          cost: { $sum: { $multiply: ["$qty", "$v.avgCost"] } },
          retail: {
            $sum: {
              $multiply: [
                "$qty",
                {
                  $ifNull: [
                    {
                      $first: {
                        $map: {
                          input: { $filter: { input: { $objectToArray: { $ifNull: ["$v.storePrices", {}] } }, cond: { $eq: ["$$this.k", { $toString: "$storeId" }] } } },
                          in: "$$this.v",
                        },
                      },
                    },
                    "$v.price",
                  ],
                },
              ],
            },
          },
        },
      },
    ])
    .toArray();
  return rows.map((r) => ({ storeId: r._id.toHexString(), units: r.units, cost: Math.round(r.cost), retail: Math.round(r.retail) }));
}

export type LiveStats = {
  day: string;
  revenue: number;
  count: number;
  avgTicket: number;
  profit: number;
  yesterdayRevenue: number;
  byStore: { storeId: string; revenue: number; count: number }[];
  byHour: { hour: number; revenue: number }[];
  latest: { id: string; number: string; storeId: string; seller: string; total: number; at: string; items: number }[];
  updatedAt: string;
};

/** Números do dia para o painel (atualizado de 15 em 15 segundos) */
export async function liveStats(db: Db, actor: Actor, storeId: ObjectId | null): Promise<LiveStats> {
  const day = luandaDay();
  const { start, end } = dayRange(day);
  const yesterday = dayRange(addDays(day, -1));
  const scope = storeMatch(actor, "storeId", storeId);
  const nowMs = Date.now();
  const [today] = await col
    .sales(db)
    .aggregate<{
      totals: { revenue: number; cost: number; count: number }[];
      byStore: { _id: ObjectId; revenue: number; count: number }[];
      byHour: { _id: number; revenue: number }[];
    }>([
      { $match: { createdAt: { $gte: start, $lt: end }, status: "concluida", ...scope } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                revenue: { $sum: { $subtract: ["$total", "$refunded"] } },
                cost: { $sum: { $subtract: ["$cost", "$returnedCost"] } },
                count: { $sum: 1 },
              },
            },
          ],
          byStore: [{ $group: { _id: "$storeId", revenue: { $sum: { $subtract: ["$total", "$refunded"] } }, count: { $sum: 1 } } }],
          byHour: [{ $group: { _id: { $hour: { date: "$createdAt", timezone: "+01:00" } }, revenue: { $sum: { $subtract: ["$total", "$refunded"] } } } }],
        },
      },
    ])
    .toArray();
  // Ontem até à mesma hora, para comparar de forma justa
  const [y] = await col
    .sales(db)
    .aggregate<{ revenue: number }>([
      { $match: { createdAt: { $gte: yesterday.start, $lt: new Date(nowMs - 86_400_000) }, status: "concluida", ...scope } },
      { $group: { _id: null, revenue: { $sum: { $subtract: ["$total", "$refunded"] } } } },
    ])
    .toArray();
  const latest = await col
    .sales(db)
    .find({ createdAt: { $gte: start, $lt: end }, ...scope })
    .sort({ createdAt: -1 })
    .limit(8)
    .project<{ _id: ObjectId; number: string; storeId: ObjectId; seller: { name: string }; total: number; createdAt: Date; lines: { qty: number }[]; status: string }>({
      number: 1,
      storeId: 1,
      seller: 1,
      total: 1,
      createdAt: 1,
      lines: 1,
      status: 1,
    })
    .toArray();
  const t = today.totals[0];
  const hours = new Map(today.byHour.map((h) => [h._id, h.revenue]));
  return {
    day,
    revenue: t?.revenue ?? 0,
    count: t?.count ?? 0,
    avgTicket: t?.count ? Math.round(t.revenue / t.count) : 0,
    profit: Math.round((t?.revenue ?? 0) - (t?.cost ?? 0)),
    yesterdayRevenue: y?.revenue ?? 0,
    byStore: today.byStore.map((s) => ({ storeId: s._id.toHexString(), revenue: s.revenue, count: s.count })),
    byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: hours.get(hour) ?? 0 })),
    latest: latest
      .filter((l) => l.status === "concluida")
      .map((l) => ({
        id: l._id.toHexString(),
        number: l.number,
        storeId: l.storeId.toHexString(),
        seller: l.seller.name,
        total: l.total,
        at: l.createdAt.toISOString(),
        items: l.lines.reduce((s, x) => s + x.qty, 0),
      })),
    updatedAt: new Date(nowMs).toISOString(),
  };
}
