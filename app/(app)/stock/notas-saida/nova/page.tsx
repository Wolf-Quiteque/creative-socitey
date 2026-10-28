import { NewDocPage } from "../../new-doc";

export const metadata = { title: "Nova nota de saída" };

export default function Page() {
  return <NewDocPage mode="saida" perm="stock.nota_saida" title="Nova nota de saída" description="Para mercadoria que sai sem ser vendida: quebras, ofertas, uso interno ou devolução ao fornecedor." back="/stock/notas-saida" />;
}
