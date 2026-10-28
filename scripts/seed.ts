// npm run seed       → dono, cargos, categorias e conta bancária (pode correr várias vezes)
// npm run seed:demo  → também lojas, produtos, compras, vendas de 2 semanas, horários e presenças (só numa BD vazia)
import { ObjectId, type Db } from "mongodb";
import { col, getClient, getDb, dbName, type AttendanceDoc } from "../lib/db";
import { loadActor, type Actor } from "../lib/actor";
import { seedBase } from "../lib/seed";
import { saveStore } from "../lib/domain/stores";
import { saveProduct } from "../lib/domain/catalog";
import { savePurchase, receivePurchase, payPurchase, saveSupplier } from "../lib/domain/purchases";
import { sendTransfer, receiveTransfer, createSaida } from "../lib/domain/stock";
import { createSale, voidSale, openTill } from "../lib/domain/sales";
import { createEntry } from "../lib/domain/finance";
import { saveUser } from "../lib/domain/team";
import { saveTemplate, applyTemplates } from "../lib/domain/hr";
import { addDays, luandaDay, luandaInstant, luandaMinutes, startOfWeek, weekday } from "../lib/time";

const demo = process.argv.includes("--demo");

// Números pseudoaleatórios repetíveis (a demo sai sempre igual)
let seed = 20261028;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

/** Recua no tempo uma venda e tudo o que ela gerou (movimentos de stock e de dinheiro) */
async function backdate(db: Db, saleId: string, at: Date) {
  const id = new ObjectId(saleId);
  await col.sales(db).updateOne({ _id: id }, { $set: { createdAt: at } });
  await col.cashbook(db).updateMany({ "ref.id": id }, { $set: { at, createdAt: at, day: luandaDay(at) } });
  await col.movements(db).updateMany({ "ref.id": id }, { $set: { at } });
}

