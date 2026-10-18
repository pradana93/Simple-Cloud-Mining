"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

export type ApiJson = { ok?: boolean; error?: string; message?: string } & Record<string, unknown>;

// One place for admin mutations: JSON POST/PATCH/DELETE, toast, busy flag, refresh.
export function useAdminAction() {
  const { push } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (
      url: string,
      body: unknown,
      opts?: { method?: "POST" | "PATCH" | "DELETE"; success?: string; onOk?: (j: ApiJson) => void }
    ): Promise<ApiJson> => {
      setBusy(true);
      try {
        const res = await fetch(url, {
          method: opts?.method ?? "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = (await res.json()) as ApiJson;
        if (!j.ok) {
          push(j.error ?? "Action failed", "error");
          return j;
        }
        push(opts?.success ?? j.message ?? "Saved", "success");
        opts?.onOk?.(j);
        router.refresh();
        return j;
      } catch {
        push("Action failed", "error");
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [push, router]
  );

  return { run, busy };
}
