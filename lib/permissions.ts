// Catálogo de permissões. É a única fonte: o editor de cargos, a navegação e as verificações
// no servidor leem daqui. Para acrescentar uma permissão basta adicioná-la a um grupo.

export const PERMISSION_GROUPS = [
  {
    id: "painel",
    label: "Painel",
    items: [
      { key: "painel.ver", label: "Ver o painel", desc: "Vendas do dia, alertas de stock e presenças das lojas a que tem acesso." },
      { key: "painel.lucros", label: "Ver custos e lucros", desc: "Mostra preços de custo, margens e lucro. Informação sensível." },
    ],
  },
  {
    id: "pos",
    label: "Ponto de venda",
    items: [
      { key: "pos.vender", label: "Vender", desc: "Usar o ponto de venda e emitir talões." },
      { key: "pos.desconto", label: "Dar descontos", desc: "Até ao desconto máximo definido no cargo." },
      { key: "pos.preco_manual", label: "Alterar o preço na venda", desc: "Mudar o preço de um artigo no carrinho." },
      { key: "pos.caixa", label: "Abrir e fechar caixa", desc: "Declarar o fundo de caixa e contar o dinheiro no fecho." },
      { key: "pos.anular", label: "Anular vendas", desc: "Anula a venda inteira e repõe o stock." },
      { key: "pos.devolucao", label: "Fazer devoluções", desc: "Devolver parte de uma venda e reembolsar o cliente." },
    ],
  },
  {
    id: "vendas",
    label: "Vendas",
    items: [
      { key: "vendas.ver_proprias", label: "Ver as próprias vendas", desc: "Histórico das vendas feitas por esta pessoa." },
      { key: "vendas.ver_loja", label: "Ver todas as vendas", desc: "Vendas de todas as pessoas, nas lojas a que tem acesso." },
    ],
  },
  {
    id: "stock",
    label: "Stock",
    items: [
      { key: "stock.ver", label: "Ver stock", desc: "Quantidades por loja, movimentos e documentos." },
      { key: "stock.custos", label: "Ver valor do stock ao custo", desc: "Mostra o custo médio e o valor do stock." },
      { key: "stock.nota_saida", label: "Criar notas de saída", desc: "Registar quebras, ofertas, uso interno e devoluções ao fornecedor." },
      { key: "stock.transf_enviar", label: "Enviar transferências", desc: "Mandar mercadoria para outra loja." },
      { key: "stock.transf_receber", label: "Receber transferências", desc: "Confirmar o que chegou de outra loja." },
      { key: "stock.ajustar", label: "Contagens e ajustes", desc: "Corrigir o stock depois de contar fisicamente." },
    ],
  },
  {
    id: "produtos",
    label: "Produtos",
    items: [
      { key: "produtos.ver", label: "Ver produtos", desc: "Catálogo de produtos e preços de venda." },
      { key: "produtos.gerir", label: "Gerir produtos", desc: "Criar e editar produtos, variantes e categorias." },
      { key: "produtos.precos", label: "Alterar preços de venda", desc: "Mudar preços gerais e preços por loja." },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    items: [
      { key: "compras.ver", label: "Ver compras", desc: "Compras a fornecedores e o que falta pagar." },
      { key: "compras.criar", label: "Registar compras", desc: "Criar compras com custos de transporte e alfândega." },
      { key: "compras.receber", label: "Dar entrada de compras", desc: "Confirmar a chegada da mercadoria ao stock." },
      { key: "compras.pagar", label: "Registar pagamentos a fornecedores", desc: "Cria saídas de dinheiro." },
      { key: "fornecedores.gerir", label: "Gerir fornecedores", desc: "Criar e editar fornecedores." },
    ],
  },
  {
    id: "financas",
    label: "Finanças",
    items: [
      { key: "financas.ver", label: "Ver entradas e saídas", desc: "Movimentos de dinheiro das lojas a que tem acesso." },
      { key: "financas.entrada", label: "Registar entradas", desc: "Outras receitas e entradas de capital." },
      { key: "financas.saida", label: "Registar saídas", desc: "Despesas como água, cadeiras, renda ou salários." },
      { key: "financas.anular", label: "Anular movimentos", desc: "Anular um movimento registado à mão." },
      { key: "financas.contas", label: "Gerir contas e categorias", desc: "Contas (caixas, bancos), transferências entre contas e categorias." },
      { key: "financas.relatorios", label: "Ver relatórios", desc: "Lucros, fluxo de caixa e despesas por categoria." },
    ],
  },
  {
    id: "rh",
    label: "Recursos humanos",
    items: [
      { key: "rh.horarios_ver", label: "Ver horários da equipa", desc: "Horários de todas as pessoas das suas lojas." },
      { key: "rh.horarios_gerir", label: "Criar horários", desc: "Definir turnos, modelos semanais e copiar semanas." },
      { key: "rh.presencas_confirmar", label: "Confirmar presenças", desc: "Marcar quem chegou, saiu ou faltou hoje." },
      { key: "rh.presencas_editar", label: "Corrigir presenças", desc: "Alterar registos de dias anteriores." },
      { key: "rh.relatorios", label: "Relatórios de RH", desc: "Horas, atrasos e faltas por pessoa." },
    ],
  },
  {
    id: "equipa",
    label: "Equipa e acessos",
    items: [
      { key: "equipa.ver", label: "Ver a equipa", desc: "Lista de pessoas e respetivos cargos." },
      { key: "equipa.gerir", label: "Gerir contas", desc: "Criar contas, mudar o PIN, desativar pessoas." },
      { key: "cargos.gerir", label: "Gerir cargos e permissões", desc: "Criar cargos e escolher o que cada um pode fazer." },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    items: [
      { key: "lojas.gerir", label: "Gerir lojas", desc: "Abrir lojas novas e mudar as opções de cada loja." },
      { key: "definicoes.gerir", label: "Definições gerais", desc: "Dados da empresa, talão e regras de presença." },
      { key: "auditoria.ver", label: "Ver registo de atividade", desc: "Quem fez o quê e quando." },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]["items"][number]["key"];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
const PERM_SET = new Set<string>(ALL_PERMISSIONS);
export const isPermission = (v: unknown): v is Permission => typeof v === "string" && PERM_SET.has(v);

export const PERMISSION_LABEL: Record<Permission, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])),
) as Record<Permission, string>;

