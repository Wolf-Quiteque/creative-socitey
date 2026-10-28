// Cálculos puros de custo (usados no servidor e na pré-visualização do formulário de compras)

const r2 = (n: number) => Math.round(n * 100) / 100;

export type CostLineIn = { qty: number; unitCostForeign: number };

/**
 * Custo de chegada por unidade: preço do fornecedor convertido em Kz + parte dos custos extra
 * (transporte, alfândega…), repartidos pelo valor de cada linha ou pela quantidade.
 */
export function allocateLandedCost(lines: CostLineIn[], rate: number, extraTotal: number, allocation: "valor" | "quantidade") {
  const kz = lines.map((l) => r2(l.unitCostForeign * rate));
  const goodsTotal = r2(lines.reduce((s, l, i) => s + l.qty * kz[i], 0));
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const byValue = allocation === "valor" && goodsTotal > 0;
  const landed = lines.map((l, i) => {
    if (!l.qty) return kz[i];
    const share = byValue ? (l.qty * kz[i] * extraTotal) / goodsTotal : totalQty ? (l.qty * extraTotal) / totalQty : 0;
    return r2(kz[i] + share / l.qty);
  });
  return { unitCostKz: kz, landed, goodsTotal: Math.round(goodsTotal), total: Math.round(goodsTotal + extraTotal) };
}

/** Novo custo médio ponderado depois de entrar `qty` unidades a `cost` */
export function weightedAverage(onHand: number, avgCost: number, qty: number, cost: number): number {
  const q0 = Math.max(0, onHand);
  if (q0 + qty <= 0) return cost;
  return r2((q0 * avgCost + qty * cost) / (q0 + qty));
}
