"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ImagePlus, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "@/lib/use-action";
import { saveProductAction } from "@/app/actions/app";
import { DENSITIES, HAIR_TYPES, LACE_TYPES, TEXTURES, type VariantAttrs } from "@/lib/types";
import { cn, formatKz, formatPct } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, MoneyInput, NumberInput, Select, Textarea, Toggle } from "@/components/ui/field";
import { ProductThumb } from "@/components/pos/ProductThumb";
import { StickyActions } from "@/components/ui/sticky-actions";

export type VariantState = {
  id?: string;
  sku: string;
  barcode?: string;
  label: string;
  price: number;
  cost: number;
  minQty: number;
  attrs: VariantAttrs;
  storePrices: Record<string, number>;
  initialStock: Record<string, number>;
  active: boolean;
};

export type ProductState = {
  id?: string;
  name: string;
  brand?: string;
  categoryId: string;
  description?: string;
  imageId?: string;
  active: boolean;
  hasVariants: boolean;
  variants: VariantState[];
};

const blankVariant = (minQty = 0): VariantState => ({ sku: "", label: "", price: 0, cost: 0, minQty, attrs: {}, storePrices: {}, initialStock: {}, active: true });
const STOP = new Set(["de", "da", "do", "das", "dos", "com", "para", "e", "a", "o"]);

function suggestSku(name: string, v: VariantState, i: number): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()))
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const suffix = v.attrs.lengthIn ? String(v.attrs.lengthIn) : v.label ? v.label.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() : i ? String(i + 1) : "";
  return [base || "PROD", suffix].filter(Boolean).join("-");
}

