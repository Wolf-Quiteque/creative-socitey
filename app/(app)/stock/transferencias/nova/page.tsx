import { NewDocPage } from "../../new-doc";

export const metadata = { title: "Nova transferência" };

export default function Page() {
  return <NewDocPage mode="transferencia" perm="stock.transf_enviar" title="Nova transferência" description="A mercadoria sai já desta loja e fica «em trânsito» até a outra loja confirmar o que recebeu." back="/stock/transferencias" />;
}
