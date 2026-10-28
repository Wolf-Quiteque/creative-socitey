"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { changePasswordAction, changePinAction, logout } from "@/app/actions/session";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

export function ProfileForms({ usesPin, usesPassword }: { usesPin: boolean; usesPassword: boolean }) {
  const { pending, run } = useAction();
  const [cur, setCur] = React.useState("");
  const [next, setNext] = React.useState("");
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
  return (
    <Card>
      <CardHeader title={usesPin ? "Mudar o meu PIN" : "Mudar a palavra-passe"} />
      <CardBody className="flex flex-col gap-4">
        {usesPin && (
          <>
            <Field label="PIN atual">
              <Input inputMode="numeric" type="password" value={cur} onChange={(e) => setCur(digits(e.target.value))} autoComplete="current-password" />
            </Field>
            <Field label="PIN novo" hint="4 a 6 algarismos. Não use datas de nascimento.">
              <Input inputMode="numeric" type="password" value={next} onChange={(e) => setNext(digits(e.target.value))} autoComplete="new-password" />
            </Field>
            <Button loading={pending} disabled={cur.length < 4 || next.length < 4} onClick={() => run(() => changePinAction(cur, next), { onSuccess: () => (setCur(""), setNext("")) })}>
              Mudar PIN
            </Button>
          </>
        )}
        {usesPassword && !usesPin && (
          <>
            <Field label="Palavra-passe atual">
              <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="Palavra-passe nova" hint="Pelo menos 10 caracteres.">
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </Field>
            <Button loading={pending} disabled={!cur || next.length < 10} onClick={() => run(() => changePasswordAction(cur, next), { onSuccess: () => (setCur(""), setNext("")) })}>
              Mudar palavra-passe
            </Button>
          </>
        )}
        <Button variant="danger-soft" onClick={() => void logout()}>
          <LogOut /> Sair de todos os aparelhos
        </Button>
      </CardBody>
    </Card>
  );
}
