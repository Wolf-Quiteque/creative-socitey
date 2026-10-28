// Teste de fumo das regras de negócio, numa base de dados descartável.
// Corre com: npm run smoke
process.env.MONGODB_DB = "creative_society_test";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { col, ensureIndexes, getClient, getDb } from "../lib/db";
import { loadActor, type Actor } from "../lib/actor";
import { seedBase } from "../lib/seed";
import { saveStore } from "../lib/domain/stores";
import { saveProduct } from "../lib/domain/catalog";
import { savePurchase, receivePurchase, payPurchase, saveSupplier } from "../lib/domain/purchases";
import { sendTransfer, receiveTransfer, createSaida } from "../lib/domain/stock";
import { createSale, voidSale, returnSale, openTill, closeTill } from "../lib/domain/sales";
import { createEntry } from "../lib/domain/finance";
import { profitReport, cashFlowReport, stockValue } from "../lib/domain/reports";
import { saveUser, saveRole } from "../lib/domain/team";
import { saveShift, markAttendance } from "../lib/domain/hr";
import { addDays, luandaDay } from "../lib/time";

let passed = 0;
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}
async function rejects(fn: () => Promise<unknown>, match: RegExp) {
  await assert.rejects(fn, (e: Error) => {
    assert.match(e.message, match);
    return true;
  });
}

