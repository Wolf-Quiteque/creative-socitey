// Constantes e rótulos partilhados entre servidor e browser (sem dependências de servidor).

export const PAYMENT_METHODS = {
  dinheiro: "Dinheiro",
  tpa: "TPA (cartão)",
  transferencia: "Transferência",
  express: "Multicaixa Express",
  outro: "Outro",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;
export const PAYMENT_METHOD_KEYS = Object.keys(PAYMENT_METHODS) as PaymentMethod[];

export const MOVEMENT_TYPES = {
  compra: "Compra",
  venda: "Venda",
  devolucao: "Devolução de cliente",
  anulacao: "Venda anulada",
  transf_saida: "Transferência (saída)",
  transf_entrada: "Transferência (entrada)",
  perda_transito: "Perda em trânsito",
  ajuste: "Ajuste de contagem",
  quebra: "Quebra / dano",
  uso_interno: "Uso interno",
  oferta: "Oferta / brinde",
  devolucao_fornecedor: "Devolução ao fornecedor",
  outro: "Outra saída",
  stock_inicial: "Stock inicial",
} as const;
export type MovementType = keyof typeof MOVEMENT_TYPES;

/** Tipos de movimento que contam como perda no relatório de lucros (valorizados ao custo) */
export const LOSS_MOVEMENTS: MovementType[] = ["quebra", "uso_interno", "oferta", "perda_transito", "outro", "ajuste"];

export const SAIDA_REASONS = {
  quebra: "Quebra / dano",
  uso_interno: "Uso interno",
  oferta: "Oferta / brinde",
  devolucao_fornecedor: "Devolução ao fornecedor",
  outro: "Outro motivo",
} as const;
export type SaidaReason = keyof typeof SAIDA_REASONS;

export const STOCK_DOC_TYPES = { saida: "Nota de saída", transferencia: "Transferência", ajuste: "Contagem / ajuste" } as const;
export type StockDocType = keyof typeof STOCK_DOC_TYPES;

export const STOCK_DOC_STATUS = {
  concluida: "Concluída",
  em_transito: "Em trânsito",
  recebida: "Recebida",
  recebida_com_diferencas: "Recebida com diferenças",
  cancelada: "Cancelada",
} as const;
export type StockDocStatus = keyof typeof STOCK_DOC_STATUS;

export const ATTENDANCE_STATUS = {
  presente: "Presente",
  atrasado: "Atrasado",
  falta: "Falta",
  falta_justificada: "Falta justificada",
  folga: "Folga",
  ferias: "Férias",
} as const;
export type AttendanceStatus = keyof typeof ATTENDANCE_STATUS;

export const CATEGORY_KINDS = {
  venda: "Vendas",
  receita: "Outra receita",
  capital: "Entrada de capital",
  despesa: "Despesa",
  compra_stock: "Compra de mercadoria",
  retirada_dono: "Levantamento do dono",
  transferencia: "Transferência entre contas",
  estorno: "Anulação / devolução",
} as const;
export type CategoryKind = keyof typeof CATEGORY_KINDS;

/** Categorias que o utilizador pode escolher ao registar movimentos à mão */
export const MANUAL_IN_KINDS: CategoryKind[] = ["receita", "capital"];
export const MANUAL_OUT_KINDS: CategoryKind[] = ["despesa", "compra_stock", "retirada_dono"];

export const CATEGORY_KIND_HINTS: Record<CategoryKind, string> = {
  venda: "Criada automaticamente em cada venda.",
  receita: "Dinheiro que entra e conta como ganho (ex.: serviços de instalação).",
  capital: "Dinheiro que o dono põe no negócio. Não conta como lucro.",
  despesa: "Custos do dia a dia (água, cadeiras, renda, salários). Reduzem o lucro.",
  compra_stock: "Dinheiro gasto em mercadoria. Sai da caixa, mas vira stock — só conta no lucro quando o produto é vendido.",
  retirada_dono: "Dinheiro que o dono leva para si. Sai da caixa, mas não é despesa do negócio.",
  transferencia: "Passar dinheiro de uma conta para outra (ex.: depositar a caixa no banco).",
  estorno: "Criada automaticamente quando uma venda é anulada ou devolvida.",
};

export const ACCOUNT_TYPES = { caixa: "Caixa (dinheiro)", banco: "Banco", outro: "Outra" } as const;
export type AccountType = keyof typeof ACCOUNT_TYPES;

export const CURRENCIES = { AOA: "Kwanza (Kz)", USD: "Dólar (USD)", EUR: "Euro (EUR)", CNY: "Yuan (CNY)", BRL: "Real (BRL)" } as const;
export type Currency = keyof typeof CURRENCIES;

export const EXTRA_COST_KINDS = { transporte: "Transporte", alfandega: "Alfândega", taxas: "Taxas e comissões", outro: "Outro custo" } as const;
export type ExtraCostKind = keyof typeof EXTRA_COST_KINDS;

export const CATEGORY_TYPES = { cabelo: "Cabelo / perucas", beleza: "Beleza", outro: "Outro" } as const;
export type ProductCategoryType = keyof typeof CATEGORY_TYPES;

export const HAIR_TYPES = { humano: "Cabelo humano", sintetico: "Sintético", misto: "Misto" } as const;
export const TEXTURES = ["Liso", "Ondulado (body wave)", "Deep wave", "Cacheado", "Crespo (kinky)", "Water wave", "Loose wave"] as const;
export const LACE_TYPES = ["Sem lace", "Closure 4x4", "Closure 5x5", "Frontal 13x4", "Frontal 13x6", "360 lace", "Full lace", "HD lace"] as const;
export const DENSITIES = ["130%", "150%", "180%", "200%", "250%"] as const;

export type VariantAttrs = {
  hairType?: keyof typeof HAIR_TYPES;
  texture?: string;
  lengthIn?: number;
  color?: string;
  lace?: string;
  density?: string;
};

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export type ActionResult<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string };
