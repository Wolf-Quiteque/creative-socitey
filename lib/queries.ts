import "server-only";
import type { Db, ObjectId } from "mongodb";
import { col } from "./db";
import { can, storeMatch, type Actor } from "./actor";
import { normalize } from "./domain/catalog";
import type { VariantAttrs } from "./types";

export type PickItem = {
  variantId: string;
  productId: string;
  name: string;
  label: string;
  sku: string;
  barcode?: string;
  price: number;
  stock: number;
  minQty: number;
  categoryId: string | null;
  imageId?: string;
  cost?: number;
  attrs?: VariantAttrs;
  search: string;
};

/** Catálogo ativo com stock da loja indicada (para o ponto de venda e formulários de stock) */
export async function pickItems(db: Db, actor: Actor, storeId: ObjectId | null, opts: { includeInactive?: boolean } = {}): Promise<PickItem[]> {
  const products = await col
    .products(db)
    .find(opts.includeInactive ? {} : { active: true })
    .sort({ name: 1 })
    .toArray();
  const stock = storeId ? await col.stock(db).find({ storeId }).project<{ variantId: ObjectId; qty: number }>({ variantId: 1, qty: 1 }).toArray() : [];
  const qty = new Map(stock.map((s) => [s.variantId.toHexString(), s.qty]));
  const showCost = can(actor, "stock.custos") || can(actor, "painel.lucros");
  const key = storeId?.toHexString();
  const out: PickItem[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      if (!v.active && !opts.includeInactive) continue;
      const id = v._id.toHexString();
      out.push({
        variantId: id,
        productId: p._id.toHexString(),
        name: p.name,
        label: v.label,
        sku: v.sku,
        barcode: v.barcode,
        price: (key && v.storePrices?.[key]) || v.price,
        stock: qty.get(id) ?? 0,
        minQty: v.minQty,
        categoryId: p.categoryId?.toHexString() ?? null,
        imageId: p.imageId?.toHexString(),
        cost: showCost ? v.avgCost : undefined,
        attrs: v.attrs,
        search: normalize(`${p.name} ${p.brand ?? ""} ${v.label} ${v.sku} ${v.barcode ?? ""} ${v.attrs?.color ?? ""} ${v.attrs?.texture ?? ""}`),
      });
    }
  }
  return out;
}

export async function storeNames(db: Db): Promise<Record<string, string>> {
  const stores = await col.stores(db).find().project<{ _id: ObjectId; name: string }>({ name: 1 }).toArray();
  return Object.fromEntries(stores.map((s) => [s._id.toHexString(), s.name]));
}

/** Contas que a pessoa pode usar (as da sua loja e, se vê tudo, as gerais) */
export async function usableAccounts(db: Db, actor: Actor) {
  const accounts = await col.accounts(db).find({ active: true, ...(actor.allStores ? {} : storeMatch(actor, "storeId")) }).sort({ type: 1, name: 1 }).toArray();
  return accounts.map((a) => ({ id: a._id.toHexString(), name: a.name, type: a.type, storeId: a.storeId?.toHexString() ?? null }));
}

/** Pessoas ativas que trabalham numa loja */
export async function storeStaff(db: Db, storeId: ObjectId) {
  const users = await col
    .users(db)
    .find({ active: true, $or: [{ allStores: true }, { storeIds: storeId }], isOwner: false })
    .sort({ name: 1 })
    .toArray();
  return users;
}

/** Quantidades por loja e variante: { lojaId: { varianteId: qtd } } */
export async function stockMap(db: Db, storeIds: ObjectId[]): Promise<Record<string, Record<string, number>>> {
  const rows = await col.stock(db).find({ storeId: { $in: storeIds } }).project<{ storeId: ObjectId; variantId: ObjectId; qty: number }>({ storeId: 1, variantId: 1, qty: 1 }).toArray();
  const out: Record<string, Record<string, number>> = {};
  for (const id of storeIds) out[id.toHexString()] = {};
  for (const r of rows) out[r.storeId.toHexString()][r.variantId.toHexString()] = r.qty;
  return out;
}