async function runDemo(db: Db, owner: Actor) {
  if (await col.stores(db).countDocuments()) {
    console.log("Já existem lojas nesta base de dados — a demo não foi criada (só corre numa base vazia).");
    return;
  }
  const bank = (await col.accounts(db).findOne({ type: "banco" }))!;
  const bankId = bank._id.toHexString();
  const storeBase = { allowNegativeStock: false, requireOpenTill: false, bankAccountId: bankId, active: true };
  const TAL = (await saveStore(db, owner, null, { ...storeBase, name: "Loja Talatona", code: "TAL", city: "Luanda — Talatona", address: "Rua do Talatona, Shopping Avenida", phone: "923 000 100" })).id;
  const KIL = (await saveStore(db, owner, null, { ...storeBase, name: "Loja Kilamba", code: "KIL", city: "Luanda — Kilamba", address: "Centralidade do Kilamba, Bloco Q", phone: "923 000 200" })).id;
  console.log("Lojas: Talatona e Kilamba.");

  const cats = Object.fromEntries((await col.categories(db).find().toArray()).map((c) => [c.name, c._id.toHexString()]));
  const wig = (lengthIn: number, color = "Preto natural", extra: Record<string, string> = {}) => ({ hairType: "humano" as const, lengthIn, color, ...extra });
  const products: { name: string; brand?: string; cat: string; variants: { sku: string; label: string; price: number; minQty?: number; attrs?: object; usd?: number; kz?: number }[] }[] = [
    {
      name: "Peruca Lace Frontal Lisa",
      brand: "Creative Hair",
      cat: "Perucas",
      variants: [
        { sku: "PLF-16", label: '16" · Preto natural', price: 85000, usd: 42, minQty: 2, attrs: wig(16, "Preto natural", { texture: "Liso", lace: "Frontal 13x4", density: "180%" }) },
        { sku: "PLF-20", label: '20" · Preto natural', price: 110000, usd: 55, minQty: 2, attrs: wig(20, "Preto natural", { texture: "Liso", lace: "Frontal 13x4", density: "180%" }) },
        { sku: "PLF-24", label: '24" · Preto natural', price: 140000, usd: 70, minQty: 1, attrs: wig(24, "Preto natural", { texture: "Liso", lace: "Frontal 13x4", density: "180%" }) },
      ],
    },
    {
      name: "Peruca Body Wave HD Lace",
      brand: "Creative Hair",
      cat: "Perucas",
      variants: [
        { sku: "PBW-18", label: '18" · Preto natural', price: 120000, usd: 60, minQty: 2, attrs: wig(18, "Preto natural", { texture: "Ondulado (body wave)", lace: "HD lace", density: "200%" }) },
        { sku: "PBW-22", label: '22" · Preto natural', price: 150000, usd: 76, minQty: 1, attrs: wig(22, "Preto natural", { texture: "Ondulado (body wave)", lace: "HD lace", density: "200%" }) },
        { sku: "PBW-22M", label: '22" · Castanho mel', price: 158000, usd: 80, minQty: 1, attrs: wig(22, "Castanho mel", { texture: "Ondulado (body wave)", lace: "HD lace", density: "200%" }) },
      ],
    },
    {
      name: "Peruca Cacheada 360",
      brand: "Creative Hair",
      cat: "Perucas",
      variants: [{ sku: "PC360-20", label: '20" · Preto natural', price: 165000, usd: 85, minQty: 1, attrs: wig(20, "Preto natural", { texture: "Cacheado", lace: "360 lace", density: "180%" }) }],
    },
    { name: "Peruca Bob Curta", cat: "Perucas", variants: [{ sku: "PBOB", label: "", price: 25000, kz: 9500, minQty: 3, attrs: { hairType: "sintetico", texture: "Liso", lengthIn: 10 } }] },
    {
      name: "Cabelo humano liso (100 g)",
      cat: "Extensões e tranças",
      variants: [
        { sku: "CHL-14", label: '14"', price: 35000, usd: 16, minQty: 4, attrs: wig(14, "Preto natural", { texture: "Liso" }) },
        { sku: "CHL-18", label: '18"', price: 45000, usd: 21, minQty: 4, attrs: wig(18, "Preto natural", { texture: "Liso" }) },
        { sku: "CHL-22", label: '22"', price: 58000, usd: 27, minQty: 3, attrs: wig(22, "Preto natural", { texture: "Liso" }) },
      ],
    },
    { name: "Tranças Kanekalon (pacote)", cat: "Extensões e tranças", variants: [{ sku: "KANEK", label: "", price: 2500, kz: 900, minQty: 20 }] },
    { name: "Óleo de argão 100 ml", cat: "Cuidados do cabelo", variants: [{ sku: "OLEO-ARG", label: "", price: 6500, kz: 2800, minQty: 6 }] },
    { name: "Cola para lace Bold Hold", cat: "Cuidados do cabelo", variants: [{ sku: "COLA-BH", label: "", price: 12000, kz: 5500, minQty: 5 }] },
    { name: "Spray fixador de lace", cat: "Cuidados do cabelo", variants: [{ sku: "SPRAY-FIX", label: "", price: 8500, kz: 3600, minQty: 5 }] },
    { name: "Shampoo hidratante 500 ml", cat: "Cuidados do cabelo", variants: [{ sku: "SHAMP-500", label: "", price: 7000, kz: 3100, minQty: 6 }] },
    { name: "Touca de cetim", cat: "Acessórios", variants: [{ sku: "TOUCA", label: "", price: 3500, kz: 1200, minQty: 10 }] },
    {
      name: "Base líquida matte",
      brand: "Glow",
      cat: "Maquilhagem",
      variants: [
        { sku: "BASE-01", label: "Tom 01 · Caramelo", price: 9000, kz: 4200, minQty: 3 },
        { sku: "BASE-02", label: "Tom 02 · Canela", price: 9000, kz: 4200, minQty: 3 },
        { sku: "BASE-03", label: "Tom 03 · Cacau", price: 9000, kz: 4200, minQty: 3 },
      ],
    },
    {
      name: "Batom matte",
      brand: "Glow",
      cat: "Maquilhagem",
      variants: [
        { sku: "BAT-NUDE", label: "Nude", price: 4500, kz: 1800, minQty: 4 },
        { sku: "BAT-VERM", label: "Vermelho", price: 4500, kz: 1800, minQty: 4 },
        { sku: "BAT-VINHO", label: "Vinho", price: 4500, kz: 1800, minQty: 4 },
      ],
    },
    { name: "Pestanas postiças 3D", cat: "Maquilhagem", variants: [{ sku: "PEST-3D", label: "", price: 3000, kz: 1100, minQty: 8 }] },
    { name: "Kit unhas de gel", cat: "Unhas", variants: [{ sku: "KIT-GEL", label: "", price: 15000, kz: 7200, minQty: 2 }] },
  ];

  const variantIds: Record<string, string> = {};
  const prices: Record<string, number> = {};
  for (const p of products) {
    const r = await saveProduct(db, owner, null, {
      name: p.name,
      brand: p.brand,
      categoryId: cats[p.cat],
      hasVariants: p.variants.length > 1 || !!p.variants[0].label,
      variants: p.variants.map((v) => ({ sku: v.sku, label: v.label, price: v.price, minQty: v.minQty ?? 0, attrs: v.attrs })),
    });
    const doc = (await col.products(db).findOne({ _id: new ObjectId(r.id) }))!;
    for (const v of doc.variants) {
      variantIds[v.sku] = v._id.toHexString();
      prices[v.sku] = v.price;
    }
  }
  console.log(`${products.length} produtos criados.`);

  // Compras: cabelo da China em USD (com transporte e alfândega) e cosméticos de um distribuidor local
  const china = (await saveSupplier(db, owner, null, { name: "Hair Factory Guangzhou", country: "China", contact: "Lily Chen", phone: "+86 138 0000 0000" })).id;
  const local = (await saveSupplier(db, owner, null, { name: "Distribuidora Beleza Luanda", country: "Angola", phone: "923 111 222" })).id;
  const all = products.flatMap((p) => p.variants);
  const hair = all.filter((v) => v.usd);
  const beauty = all.filter((v) => v.kz);
  const p1 = await savePurchase(db, owner, null, {
    supplierId: china,
    storeId: TAL,
    currency: "USD",
    rate: 920,
    lines: hair.map((v) => ({ variantId: variantIds[v.sku], qty: v.price > 100000 ? 12 : 18, unitCostForeign: v.usd! })),
    extraCosts: [
      { kind: "transporte", description: "Frete aéreo Guangzhou → Luanda", amount: 380000 },
      { kind: "alfandega", description: "Desalfandegamento", amount: 420000 },
      { kind: "taxas", description: "Despachante", amount: 60000 },
    ],
    allocation: "valor",
    invoiceRef: "HFG-2026-118",
  });
  await receivePurchase(db, owner, p1.id);
  const p1doc = (await col.purchases(db).findOne({ _id: new ObjectId(p1.id) }))!;
  await payPurchase(db, owner, p1.id, { amount: Math.round(p1doc.total * 0.7), accountId: bankId, method: "transferencia", note: "Primeira prestação" });
  const p2 = await savePurchase(db, owner, null, {
    supplierId: local,
    storeId: TAL,
    currency: "AOA",
    rate: 1,
    lines: beauty.map((v) => ({ variantId: variantIds[v.sku], qty: v.price < 5000 ? 80 : 40, unitCostForeign: v.kz! })),
    extraCosts: [{ kind: "transporte", description: "Entrega", amount: 15000 }],
    allocation: "quantidade",
  });
  await receivePurchase(db, owner, p2.id);
  const p2doc = (await col.purchases(db).findOne({ _id: new ObjectId(p2.id) }))!;
  await payPurchase(db, owner, p2.id, { amount: p2doc.total, accountId: bankId, method: "transferencia" });
  console.log("Compras recebidas e pagas (uma com 30% por pagar).");

  // Metade da mercadoria vai para o Kilamba; uma transferência fica a caminho
  const t1 = await sendTransfer(db, owner, {
    fromStoreId: TAL,
    toStoreId: KIL,
    lines: all.map((v) => ({ variantId: variantIds[v.sku], qty: v.usd ? (v.price > 100000 ? 5 : 8) : v.price < 5000 ? 35 : 18 })),
    transportCost: 8000,
    transportAccountId: bankId,
  });
  await receiveTransfer(db, owner, { docId: t1.id, lines: [{ variantId: variantIds["OLEO-ARG"], qtyReceived: 17, note: "Um frasco partido" }] });
  await sendTransfer(db, owner, { fromStoreId: TAL, toStoreId: KIL, lines: [{ variantId: variantIds["PLF-20"], qty: 2 }, { variantId: variantIds["COLA-BH"], qty: 4 }], note: "Pedido da gerente do Kilamba" });
  console.log("Transferências: uma recebida (com diferença), uma a caminho.");

  // Equipa
  const roles = Object.fromEntries((await col.roles(db).find().toArray()).map((r) => [r.name, r._id.toHexString()]));
  const people = [
    { name: "Ana Domingos", username: "ana", phone: "923000001", role: "Gerente de loja", stores: [TAL], job: "Gerente — Talatona" },
    { name: "Joana Manuel", username: "joana", phone: "923000002", role: "Caixa / Vendedor(a)", stores: [TAL], job: "Vendedora" },
    { name: "Luísa Pedro", username: "luisa", phone: "923000003", role: "Caixa / Vendedor(a)", stores: [TAL], job: "Vendedora" },
    { name: "Marta Kiala", username: "marta", phone: "923000004", role: "Gerente de loja", stores: [KIL], job: "Gerente — Kilamba" },
    { name: "Esperança Neto", username: "esperanca", phone: "923000005", role: "Caixa / Vendedor(a)", stores: [KIL], job: "Vendedora" },
    { name: "Rosa Lukoki", username: "rosa", phone: "923000006", role: "Supervisor(a) de RH", stores: [TAL, KIL], job: "Recursos humanos" },
    { name: "Paulo Sebastião", username: "paulo", phone: "923000007", role: "Fiel de armazém", stores: [TAL, KIL], job: "Armazém" },
  ];
  const ids: Record<string, string> = {};
  for (const p of people) {
    ids[p.username] = (
      await saveUser(db, owner, null, { name: p.name, username: p.username, phone: p.phone, roleId: roles[p.role], allStores: false, storeIds: p.stores, extraPermissions: [], removedPermissions: [], jobTitle: p.job, pin: "1234" })
    ).id;
  }
  console.log(`${people.length} pessoas criadas (PIN 1234).`);

  // Horários: modelos semanais e turnos desta semana e da próxima
  const morning = { start: "08:30", end: "16:30" };
  const late = { start: "11:00", end: "19:00" };
  const tpl = (a: typeof morning, b: typeof morning) => [null, a, a, b, b, a, { start: "09:00", end: "14:00" }];
  await saveTemplate(db, owner, { userId: ids.ana, storeId: TAL, days: tpl(morning, morning) });
  await saveTemplate(db, owner, { userId: ids.joana, storeId: TAL, days: tpl(morning, late) });
  await saveTemplate(db, owner, { userId: ids.luisa, storeId: TAL, days: tpl(late, morning) });
  await saveTemplate(db, owner, { userId: ids.marta, storeId: KIL, days: tpl(morning, morning) });
  await saveTemplate(db, owner, { userId: ids.esperanca, storeId: KIL, days: tpl(late, late) });
  await saveTemplate(db, owner, { userId: ids.paulo, storeId: TAL, days: [null, morning, morning, morning, morning, morning, null] });
  const today = luandaDay();
  const from = addDays(startOfWeek(today), -7);
  const to = addDays(startOfWeek(today), 13);
  await applyTemplates(db, owner, { storeId: TAL, from, to, overwrite: true });
  await applyTemplates(db, owner, { storeId: KIL, from, to, overwrite: true });

  // Presenças dos últimos dias (confirmadas pela Rosa)
  const rosa = (await loadActor(db, new ObjectId(ids.rosa)))!;
  const shifts = await col.shifts(db).find({ day: { $gte: addDays(today, -6), $lte: today } }).toArray();
  const nowMin = luandaMinutes();
  for (const s of shifts) {
    const [h, m] = s.start.split(":").map(Number);
    const startMin = h * 60 + m;
    if (s.day === today && nowMin < startMin + 20) continue;
    const r = rnd();
    const status: AttendanceDoc["status"] = r < 0.06 ? "falta" : r < 0.2 ? "atrasado" : "presente";
    const lateBy = status === "atrasado" ? between(12, 40) : between(-10, 5);
    const inMin = startMin + lateBy;
    const checkIn = luandaInstant(s.day, `${String(Math.floor(inMin / 60)).padStart(2, "0")}:${String(inMin % 60).padStart(2, "0")}`);
    const [eh, em] = s.end.split(":").map(Number);
    const checkOut = s.day < today ? luandaInstant(s.day, `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`) : undefined;
    const user = people.find((p) => ids[p.username] === s.userId.toHexString())!;
    await col.attendance(db).insertOne({
      _id: new ObjectId(),
      userId: s.userId,
      userName: user.name,
      storeId: s.storeId,
      day: s.day,
      status,
      scheduledStart: s.start,
      scheduledEnd: s.end,
      ...(status === "falta" ? {} : { checkIn, checkOut, lateMinutes: Math.max(0, lateBy) }),
      confirmedBy: { id: rosa.id, name: rosa.name },
      confirmedAt: checkIn,
      history: [{ at: checkIn, by: { id: rosa.id, name: rosa.name }, change: status === "falta" ? "Falta" : `Entrada (${status})` }],
    });
  }
  console.log("Horários e presenças criados.");

  // Vendas das últimas duas semanas
  const sellers: Record<string, Actor[]> = {
    [TAL]: [(await loadActor(db, new ObjectId(ids.joana)))!, (await loadActor(db, new ObjectId(ids.luisa)))!, (await loadActor(db, new ObjectId(ids.ana)))!],
    [KIL]: [(await loadActor(db, new ObjectId(ids.esperanca)))!, (await loadActor(db, new ObjectId(ids.marta)))!],
  };
  const wigSkus = hair.map((v) => v.sku);
  const smallSkus = beauty.map((v) => v.sku);
  let count = 0;
  for (let d = 13; d >= 0; d--) {
    const day = addDays(today, -d);
    if (weekday(day) === 0) continue; // domingo fechado
    for (const storeId of [TAL, KIL]) {
      const n = between(storeId === TAL ? 4 : 2, storeId === TAL ? 9 : 6);
      for (let i = 0; i < n; i++) {
        const minute = between(9 * 60, 19 * 60);
        if (d === 0 && minute > nowMin - 5) continue;
        const lines: { variantId: string; qty: number }[] = [];
        if (rnd() < 0.45) lines.push({ variantId: variantIds[pick(wigSkus)], qty: 1 });
        const smalls = between(lines.length ? 0 : 1, 3);
        for (let k = 0; k < smalls; k++) lines.push({ variantId: variantIds[pick(smallSkus)], qty: between(1, 3) });
        const seller = pick(sellers[storeId]);
        const subtotal = lines.reduce((s, l) => s + l.qty * prices[Object.keys(variantIds).find((k) => variantIds[k] === l.variantId)!], 0);
        const discountPct = rnd() < 0.15 ? Math.min(5, seller.maxDiscountPct) : 0;
        const total = subtotal - Math.round((subtotal * discountPct) / 100);
        const method = pick(["dinheiro", "dinheiro", "tpa", "tpa", "express", "transferencia"] as const);
        const paid = method === "dinheiro" ? Math.ceil(total / 1000) * 1000 : total;
        try {
          const s = await createSale(db, seller, {
            storeId,
            clientRequestId: `demo-${day}-${storeId}-${i}-${count}`,
            lines,
            discount: { type: "pct", value: discountPct },
            payments: [{ method, amount: paid }],
            customer: rnd() < 0.3 ? { name: pick(["Cláudia", "Helena", "Teresa", "Beatriz", "Nádia", "Sónia"]), phone: `92${between(1000000, 9999999)}` } : undefined,
          });
          const at = luandaInstant(day, `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`);
          await backdate(db, s.id, at);
          count++;
          if (rnd() < 0.02 && d > 0) await voidSale(db, owner, s.id, "Cliente desistiu da compra");
        } catch {
          // stock esgotado num artigo: ignora esta venda
        }
      }
    }
  }
  console.log(`${count} vendas criadas.`);

  // Despesas do período
  const catId = async (name: string) => (await col.finCategories(db).findOne({ name }))!._id.toHexString();
  const tal = (await col.stores(db).findOne({ code: "TAL" }))!;
  const kil = (await col.stores(db).findOne({ code: "KIL" }))!;
  const expenses: [number, string, string, number, string][] = [
    [12, "Renda", bankId, 350000, "Renda do mês — Talatona"],
    [12, "Renda", bankId, 280000, "Renda do mês — Kilamba"],
    [10, "Água e alimentação da equipa", tal.cashAccountId!.toHexString(), 4500, "Garrafões de água"],
    [8, "Mobiliário e equipamento", bankId, 95000, "2 cadeiras para o salão"],
    [6, "Internet e telefone", bankId, 25000, "Internet do mês"],
    [5, "Água e alimentação da equipa", kil.cashAccountId!.toHexString(), 3000, "Água para a equipa"],
    [4, "Publicidade e redes sociais", bankId, 40000, "Patrocínio Instagram"],
    [3, "Transporte e combustível", tal.cashAccountId!.toHexString(), 7500, "Táxi para entregas"],
    [2, "Limpeza e manutenção", kil.cashAccountId!.toHexString(), 6000, "Produtos de limpeza"],
    [1, "Água e alimentação da equipa", tal.cashAccountId!.toHexString(), 4500, "Garrafões de água"],
  ];
  for (const [ago, cat, acc, amount, desc] of expenses) {
    await createEntry(db, owner, { type: "saida", amount, categoryId: await catId(cat), accountId: acc, description: desc, day: addDays(today, -ago) });
  }
  await createEntry(db, owner, { type: "entrada", amount: 30000, categoryId: await catId("Serviços (instalação, penteados)"), accountId: tal.cashAccountId!.toHexString(), description: "Instalação de peruca (2 clientes)", day: addDays(today, -2) });
  await createSaida(db, owner, { storeId: TAL, reason: "quebra", lines: [{ variantId: variantIds["SPRAY-FIX"], qty: 1, note: "Caiu da prateleira" }] });
  await createSaida(db, owner, { storeId: KIL, reason: "uso_interno", lines: [{ variantId: variantIds["COLA-BH"], qty: 1, note: "Usada na montra" }] });
  console.log("Despesas, uma receita de serviços e duas notas de saída.");

  // Hoje: lojas passam a exigir caixa aberta, e as duas caixas estão abertas
  await col.stores(db).updateMany({}, { $set: { requireOpenTill: true } });
  await openTill(db, sellers[TAL][0], TAL, 20000);
  await openTill(db, sellers[KIL][0], KIL, 15000);
  await col.sales(db).updateMany({ createdAt: { $gte: luandaInstant(today) } }, { $set: { tillId: null } });
  console.log("Caixas de hoje abertas.");
}

async function main() {
  const db = await getDb();
  console.log(`Base de dados: ${dbName()}`);
  await seedBase(db, { log: (m) => console.log(m) });
  if (demo) {
    const ownerDoc = (await col.users(db).findOne({ isOwner: true }))!;
    const owner = (await loadActor(db, ownerDoc._id))!;
    await runDemo(db, owner);
  }
  console.log("Pronto.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => (await getClient()).close());
