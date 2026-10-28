import { luandaMinutes } from "./time";

export function greeting(name: string): string {
  const h = Math.floor(luandaMinutes() / 60);
  const first = name.split(" ")[0];
  return `${h < 12 ? "Bom dia" : h < 19 ? "Boa tarde" : "Boa noite"}, ${first}`;
}