async function main() {
  const db = await getDb();
  await db.dropDatabase();
  await ensureIndexes(db);
  await seedBase(db);
  const ownerDoc = (await col.users(db).findOne({ isOwner: true }))!;
  const owner = (await loadActor(db, ownerDoc._id))!;
  const bank = (await col.accounts(db).findOne({ type: "banco" }))!;

  const storeInput = (name: string, code: string) => ({ name, code, allowNegativeStock: false, requireOpenTill: true, bankAccountId: bank._id.toHexString(), active: true });
  const A = (await saveStore(db, owner, null, storeInput("Loja Talatona", "TAL"))).id;
  const B = (await saveStore(db, owner, null, storeInput("Loja Kilamba", "KIL"))).id;
  const cat = (await col.categories(db).findOne({ name: "Perucas" }))!;

  const wig = await saveProduct(db, owner, null, {
    name: "Peruca Lace Frontal",
    categoryId: cat._id.toHexString(),
    hasVariants: true,
    variants: [
      { sku: "PLF-18", label: '18" · Preto natural', price: 85000, minQty: 2 },
      { sku: "PLF-22", label: '22" · Preto natural', price: 95000, minQty: 2 },
    ],
  });
  const beauty = await saveProduct(db, owner, null, {
    name: "Óleo de argão",
    hasVariants: false,
    variants: [{ sku: "OLEO-ARG", label: "", price: 5000, cost: 2000, initialStock: [{ storeId: A, qty: 10 }] }],
  });
  const wigDoc = (await col.products(db).findOne({ _id: new ObjectId(wig.id) }))!;
  const V1 = wigDoc.variants[0]._id.toHexString();
  const V2 = wigDoc.variants[1]._id.toHexString();
  const OIL = (await col.products(db).findOne({ name: "Óleo de argão" }))!.variants[0]._id.toHexString();
  const qty = async (store: string, variant: string) => (await col.stock(db).findOne({ storeId: new ObjectId(store), variantId: new ObjectId(variant) }))?.qty ?? 0;
  const avg = async (variant: string) => (await col.products(db).findOne({ "variants._id": new ObjectId(variant) }))!.variants.find((v) => v._id.toHexString() === variant)!.avgCost;
  void beauty;

  console.log("Compras e custo de chegada");
  await step("compra em USD com transporte e alfândega dá o custo de chegada certo", async () => {
    const sup = await saveSupplier(db, owner, null, { name: "Hair Factory Guangzhou", country: "China" });
    const p = await savePurchase(db, owner, null, {
      supplierId: sup.id,
      storeId: A,
      currency: "USD",
      rate: 900,
      lines: [
        { variantId: V1, qty: 10, unitCostForeign: 50 },
        { variantId: V2, qty: 5, unitCostForeign: 60 },
      ],
      extraCosts: [
        { kind: "transporte", amount: 72000 },
        { kind: "alfandega", amount: 36000 },
      ],
      allocation: "valor",
    });
    const doc = (await col.purchases(db).findOne({ number: p.number }))!;
    assert.equal(doc.goodsTotal, 720000);
    assert.equal(doc.extraTotal, 108000);
    assert.equal(doc.total, 828000);
    assert.equal(doc.lines[0].landedUnitCost, 51750);
    assert.equal(doc.lines[1].landedUnitCost, 62100);
    await receivePurchase(db, owner, p.id);
    assert.equal(await qty(A, V1), 10);
    assert.equal(await qty(A, V2), 5);
    assert.equal(await avg(V1), 51750);
    await payPurchase(db, owner, p.id, { amount: 500000, accountId: bank._id.toHexString(), method: "transferencia" });
    await rejects(() => payPurchase(db, owner, p.id, { amount: 400000, accountId: bank._id.toHexString(), method: "transferencia" }), /Falta pagar apenas/);
  });

  await step("segunda compra atualiza o custo médio ponderado", async () => {
    const p = await savePurchase(db, owner, null, { storeId: A, currency: "AOA", rate: 1, lines: [{ variantId: V1, qty: 10, unitCostForeign: 60000 }], extraCosts: [], allocation: "valor" });
    await receivePurchase(db, owner, p.id);
    assert.equal(await avg(V1), 55875);
    await rejects(() => receivePurchase(db, owner, p.id), /já deu entrada/);
  });

  console.log("Transferências");
  let trfId = "";
  await step("transferir 5 e receber 4: origem −5, destino +4, 1 registado como perda", async () => {
    const t = await sendTransfer(db, owner, { fromStoreId: A, toStoreId: B, lines: [{ variantId: V1, qty: 5 }] });
    trfId = t.id;
    assert.equal(await qty(A, V1), 15);
    assert.equal(await qty(B, V1), 0);
    const r = await receiveTransfer(db, owner, { docId: t.id, lines: [{ variantId: V1, qtyReceived: 4, note: "Uma chegou molhada" }] });
    assert.equal(r.status, "recebida_com_diferencas");
    assert.equal(await qty(B, V1), 4);
    const loss = await col.movements(db).findOne({ type: "perda_transito" });
    assert.equal(loss?.qty, -1);
    await rejects(() => receiveTransfer(db, owner, { docId: t.id, lines: [] }), /já foi recebida/);
  });
  void trfId;

  console.log("Ponto de venda");
  const req1 = randomUUID();
  let sale1 = "";
  await step("não vende com a caixa fechada", async () => {
    await rejects(() => createSale(db, owner, { storeId: A, clientRequestId: randomUUID(), lines: [{ variantId: OIL, qty: 1 }], payments: [{ method: "dinheiro", amount: 5000 }] }), /caixa está fechada/);
  });
  let tillId = "";
  await step("venda com desconto, pagamento misto e troco", async () => {
    tillId = (await openTill(db, owner, A, 10000)).id;
    const s = await createSale(db, owner, {
      storeId: A,
      clientRequestId: req1,
      lines: [
        { variantId: V1, qty: 2 },
        { variantId: OIL, qty: 1 },
      ],
      discount: { type: "pct", value: 10 },
      payments: [
        { method: "tpa", amount: 100000 },
        { method: "dinheiro", amount: 60000 },
      ],
    });
    sale1 = s.id;
    const doc = (await col.sales(db).findOne({ number: s.number }))!;
    assert.equal(doc.subtotal, 175000);
    assert.equal(doc.discount, 17500);
    assert.equal(doc.total, 157500);
    assert.equal(doc.change, 2500);
    assert.equal(doc.cost, 2 * 55875 + 2000);
    assert.deepEqual(doc.lines.map((l) => l.lineTotal), [153000, 4500]);
    assert.equal(await qty(A, V1), 13);
    assert.equal(await qty(A, OIL), 9);
    const entries = await col.cashbook(db).find({ "ref.id": doc._id }).toArray();
    assert.equal(entries.reduce((a, e) => a + e.amount, 0), 157500);
  });
  await step("o mesmo pedido repetido não cria segunda venda", async () => {
    const again = await createSale(db, owner, { storeId: A, clientRequestId: req1, lines: [{ variantId: V1, qty: 2 }], payments: [{ method: "dinheiro", amount: 999999 }] });
    assert.equal(again.duplicate, true);
    assert.equal(await col.sales(db).countDocuments(), 1);
  });
  await step("não deixa vender mais do que há em stock", async () => {
    await rejects(() => createSale(db, owner, { storeId: A, clientRequestId: randomUUID(), lines: [{ variantId: V2, qty: 6 }], payments: [{ method: "tpa", amount: 570000 }] }), /só restam 5/);
    assert.equal(await qty(A, V2), 5);
  });
  await step("pagamento insuficiente é recusado", async () => {
    await rejects(() => createSale(db, owner, { storeId: A, clientRequestId: randomUUID(), lines: [{ variantId: OIL, qty: 1 }], payments: [{ method: "dinheiro", amount: 4000 }] }), /Falta receber/);
  });
  await step("anular uma venda repõe o stock e o dinheiro", async () => {
    const s = await createSale(db, owner, { storeId: A, clientRequestId: randomUUID(), lines: [{ variantId: OIL, qty: 2 }], payments: [{ method: "dinheiro", amount: 10000 }] });
    assert.equal(await qty(A, OIL), 7);
    await voidSale(db, owner, s.id, "Cliente desistiu");
    assert.equal(await qty(A, OIL), 9);
    const out = await col.cashbook(db).findOne({ source: "anulacao" });
    assert.equal(out?.amount, 10000);
  });
  await step("devolução parcial reembolsa o valor com desconto", async () => {
    const r = await returnSale(db, owner, { saleId: sale1, lines: [{ variantId: V1, qty: 1 }], method: "tpa", reason: "Tamanho errado" });
    assert.equal(r.amount, 76500);
    assert.equal(await qty(A, V1), 14);
  });

  console.log("Despesas, perdas e fecho de caixa");
  await step("despesa e nota de saída", async () => {
    const caixa = (await col.stores(db).findOne({ code: "TAL" }))!.cashAccountId!;
    const agua = (await col.finCategories(db).findOne({ name: "Água e alimentação da equipa" }))!;
    await createEntry(db, owner, { type: "saida", amount: 3000, categoryId: agua._id.toHexString(), accountId: caixa.toHexString(), description: "Água para a equipa" });
    await createSaida(db, owner, { storeId: A, reason: "quebra", lines: [{ variantId: OIL, qty: 1 }] });
    assert.equal(await qty(A, OIL), 8);
  });
  await step("fecho de caixa calcula o esperado e regista a falta", async () => {
    // 10.000 fundo + 57.500 (venda 1) + 10.000 (venda 2) − 10.000 (anulação) − 3.000 (água) = 64.500
    const r = await closeTill(db, owner, tillId, 64000);
    assert.equal(r.expectedCash, 64500);
    assert.equal(r.difference, -500);
  });
  await step("relatório de lucros bate com o cálculo à mão", async () => {
    const day = luandaDay();
    const p = await profitReport(db, owner, { from: day, to: day, storeId: null });
    assert.equal(p.revenue, 157500 - 76500);
    assert.equal(p.cogs, 2 * 55875 + 2000 - 55875);
    assert.equal(p.grossProfit, 81000 - 57875);
    assert.equal(p.expenses, 3000 + 500);
    assert.equal(p.losses, 55875 + 2000);
    assert.equal(p.netProfit, 23125 - 3500 - 57875);
    const cf = await cashFlowReport(db, owner, { from: day, to: day, storeId: null });
    assert.equal(cf.totalIn, 157500 + 10000);
    assert.equal(cf.totalOut, 500000 + 10000 + 76500 + 3000 + 500);
    const sv = await stockValue(db, owner, null);
    assert.ok(sv.length === 2);
  });

  console.log("Permissões");
  const roles = Object.fromEntries((await col.roles(db).find().toArray()).map((r) => [r.name, r._id.toHexString()]));
  const cashierId = (await saveUser(db, owner, null, { name: "Joana Caixa", username: "joana", phone: "923000001", roleId: roles["Caixa / Vendedor(a)"], allStores: false, storeIds: [A], extraPermissions: [], removedPermissions: [], pin: "1234" })).id;
  const managerId = (await saveUser(db, owner, null, { name: "Ana Gerente", username: "ana", roleId: roles["Gerente de loja"], allStores: false, storeIds: [A], extraPermissions: ["equipa.gerir"], removedPermissions: [], pin: "4321" })).id;
  const cashier = (await loadActor(db, new ObjectId(cashierId))) as Actor;
  const manager = (await loadActor(db, new ObjectId(managerId))) as Actor;
  await step("caixa não vende noutra loja nem anula vendas", async () => {
    await rejects(() => createSale(db, cashier, { storeId: B, clientRequestId: randomUUID(), lines: [{ variantId: V1, qty: 1 }], payments: [{ method: "dinheiro", amount: 85000 }] }), /acesso a esta loja/);
    await rejects(() => voidSale(db, cashier, sale1, "teste de permissão"), /Sem permissão/);
    await rejects(() => saveRole(db, cashier, null, { name: "X", color: "#000000", permissions: [], maxDiscountPct: 0 }), /Sem permissão/);
  });
  await step("caixa não pode dar desconto acima do cargo", async () => {
    await openTill(db, owner, A, 0);
    await rejects(
      () => createSale(db, cashier, { storeId: A, clientRequestId: randomUUID(), lines: [{ variantId: OIL, qty: 1 }], discount: { type: "pct", value: 20 }, payments: [{ method: "dinheiro", amount: 5000 }] }),
      /desconto/,
    );
  });
  await step("ninguém dá permissões que não tem", async () => {
    await rejects(
      () => saveUser(db, manager, null, { name: "Intruso", username: "intruso", roleId: roles["Administrador"], allStores: false, storeIds: [A], extraPermissions: [], removedPermissions: [], pin: "1111" }),
      /permissões que não tem/,
    );
    await rejects(
      () => saveUser(db, manager, null, { name: "Outra", username: "outra", roleId: roles["Caixa / Vendedor(a)"], allStores: true, storeIds: [], extraPermissions: [], removedPermissions: [], pin: "1111" }),
      /todas as lojas/,
    );
  });

  console.log("Presenças");
  await step("chegada depois da tolerância fica como atrasado", async () => {
    const yesterday = addDays(luandaDay(), -1);
    await saveShift(db, owner, { userId: cashierId, storeId: A, day: yesterday, start: "09:00", end: "17:00" });
    const r = await markAttendance(db, owner, { userId: cashierId, storeId: A, day: yesterday, action: "chegou", time: "09:25" });
    assert.equal(r.status, "atrasado");
    const a = await col.attendance(db).findOne({ day: yesterday });
    assert.equal(a?.lateMinutes, 25);
    await rejects(() => markAttendance(db, manager, { userId: cashierId, storeId: A, day: yesterday, action: "falta" }), /Corrigir presenças/);
  });

  console.log(`\n${passed} verificações passaram.`);
  await db.dropDatabase();
}

main()
  .catch(async (err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => (await getClient()).close());