export function ProductForm({
  initial,
  categories,
  stores,
  perms,
  defaultMinQty = 0,
}: {
  defaultMinQty?: number;
  initial: ProductState | null;
  categories: { id: string; name: string; type: string }[];
  stores: { id: string; name: string }[];
  perms: { prices: boolean; costs: boolean };
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const isNew = !initial?.id;
  const [p, setP] = React.useState<ProductState>(
    initial ?? { name: "", categoryId: categories[0]?.id ?? "", active: true, hasVariants: false, variants: [blankVariant(defaultMinQty)] },
  );
  const [uploading, setUploading] = React.useState(false);
  const set = (patch: Partial<ProductState>) => setP((x) => ({ ...x, ...patch }));
  const setV = (i: number, patch: Partial<VariantState>) => setP((x) => ({ ...x, variants: x.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
  const isHair = categories.find((c) => c.id === p.categoryId)?.type === "cabelo";
  const pricesLocked = !isNew && !perms.prices;
  const visible = p.variants.map((v, i) => ({ v, i })).filter(({ v }) => v.active);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/imagens?tipo=produto", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      set({ imageId: j.id });
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    const variants = p.variants.map((v, i) => ({ ...v, sku: v.sku || suggestSku(p.name, v, i) }));
    const payload = {
      name: p.name,
      brand: p.brand,
      categoryId: p.categoryId || null,
      description: p.description,
      imageId: p.imageId || null,
      active: p.active,
      hasVariants: p.hasVariants,
      variants: (p.hasVariants ? variants : variants.slice(0, 1)).map((v) => ({
        id: v.id ?? null,
        sku: v.sku,
        barcode: v.barcode,
        label: p.hasVariants ? v.label : "",
        price: v.price,
        ...(perms.costs || isNew ? { cost: v.cost } : {}),
        minQty: v.minQty,
        attrs: isHair ? Object.fromEntries(Object.entries(v.attrs).filter(([, x]) => x !== "" && x !== undefined)) : undefined,
        storePrices: Object.fromEntries(Object.entries(v.storePrices).filter(([, x]) => x > 0)),
        active: v.active,
        initialStock: isNew ? Object.entries(v.initialStock).filter(([, q]) => q > 0).map(([storeId, qty]) => ({ storeId, qty })) : [],
      })),
    };
    run(() => saveProductAction(initial?.id ?? null, payload), {
      onSuccess: (r) => {
        if (isNew && "id" in r) router.push(`/produtos/${(r as { id: string }).id}`);
      },
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-5">
        <Card>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do produto" className="sm:col-span-2">
              <Input value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="ex.: Peruca Lace Frontal Lisa" />
            </Field>
            <Field label="Marca (opcional)">
              <Input value={p.brand ?? ""} onChange={(e) => set({ brand: e.target.value })} />
            </Field>
            <Field label="Categoria">
              <Select value={p.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Descrição (opcional)" className="sm:col-span-2">
              <Textarea value={p.description ?? ""} onChange={(e) => set({ description: e.target.value })} className="min-h-20" />
            </Field>
            <div className="sm:col-span-2">
              <Toggle
                checked={p.hasVariants}
                onChange={(v) => set({ hasVariants: v, variants: v ? p.variants : p.variants.slice(0, 1) })}
                label="Tem variantes"
                description="Use quando o mesmo produto existe em vários comprimentos, cores ou tons, cada um com o seu stock e preço."
              />
            </div>
          </CardBody>
        </Card>

        {visible.map(({ v, i }, n) => (
          <Card key={v.id ?? `new-${i}`}>
            <CardHeader
              title={p.hasVariants ? v.label || `Variante ${n + 1}` : "Preço e stock"}
              action={
                p.hasVariants && visible.length > 1 ? (
                  <button
                    onClick={() => (v.id ? setV(i, { active: false }) : setP((x) => ({ ...x, variants: x.variants.filter((_, j) => j !== i) })))}
                    className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                    aria-label="Remover variante"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null
              }
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {p.hasVariants && (
                <Field label="Nome da variante" hint={isHair ? 'ex.: 18" · Preto natural' : "ex.: Tom 02, Vermelho, 500 ml"} className="sm:col-span-2">
                  <Input value={v.label} onChange={(e) => setV(i, { label: e.target.value })} />
                </Field>
              )}
              <Field label="Preço de venda">
                <MoneyInput value={v.price} onChange={(x) => setV(i, { price: x })} disabled={pricesLocked} />
              </Field>
              {(perms.costs || isNew) && (
                <Field
                  label={isNew ? "Custo por unidade (se já tem stock)" : "Custo médio"}
                  hint={v.price && v.cost ? `Margem ${formatPct(((v.price - v.cost) / v.price) * 100, 0)} · lucro ${formatKz(v.price - v.cost)}/un.` : "As compras atualizam este valor sozinhas."}
                >
                  <MoneyInput value={v.cost} onChange={(x) => setV(i, { cost: x })} />
                </Field>
              )}
              <Field label="SKU (código interno)">
                <div className="flex gap-2">
                  <Input value={v.sku} onChange={(e) => setV(i, { sku: e.target.value.toUpperCase() })} placeholder={suggestSku(p.name, v, i)} />
                  <Button type="button" variant="secondary" size="icon" title="Gerar" onClick={() => setV(i, { sku: suggestSku(p.name, v, i) })}>
                    <Wand2 />
                  </Button>
                </div>
              </Field>
              <Field label="Código de barras (opcional)">
                <Input value={v.barcode ?? ""} onChange={(e) => setV(i, { barcode: e.target.value })} inputMode="numeric" />
              </Field>
              <Field label="Stock mínimo" hint="Avisa quando uma loja ficar com esta quantidade ou menos.">
                <NumberInput value={v.minQty} onChange={(x) => setV(i, { minQty: x })} />
              </Field>

              {isHair && <HairFields attrs={v.attrs} onChange={(attrs) => setV(i, { attrs, label: p.hasVariants && !v.label && attrs.lengthIn && attrs.color ? `${attrs.lengthIn}" · ${attrs.color}` : v.label })} />}

              {stores.length > 0 && (
                <Collapsible title="Preço diferente numa loja" className="sm:col-span-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {stores.map((s) => (
                      <Field key={s.id} label={s.name}>
                        <MoneyInput value={v.storePrices[s.id] ?? 0} placeholder={`Igual (${formatKz(v.price)})`} disabled={pricesLocked} onChange={(x) => setV(i, { storePrices: { ...v.storePrices, [s.id]: x } })} />
                      </Field>
                    ))}
                  </div>
                </Collapsible>
              )}
              {isNew && stores.length > 0 && (
                <Collapsible title="Stock inicial por loja" className="sm:col-span-2" defaultOpen>
                  <p className="mb-3 text-sm text-muted">Só para o stock que já tem. Mercadoria nova deve entrar pelas Compras (calcula o custo com transporte).</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {stores.map((s) => (
                      <Field key={s.id} label={s.name}>
                        <NumberInput value={v.initialStock[s.id] ?? 0} onChange={(x) => setV(i, { initialStock: { ...v.initialStock, [s.id]: x } })} />
                      </Field>
                    ))}
                  </div>
                </Collapsible>
              )}
            </CardBody>
          </Card>
        ))}
        {p.hasVariants && (
          <Button variant="soft" onClick={() => setP((x) => ({ ...x, variants: [...x.variants, { ...blankVariant(defaultMinQty), price: visible[visible.length - 1]?.v.price ?? 0, attrs: { ...(visible[visible.length - 1]?.v.attrs ?? {}) } }] }))}>
            <Plus /> Adicionar variante
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl">
              <ProductThumb name={p.name || "?"} imageId={p.imageId} className="aspect-square w-full" />
              <label className={cn("absolute inset-x-3 bottom-3 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface/90 text-sm font-medium text-ink shadow-soft backdrop-blur", uploading && "opacity-60")}>
                <ImagePlus className="size-4" /> {uploading ? "A enviar…" : p.imageId ? "Mudar foto" : "Adicionar foto"}
                <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
            </div>
            {p.imageId && (
              <button className="text-sm text-muted hover:text-danger" onClick={() => set({ imageId: undefined })}>
                Remover foto
              </button>
            )}
            <Toggle checked={p.active} onChange={(v) => set({ active: v })} label="À venda" description="Desligue para esconder do ponto de venda sem apagar o histórico." />
            <Button size="lg" className="hidden lg:inline-flex" loading={pending} onClick={save} disabled={!p.name.trim()}>
              {isNew ? "Criar produto" : "Guardar alterações"}
            </Button>
            {pricesLocked && <p className="text-sm text-muted">Os preços estão bloqueados: o seu cargo não permite alterá-los.</p>}
          </CardBody>
        </Card>
      </div>
      <StickyActions>
        <Button size="lg" loading={pending} onClick={save} disabled={!p.name.trim()}>
          {isNew ? "Criar produto" : "Guardar alterações"}
        </Button>
      </StickyActions>
    </div>
  );
}

function HairFields({ attrs, onChange }: { attrs: VariantAttrs; onChange: (a: VariantAttrs) => void }) {
  const set = (patch: Partial<VariantAttrs>) => onChange({ ...attrs, ...patch });
  return (
    <div className="grid gap-4 rounded-2xl bg-sand/60 p-4 sm:col-span-2 sm:grid-cols-3">
      <div className="text-sm font-semibold text-ink sm:col-span-3">Detalhes do cabelo</div>
      <Field label="Tipo">
        <Select value={attrs.hairType ?? ""} onChange={(e) => set({ hairType: (e.target.value || undefined) as VariantAttrs["hairType"] })}>
          <option value="">—</option>
          {Object.entries(HAIR_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Comprimento (polegadas)">
        <NumberInput value={attrs.lengthIn ?? 0} onChange={(v) => set({ lengthIn: v || undefined })} />
      </Field>
      <Field label="Cor">
        <Input value={attrs.color ?? ""} onChange={(e) => set({ color: e.target.value })} placeholder="Preto natural" />
      </Field>
      <Field label="Textura">
        <Select value={attrs.texture ?? ""} onChange={(e) => set({ texture: e.target.value || undefined })}>
          <option value="">—</option>
          {TEXTURES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Lace">
        <Select value={attrs.lace ?? ""} onChange={(e) => set({ lace: e.target.value || undefined })}>
          <option value="">—</option>
          {LACE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Densidade">
        <Select value={attrs.density ?? ""} onChange={(e) => set({ density: e.target.value || undefined })}>
          <option value="">—</option>
          {DENSITIES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function Collapsible({ title, children, className, defaultOpen }: { title: string; children: React.ReactNode; className?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <div className={cn("rounded-2xl border border-line", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-ink">
        {title}
        <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