/** Cargos prontos a usar. O dono pode editá-los, duplicá-los ou criar outros. */
export const ROLE_PRESETS: { name: string; color: string; description: string; maxDiscountPct: number; permissions: Permission[] }[] = [
  {
    name: "Administrador",
    color: "#B4593C",
    description: "Acesso total. Para sócios ou gestores de confiança.",
    maxDiscountPct: 100,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: "Gerente de loja",
    color: "#8C6A4F",
    description: "Gere a loja: vendas, stock, caixa e equipa da loja.",
    maxDiscountPct: 20,
    permissions: [
      "painel.ver",
      "pos.vender",
      "pos.desconto",
      "pos.caixa",
      "pos.anular",
      "pos.devolucao",
      "vendas.ver_proprias",
      "vendas.ver_loja",
      "stock.ver",
      "stock.nota_saida",
      "stock.transf_enviar",
      "stock.transf_receber",
      "stock.ajustar",
      "produtos.ver",
      "compras.ver",
      "compras.receber",
      "financas.ver",
      "financas.saida",
      "rh.horarios_ver",
      "rh.horarios_gerir",
      "rh.presencas_confirmar",
      "equipa.ver",
    ],
  },
  {
    name: "Caixa / Vendedor(a)",
    color: "#C98C8C",
    description: "Vende no ponto de venda e vê o próprio horário.",
    maxDiscountPct: 5,
    permissions: ["pos.vender", "pos.desconto", "pos.caixa", "vendas.ver_proprias", "stock.ver", "produtos.ver"],
  },
  {
    name: "Supervisor(a) de RH",
    color: "#7A8C6A",
    description: "Confirma presenças e organiza horários.",
    maxDiscountPct: 0,
    permissions: ["rh.horarios_ver", "rh.horarios_gerir", "rh.presencas_confirmar", "rh.presencas_editar", "rh.relatorios", "equipa.ver"],
  },
  {
    name: "Fiel de armazém",
    color: "#A5814E",
    description: "Recebe mercadoria, faz transferências e contagens.",
    maxDiscountPct: 0,
    permissions: [
      "stock.ver",
      "stock.nota_saida",
      "stock.transf_enviar",
      "stock.transf_receber",
      "stock.ajustar",
      "produtos.ver",
      "compras.ver",
      "compras.receber",
    ],
  },
  {
    name: "Contabilista",
    color: "#6F7F8F",
    description: "Consulta finanças e relatórios, sem vender.",
    maxDiscountPct: 0,
    permissions: [
      "painel.ver",
      "painel.lucros",
      "vendas.ver_loja",
      "stock.ver",
      "stock.custos",
      "compras.ver",
      "financas.ver",
      "financas.relatorios",
      "rh.relatorios",
    ],
  },
];
