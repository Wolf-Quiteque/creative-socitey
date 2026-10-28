"use client";

import * as React from "react";
import { Printer } from "lucide-react";
import { Button } from "./button";

export function PrintButton({ autoPrint, label = "Imprimir" }: { autoPrint?: boolean; label?: string }) {
  React.useEffect(() => {
    if (!autoPrint) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [autoPrint]);
  return (
    <Button onClick={() => window.print()}>
      <Printer /> {label}
    </Button>
  );
}
