export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function readParams(sp: SearchParams) {
  const p = await sp;
  return (k: string, fallback = ""): string => {
    const v = p[k];
    return (Array.isArray(v) ? v[0] : v) ?? fallback;
  };
}
