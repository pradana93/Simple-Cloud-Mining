"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MfaModal } from "@/components/2fa/mfa-modal";
import { useToast } from "@/components/ui/toast";

type MfaPayload = { mfaRequired?: boolean; mfaSetupRequired?: boolean };

export function AdminMfaProvider({ children }: { children: React.ReactNode }) {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const waiters = useRef<Array<(ok: boolean) => void>>([]);

  const requestMfa = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        waiters.current.push(resolve);
        setOpen(true);
      }),
    []
  );

  const settle = useCallback((ok: boolean) => {
    const pending = waiters.current;
    waiters.current = [];
    setOpen(false);
    for (const resolve of pending) resolve(ok);
  }, []);

  useEffect(() => {
    const original = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const retryInput = input instanceof Request ? input.clone() : input;
      const res = await original(input, init);

      if (res.status !== 403 || !url.includes("/api/admin/")) return res;

      const data = (await res
        .clone()
        .json()
        .catch(() => null)) as MfaPayload | null;

      if (data?.mfaSetupRequired) {
        push("Set up two-factor in Account before using admin tools.", "error");
        return res;
      }
      if (!data?.mfaRequired) return res;

      const ok = await requestMfa();
      if (!ok) return res;

      return original(retryInput, init);
    };

    return () => {
      window.fetch = original;
    };
  }, [push, requestMfa]);

  return (
    <>
      {children}
      <MfaModal
        open={open}
        onClose={() => settle(false)}
        onDone={() => settle(true)}
        title="Confirm it is you"
        description="Enter the current 6-digit code from your authenticator to continue with this admin action."
      />
    </>
  );
}
