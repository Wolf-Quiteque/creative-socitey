import { NewDocPage } from "../../new-doc";

export const metadata = { title: "Nova contagem" };

export default function Page() {
  return <NewDocPage mode="ajuste" perm="stock.ajustar" title="Nova contagem" description="Escreva quantas unidades contou. O sistema corrige o stock e regista as diferenças." back="/stock/ajustes" />;
}
