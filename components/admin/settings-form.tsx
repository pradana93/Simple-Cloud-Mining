"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Loader2, RotateCcw, Save, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ALL_FIELDS, SETTINGS_SECTIONS, type SettingsField } from "@/lib/settings-fields";
import type { SiteSettings } from "@/lib/types";

type Draft = Record<string, string>;

function toDraft(s: Partial<Record<string, unknown>>): Draft {
  const d: Draft = {};
  for (const f of ALL_FIELDS) {
    const v = s[f.key as string];
    if (f.boolean) {
      d[f.key as string] = v === true || v === "yes" || v === "true" ? "yes" : "no";
    } else {
      d[f.key as string] = v === null || v === undefined ? "" : String(v);
    }
  }
  return d;
}

const control =
  "h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-4 text-sm text-slate-100 placeholder:text-slate-400 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-xs font-medium text-red-300">{msg}</p>;
}

function SettingsControl({
  field,
  value,
  error,
  onChange,
}: {
  field: SettingsField;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const invalid = Boolean(error);
  const ring = invalid ? "border-red-500/60 focus:border-red-500/70 focus:ring-red-500/25" : "";
  const [reveal, setReveal] = useState(false);

  if (field.type === "slider") {
    const n = Number(value === "" ? field.min ?? 0 : value);
    return (
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={field.min ?? 0}
          max={field.max ?? 100}
          step={field.step ?? 1}
          value={Number.isFinite(n) ? n : field.min ?? 0}
          onChange={(e) => onChange(e.target.value)}
          aria-label={field.label}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-gold-500"
        />
        <input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(control, "w-24 px-3 text-center", ring)}
        />
      </div>
    );
  }

  if (field.type === "segmented") {
    return (
      <div role="radiogroup" aria-label={field.label} className="inline-flex rounded-xl border border-slate-700 p-1">
        {field.options?.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "tap min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              value === o.value ? "bg-gold-500 text-ink-950" : "text-slate-300 hover:text-white"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === "switch") {
    const on = value === "yes";
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(on ? "no" : "yes")}
        className="tap inline-flex h-11 items-center gap-3 rounded-xl border border-slate-700 px-3 text-sm font-semibold text-slate-200 hover:border-gold-500/40"
      >
        <span className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-emerald-500/80" : "bg-slate-600")}>
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
        </span>
        {on ? "Enabled" : "Disabled"}
      </button>
    );
  }

  if (field.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(control, ring)}>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={value}
        rows={4}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(control, "h-auto py-3 font-mono text-xs leading-relaxed", ring)}
      />
    );
  }

  if (field.type === "password") {
    return (
      <div className="relative">
        <input
          type={reveal ? "text" : "password"}
          value={value}
          maxLength={field.maxLength}
          placeholder="••••••••"
          autoComplete="new-password"
          onChange={(e) => onChange(e.target.value)}
          className={cn(control, "pr-12", ring)}
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          aria-label={reveal ? "Hide value" : "Show value"}
          className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:text-white"
        >
          {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  }

  return (
    <Input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
      value={value}
      min={field.min}
      max={field.max}
      step={field.step}
      maxLength={field.maxLength}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(ring)}
    />
  );
}

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const { push } = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial as unknown as Record<string, unknown>));
  const [original, setOriginal] = useState<Draft>(() => toDraft(initial as unknown as Record<string, unknown>));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(SETTINGS_SECTIONS[0].id);
  const [filter, setFilter] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const changed = useMemo(() => {
    const c: Record<string, boolean> = {};
    for (const k of Object.keys(draft)) if (draft[k] !== original[k]) c[k] = true;
    return c;
  }, [draft, original]);
  const changedKeys = Object.keys(changed);
  const dirty = changedKeys.length > 0;

  const set = useCallback((key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }, []);

  const discard = useCallback(() => {
    setDraft(original);
    setErrors({});
    push("Changes discarded", "info");
  }, [original, push]);

  const validate = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    for (const f of ALL_FIELDS) {
      const key = f.key as string;
      const v = draft[key] ?? "";
      if (f.required && !v.trim()) {
        e[key] = `${f.label} is required`;
        continue;
      }
      if (f.maxLength && v.length > f.maxLength) {
        e[key] = `${f.label} must be ${f.maxLength} characters or fewer`;
        continue;
      }
      if (v.trim() === "") continue;
      if (f.type === "number" || f.type === "slider") {
        const n = Number(v);
        if (!Number.isFinite(n)) {
          e[key] = `${f.label} must be a number`;
          continue;
        }
        if (f.min !== undefined && n < f.min) e[key] = `${f.label} must be at least ${f.min}`;
        else if (f.max !== undefined && n > f.max) e[key] = `${f.label} must be at most ${f.max}`;
      } else if (f.type === "url" && !/^https?:\/\//i.test(v)) {
        e[key] = `${f.label} must start with http:// or https://`;
      } else if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        e[key] = `${f.label} must be a valid date`;
      }
    }
    const min = Number(draft.min_withdraw);
    const max = Number(draft.max_withdraw);
    if (Number.isFinite(min) && Number.isFinite(max) && max < min) {
      e.max_withdraw = "Max withdrawal must be at least the minimum.";
    }
    return e;
  }, [draft]);

  const save = useCallback(async () => {
    const clientErrors = validate();
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      const bad = SETTINGS_SECTIONS.find((s) => s.fields.some((f) => clientErrors[f.key as string]));
      if (bad) setActive(bad.id);
      push("Some fields need attention", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = await res.json();
      if (!j.ok) {
        if (j.errors) {
          setErrors(j.errors as Record<string, string>);
          const bad = SETTINGS_SECTIONS.find((s) => s.fields.some((f) => (j.errors as Record<string, string>)[f.key as string]));
          if (bad) setActive(bad.id);
        }
        push(j.error ?? "Save failed", "error");
        return;
      }
      const next = toDraft((j.settings ?? draft) as Record<string, unknown>);
      setDraft(next);
      setOriginal(next);
      setErrors({});
      setSavedAt(new Date().toLocaleTimeString());
      push("Settings saved", "success");
    } catch {
      push("Save failed", "error");
    } finally {
      setSaving(false);
    }
  }, [draft, push, validate]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !saving) void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, saving, save]);

  const q = filter.trim().toLowerCase();
  const shown = q
    ? SETTINGS_SECTIONS.map((s) => ({
        ...s,
        fields: s.fields.filter(
          (f) => f.label.toLowerCase().includes(q) || String(f.key).toLowerCase().includes(q)
        ),
      })).filter((s) => s.fields.length)
    : [SETTINGS_SECTIONS.find((s) => s.id === active) ?? SETTINGS_SECTIONS[0]];

  const matches = shown.reduce((n, s) => n + s.fields.length, 0);

  return (
    <div className="space-y-6">
      <div className="panel sticky top-14 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 backdrop-blur">
        <AdminPageHeader
          title="Site settings"
          description={
            <>
              {dirty
                ? `${changedKeys.length} unsaved change${changedKeys.length === 1 ? "" : "s"}`
                : savedAt
                  ? `Saved at ${savedAt}`
                  : "All changes saved"}
              {" · "}
              <kbd className="rounded border border-slate-700 px-1 font-sans text-[10px] text-slate-400">Ctrl</kbd>
              {"+"}
              <kbd className="rounded border border-slate-700 px-1 font-sans text-[10px] text-slate-400">S</kbd> to save
            </>
          }
        />
        <div className="flex items-center gap-2">
          {dirty && <Badge variant="gold">unsaved</Badge>}
          <Button variant="secondary" onClick={discard} disabled={!dirty || saving}>
            <RotateCcw size={15} /> Discard
          </Button>
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Saving
              </>
            ) : (
              <>
                <Save size={15} /> Save changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <aside className="space-y-4">
          <label className="relative block">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter settings"
              className="pl-9"
              aria-label="Filter settings"
            />
          </label>
          <nav className="flex flex-col gap-1">
            {SETTINGS_SECTIONS.map((s) => {
              const count = s.fields.filter((f) => changed[f.key as string]).length;
              const isActive = !q && active === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setFilter("");
                    setActive(s.id);
                  }}
                  className={cn(
                    "tap flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors",
                    isActive ? "bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/40" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span>{s.title}</span>
                  {count > 0 && <span className="font-mono text-xs text-gold-300">{count}</span>}
                </button>
              );
            })}
          </nav>

          <div className="panel rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-400">Live preview</p>
            <p className="font-display mt-2 truncate text-lg font-bold text-white">
              {draft.sitename || "Site name"}
            </p>
            <p className="truncate text-xs text-slate-400">{draft.siteslogan || "Tagline"}</p>
            <p className="font-mono mt-3 text-sm tabular-nums text-gold-300">
              {draft.currency_symbol}
              {(0).toFixed(Math.min(18, Math.max(0, Number(draft.currency_decimals) || 0)))}{" "}
              {draft.currency_code}
            </p>
            <span className="mt-3 inline-flex h-9 items-center rounded-lg bg-gold-500 px-3 font-display text-xs font-bold text-ink-950">
              Claim free hashrate
            </span>
          </div>
        </aside>

        <div className="space-y-5">
          {shown.length === 0 ? (
            <div className="panel rounded-2xl p-8 text-center text-sm text-slate-400">
              No settings match &ldquo;{filter}&rdquo;.
            </div>
          ) : (
            shown.map((section) => (
              <section key={section.id} className="panel animate-fade-in rounded-3xl p-6">
                <div className="mb-5">
                  <h2 className="font-display text-lg font-bold text-white">{section.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{section.blurb}</p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  {section.fields.map((f) => {
                    const key = f.key as string;
                    const wide = f.type === "textarea" || f.type === "slider" || f.type === "segmented";
                    return (
                      <div key={key} className={cn(wide && "sm:col-span-2")}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <Label htmlFor={`f-${key}`} className="mb-0">
                            {f.label}
                          </Label>
                          {changed[key] && <Badge variant="gold">changed</Badge>}
                        </div>
                        <SettingsControl field={f} value={draft[key] ?? ""} error={errors[key]} onChange={(v) => set(key, v)} />
                        {f.help && !errors[key] && <p className="mt-1.5 text-xs text-slate-400">{f.help}</p>}
                        <FieldError msg={errors[key]} />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}

          {q && <p className="text-center text-xs text-slate-400">{matches} match{matches === 1 ? "" : "es"}</p>}

          {!q && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Check size={13} className="text-emerald-400" />
              Secrets such as SMTP credentials stay in Vercel environment variables, never in the database.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
