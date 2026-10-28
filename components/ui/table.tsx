import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/format";

/**
 * Tabela no computador, cartões no telemóvel. `mobile` desenha cada linha como cartão.
 */
export function ResponsiveTable<T>({
  rows,
  columns,
  mobile,
  rowKey,
  rowHref,
  empty,
  className,
}: {
  rows: T[];
  columns: { header: React.ReactNode; cell: (row: T) => React.ReactNode; className?: string; align?: "right" | "center" }[];
  mobile: (row: T) => React.ReactNode;
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string | undefined;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (!rows.length) return <>{empty}</>;
  return (
    <div className={className}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-[13px] font-medium text-muted">
              {columns.map((c, i) => (
                <th key={i} className={cn("px-4 py-3 font-medium first:pl-6 last:pr-6", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = rowHref?.(r);
              return (
                <tr key={rowKey(r)} className={cn("border-b border-line/60 last:border-0", href && "relative cursor-pointer hover:bg-sand/50")}>
                  {columns.map((c, i) => (
                    <td key={i} className={cn("px-4 py-3.5 first:pl-6 last:pr-6", c.align === "right" && "text-right tabular", c.align === "center" && "text-center", c.className)}>
                      {i === 0 && href ? (
                        <Link href={href} className="after:absolute after:inset-0">
                          {c.cell(r)}
                        </Link>
                      ) : (
                        c.cell(r)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col divide-y divide-line/70 md:hidden">
        {rows.map((r) => {
          const href = rowHref?.(r);
          return (
            <li key={rowKey(r)} className="relative px-4 py-3.5 active:bg-sand/60">
              {href && <Link href={href} className="absolute inset-0" aria-label="Abrir" />}
              {mobile(r)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
