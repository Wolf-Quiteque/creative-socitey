import type { Permission } from "./permissions";

export type NavIcon = "home" | "pos" | "receipt" | "boxes" | "tag" | "truck" | "wallet" | "calendar" | "clock" | "users" | "store" | "settings";

export type NavItem = { href: string; label: string; short?: string; icon: NavIcon; any: Permission[]; group: string; mobile: number; exact?: boolean };

/** Navegação principal. `any` vazio = todos veem. `mobile` = prioridade na barra de baixo. */
export const NAV: NavItem[] = [
  { href: "/", label: "Início", icon: "home", any: [], group: "Dia a dia", mobile: 1, exact: true },
  { href: "/vender", label: "Vender", icon: "pos", any: ["pos.vender"], group: "Dia a dia", mobile: 2 },
  { href: "/vendas", label: "Vendas", icon: "receipt", any: ["vendas.ver_proprias", "vendas.ver_loja", "pos.caixa"], group: "Dia a dia", mobile: 6 },
  { href: "/stock", label: "Stock", icon: "boxes", any: ["stock.ver"], group: "Mercadoria", mobile: 3 },
  { href: "/produtos", label: "Produtos", icon: "tag", any: ["produtos.ver"], group: "Mercadoria", mobile: 8 },
  { href: "/compras", label: "Compras", icon: "truck", any: ["compras.ver", "fornecedores.gerir"], group: "Mercadoria", mobile: 9 },
  { href: "/financas", label: "Finanças", icon: "wallet", any: ["financas.ver", "financas.relatorios", "financas.contas"], group: "Dinheiro", mobile: 4 },
  { href: "/rh", label: "Horários e presenças", short: "Equipa hoje", icon: "calendar", any: ["rh.horarios_ver", "rh.presencas_confirmar", "rh.relatorios"], group: "Pessoas", mobile: 7 },
  { href: "/meu-horario", label: "Meu horário", short: "Horário", icon: "clock", any: [], group: "Pessoas", mobile: 5 },
  { href: "/equipa", label: "Equipa e cargos", short: "Equipa", icon: "users", any: ["equipa.ver", "cargos.gerir"], group: "Pessoas", mobile: 10 },
  { href: "/lojas", label: "Lojas", icon: "store", any: ["lojas.gerir"], group: "Administração", mobile: 11 },
  { href: "/definicoes", label: "Definições", icon: "settings", any: ["definicoes.gerir", "auditoria.ver"], group: "Administração", mobile: 12 },
];

export function allowedNav(perms: ReadonlySet<string>): NavItem[] {
  return NAV.filter((n) => !n.any.length || n.any.some((p) => perms.has(p)));
}
