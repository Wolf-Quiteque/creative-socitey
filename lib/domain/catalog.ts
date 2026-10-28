import { ObjectId, type Db } from "mongodb";
import { col, withTx, type VariantDoc } from "../db";
import { assertCan, can, canAccessStore, oid, UserError, who, type Actor } from "../actor";
import { audit } from "../audit";
import { categorySchema, productSchema } from "../validation";
import { applyMovements } from "./stock";
import { normalize } from "../text";

export { normalize };

function searchText(name: string, brand: string | undefined, variants: Pick<VariantDoc, "sku" | "barcode" | "label">[]) {
  return normalize([name, brand ?? "", ...variants.flatMap((v) => [v.sku, v.barcode ?? "", v.label])].join(" "));
}

export async function saveProduct(_db: Db, actor: Actor, idRaw: unknown, input: unknown) {
  assertCan(actor, "produtos.gerir");
  const data = productSchema.parse(input);
  const skus = data.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) throw new UserError("Há SKUs repetidos nas variantes.");
  if (!data.hasVariants && data.variants.length > 1) data.variants = data.variants.slice(0, 1);

  return withTx(async (db, session) => {
    const id = idRaw ? oid(idRaw) : null;
    const clash = await col.products(db).findOne({ "variants.sku": { $in: skus }, ...(id ? { _id: { $ne: id } } : {}) }, { session });
    if (clash) {
      const sku = clash.variants.find((v) => skus.includes(v.sku))?.sku;
      throw new UserError(`O SKU ${sku} já é usado no produto «${clash.name}».`);
    }
    if (data.categoryId && !(await col.categories(db).findOne({ _id: oid(data.categoryId) }, { session }))) throw new UserError("Categoria inválida.");

    const before = id ? await col.products(db).findOne({ _id: id }, { session }) : null;
    if (id && !before) throw new UserError("Produto não encontrado.");
    const canPrice = can(actor, "produtos.precos");
    const canCost = can(actor, "stock.custos");

    const variants: VariantDoc[] = data.variants.map((v) => {
      const prev = v.id && before ? before.variants.find((x) => x._id.toHexString() === v.id) : undefined;
      if (prev && !canPrice) {
        const samePrices = prev.price === v.price && JSON.stringify(prev.storePrices ?? {}) === JSON.stringify(v.storePrices ?? {});
        if (!samePrices) throw new UserError("Não tem permissão para alterar preços de venda.");
      }
      const cost = v.cost !== undefined && (canCost || !prev) ? Math.round(v.cost * 100) / 100 : (prev?.avgCost ?? 0);
      return {
        _id: prev?._id ?? new ObjectId(),
        sku: v.sku,
        barcode: v.barcode,
        label: data.hasVariants ? v.label : "",
        price: Math.round(v.price),
        storePrices: Object.fromEntries(Object.entries(v.storePrices ?? {}).map(([k, p]) => [k, Math.round(p)])),
        avgCost: cost,
        lastCost: prev?.lastCost,
        minQty: v.minQty ?? 0,
        attrs: v.attrs,
        active: v.active ?? true,
      };
    });
    // Variantes retiradas do formulário ficam inativas (o histórico continua a apontar para elas)
    if (before) {
      for (const old of before.variants) {
        if (!variants.some((v) => v._id.equals(old._id))) variants.push({ ...old, active: false });
      }
    }
    if (data.hasVariants && variants.some((v) => v.active && !v.label)) throw new UserError("Dê um nome a cada variante (ex.: 18\" · Preto natural).");

    const now = new Date();
    const fields = {
      name: data.name,
      brand: data.brand,
      categoryId: data.categoryId ? new ObjectId(data.categoryId) : null,
      description: data.description,
      imageId: data.imageId ? new ObjectId(data.imageId) : undefined,
      hasVariants: data.hasVariants,
      variants,
      active: data.active ?? true,
      search: searchText(data.name, data.brand, variants),
      updatedAt: now,
    };

    if (before) {
      await col.products(db).updateOne({ _id: before._id }, { $set: fields }, { session });
      await audit(db, actor, "produto.editar", "product", `Produto «${data.name}» alterado`, { entityId: before._id, session });
      return { id: before._id.toHexString() };
    }

    const _id = new ObjectId();
    await col.products(db).insertOne({ _id, ...fields, createdAt: now }, { session });
    // Stock inicial por loja (só ao criar)
    const moves = data.variants.flatMap((v, i) =>
      (v.initialStock ?? [])
        .filter((s) => s.qty > 0)
        .map((s) => {
          const storeId = new ObjectId(s.storeId);
          if (!canAccessStore(actor, storeId)) throw new UserError("Não tem acesso a uma das lojas do stock inicial.");
          const variant = variants[i];
          return {
            storeId,
            productId: _id,
            variantId: variant._id,
            name: variant.label ? `${data.name} — ${variant.label}` : data.name,
            qty: s.qty,
            type: "stock_inicial" as const,
            unitCost: variant.avgCost,
            ref: { kind: "manual" as const },
          };
        }),
    );
    if (moves.length) await applyMovements(db, session, moves, who(actor));
    await audit(db, actor, "produto.criar", "product", `Produto «${data.name}» criado`, { entityId: _id, session });
    return { id: _id.toHexString() };
  });
}

export async function setProductActive(db: Db, actor: Actor, idRaw: unknown, active: unknown) {
  assertCan(actor, "produtos.gerir");
  if (typeof active !== "boolean") throw new UserError("Valor inválido.");
  const id = oid(idRaw);
  await col.products(db).updateOne({ _id: id }, { $set: { active, updatedAt: new Date() } });
  return {};
}

export async function saveCategory(db: Db, actor: Actor, idRaw: unknown, input: unknown) {
  assertCan(actor, "produtos.gerir");
  const data = categorySchema.parse(input);
  if (idRaw) {
    const id = oid(idRaw);
    await col.categories(db).updateOne({ _id: id }, { $set: data });
    return { id: id.toHexString() };
  }
  const count = await col.categories(db).countDocuments();
  const _id = new ObjectId();
  await col.categories(db).insertOne({ _id, ...data, order: count, createdAt: new Date() });
  return { id: _id.toHexString() };
}

export async function deleteCategory(db: Db, actor: Actor, idRaw: unknown) {
  assertCan(actor, "produtos.gerir");
  const id = oid(idRaw);
  const used = await col.products(db).countDocuments({ categoryId: id });
  if (used) throw new UserError(`Esta categoria tem ${used} produto(s). Mude-os de categoria primeiro.`);
  await col.categories(db).deleteOne({ _id: id });
  return {};
}
