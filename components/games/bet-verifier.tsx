"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCrypto } from "@/lib/utils";
import { gameMeta } from "@/lib/games/registry";
import { verifyBet, type VerifiableBet, type VerifyOutcome } from "@/lib/games/verify";
import { SeedManager } from "./seed-manager";
import type { SeedView } from "./types";

const FIELD_CLASS =
  "h-11 w-full rounded-xl border border-slate-700/80 bg-ink-900/80 px-3 text-sm text-slate-100 focus:border-gold-500/70 focus:outline-none focus:ring-2 focus:ring-gold-500/25";

type LoadState = "loading" | "ready" | "error";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function valueLabel(value: unknown): string {
  if (value === null || value === undefined) return "empty";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "empty list";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function gameName(id: string): string {
  return gameMeta(id)?.name ?? id;
}

function VerificationResult({ outcome }: { outcome: VerifyOutcome }) {
  if (outcome.matched) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 ring-1 ring-emerald-500/30"
      >
        <p className="flex items-center gap-2 font-display font-bold text-emerald-200">
          <CheckCircle2 size={16} /> Verified
        </p>
        <p className="mt-1">The committed seed reproduces the recorded round.</p>
        {outcome.note && <p className="mt-1 text-xs text-emerald-100/80">{outcome.note}</p>}
        {outcome.recomputed && (
          <details className="mt-3">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs font-semibold text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400">
              Recomputed evidence
            </summary>
            <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-ink-950/70 p-3 font-mono text-[11px] text-slate-300 ring-1 ring-white/5">
              {JSON.stringify(outcome.recomputed, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  }

  const title = !outcome.seedHashMatched
    ? "Seed does not match"
    : outcome.mismatches.length > 0
      ? "Not verified"
      : "Round could not be checked";

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-100 ring-1 ring-red-500/30"
    >
      <p className="flex items-center gap-2 font-display font-bold text-red-200">
        <AlertTriangle size={16} /> {title}
      </p>
      {outcome.error && <p className="mt-1 break-words text-red-100">{outcome.error}</p>}
      {outcome.mismatches.length > 0 && (
        <ul className="mt-2 space-y-2">
          {outcome.mismatches.map((m, i) => (
            <li key={`${m.field}-${i}`} className="rounded-lg bg-ink-950/60 px-3 py-2">
              <p className="font-mono text-[11px] text-red-200">{m.field}</p>
              <p className="mt-1 break-words text-xs text-slate-300">
                Recorded: {valueLabel(m.recorded)}
              </p>
              <p className="break-words text-xs text-slate-300">
                Recomputed: {valueLabel(m.recomputed)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {outcome.recomputed && (
        <details className="mt-3">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs font-semibold text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400">
            Recomputed evidence
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-ink-950/70 p-3 font-mono text-[11px] text-slate-300 ring-1 ring-white/5">
            {JSON.stringify(outcome.recomputed, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

export function BetVerifier({
  symbol,
  decimals,
  gamesOpen,
  initialBetKey,
  initialGame,
}: {
  symbol: string;
  decimals: number;
  gamesOpen: boolean;
  initialBetKey?: string;
  initialGame?: string;
}) {
  const [bets, setBets] = useState<VerifiableBet[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seed, setSeed] = useState<SeedView | null>(null);
  const [seedState, setSeedState] = useState<LoadState>("loading");
  const [selectedKey, setSelectedKey] = useState<string | null>(initialBetKey ?? null);
  const [filter, setFilter] = useState(initialGame && initialGame !== "all" ? initialGame : "all");
  const [serverSeed, setServerSeed] = useState("");
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);
  const [verifying, setVerifying] = useState(false);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const initialised = useRef(false);
  const shouldScroll = useRef(false);

  const fmt = useMemo(() => (v: number) => formatCrypto(v, decimals), [decimals]);
  const selected = useMemo(
    () => bets.find((b) => b.key === selectedKey) ?? null,
    [bets, selectedKey]
  );
  const knownSeed = useMemo(() => {
    if (!selected) return "";
    if (selected.revealedServerSeed) return selected.revealedServerSeed;
    if (seed?.previous?.serverSeedHash === selected.serverSeedHash) return seed.previous.serverSeed;
    return "";
  }, [selected, seed]);
  const activeSeed = Boolean(selected && seed?.serverSeedHash === selected.serverSeedHash);
  const selectedGame = selected ? gameName(selected.game) : "";

  const loadBets = useCallback(async () => {
    setLoadState((state) => (state === "ready" ? state : "loading"));
    try {
      const res = await fetch("/api/games/verify");
      const j = (await res.json()) as { ok: boolean; bets?: VerifiableBet[]; error?: string };
      if (!j.ok || !j.bets) {
        setLoadError(j.error || "Could not load settled rounds.");
        setLoadState("error");
        return;
      }
      setBets(j.bets);
      setLoadError(null);
      setLoadState("ready");
    } catch {
      setLoadError("Could not load settled rounds.");
      setLoadState("error");
    }
  }, []);

  const loadSeed = useCallback(async () => {
    setSeedState((state) => (state === "ready" ? state : "loading"));
    try {
      const res = await fetch("/api/games/seed");
      const j = (await res.json()) as { ok: boolean; seed?: SeedView };
      if (j.ok && j.seed) {
        setSeed(j.seed);
        setSeedState("ready");
      } else {
        setSeedState("error");
      }
    } catch {
      setSeedState("error");
    }
  }, []);

  useEffect(() => {
    void loadBets();
    void loadSeed();
  }, [loadBets, loadSeed]);

  useEffect(() => {
    setServerSeed(knownSeed);
    setOutcome(null);
  }, [selected?.key, knownSeed]);

  useEffect(() => {
    if (initialised.current || loadState !== "ready") return;
    initialised.current = true;
    const wanted = initialBetKey
      ? bets.find((b) => b.key === initialBetKey)
      : initialGame && initialGame !== "all"
        ? bets.find((b) => b.game === initialGame)
        : null;
    if (wanted) {
      shouldScroll.current = true;
      setSelectedKey(wanted.key);
    }
  }, [bets, loadState, initialBetKey, initialGame]);

  useEffect(() => {
    if (!shouldScroll.current || !selected) return;
    shouldScroll.current = false;
    if (window.matchMedia("(max-width: 1023px)").matches) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedKey, selected, loadState]);

  const gameIds = useMemo(() => {
    const out: string[] = [];
    const seen: Record<string, boolean> = {};
    if (initialGame && initialGame !== "all" && !seen[initialGame]) {
      seen[initialGame] = true;
      out.push(initialGame);
    }
    for (let i = 0; i < bets.length; i++) {
      const id = bets[i].game;
      if (!seen[id]) {
        seen[id] = true;
        out.push(id);
      }
    }
    out.sort((a, b) => gameName(a).localeCompare(gameName(b)));
    return out;
  }, [bets, initialGame]);

  const filtered = useMemo(
    () => (filter === "all" ? bets : bets.filter((b) => b.game === filter)),
    [bets, filter]
  );

  const handleSeed = useCallback(
    (next: SeedView) => {
      setSeed(next);
      void loadBets();
    },
    [loadBets]
  );

  function changeFilter(next: string) {
    setFilter(next);
    if (next !== "all" && selected && selected.game !== next) setSelectedKey(null);
  }

  function selectBet(key: string) {
    shouldScroll.current = true;
    setSelectedKey(key);
  }

  async function check() {
    if (!selected || !serverSeed.trim() || verifying) return;
    setVerifying(true);
    setOutcome(null);
    try {
      setOutcome(await verifyBet(selected, serverSeed));
    } catch {
      setOutcome({
        seedHashMatched: false,
        matched: false,
        recomputed: null,
        mismatches: [],
        note: null,
        error: "Could not verify this round.",
      });
    } finally {
      setVerifying(false);
    }
  }

  const filterLabel = filter === "all" ? "all games" : gameName(filter);

  return (
    <div className="space-y-6" data-verifier>
      <SeedManager
        seed={seed}
        state={seedState}
        onSeed={handleSeed}
        onRetry={loadSeed}
        showVerify={false}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {selected ? (
            <div ref={detailRef} className="panel scroll-mt-24 rounded-2xl p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {selectedGame}
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-bold text-white">
                    Round #{selected.nonce}
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">{dayLabel(selected.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Recorded
                  </p>
                  <p className="font-display text-xl font-bold tabular-nums text-white">
                    {selected.multiplier.toFixed(2)}x
                  </p>
                  <p
                    className={cn(
                      "font-mono text-xs tabular-nums",
                      selected.won ? "text-emerald-300" : "text-slate-400"
                    )}
                  >
                    {selected.won
                      ? `+${fmt(selected.payout)} ${symbol}`
                      : `-${fmt(selected.stake)} ${symbol}`}
                  </p>
                </div>
              </div>

              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold text-slate-400">Committed server seed hash</dt>
                  <dd className="mt-1 break-all rounded-xl bg-ink-900/80 px-3 py-2 font-mono text-[11px] text-slate-300 ring-1 ring-white/5">
                    {selected.serverSeedHash}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-400">Client seed</dt>
                  <dd className="mt-1 break-all rounded-xl bg-ink-900/80 px-3 py-2 font-mono text-[11px] text-slate-300 ring-1 ring-white/5">
                    {selected.clientSeed}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs font-semibold text-slate-400">Nonce</dt>
                    <dd className="mt-1 rounded-xl bg-ink-900/80 px-3 py-2 font-mono text-[11px] text-slate-300 ring-1 ring-white/5">
                      {selected.nonce}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-400">Stake</dt>
                    <dd className="mt-1 rounded-xl bg-ink-900/80 px-3 py-2 font-mono text-[11px] text-slate-300 ring-1 ring-white/5">
                      {fmt(selected.stake)} {symbol}
                    </dd>
                  </div>
                </div>
              </dl>

              <div className="mt-5">
                <label
                  htmlFor="verify-server-seed"
                  className="mb-1.5 block text-sm font-semibold text-slate-300"
                >
                  Revealed server seed
                </label>
                <input
                  id="verify-server-seed"
                  value={serverSeed}
                  onChange={(e) => {
                    setServerSeed(e.target.value);
                    setOutcome(null);
                  }}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Paste the 64-character seed for this round"
                  className={cn(FIELD_CLASS, "font-mono text-xs")}
                />
                <p className="mt-1 text-xs text-slate-400">
                  {selected.revealedServerSeed
                    ? "Filled from your seed archive."
                    : knownSeed
                      ? "Filled from your previous server seed."
                      : "This seed is not in your archive. Paste the seed you saved for this round."}
                </p>
              </div>

              {activeSeed && !serverSeed && (
                <p className="mt-3 rounded-lg bg-gold-500/10 px-3 py-2 text-xs text-gold-100 ring-1 ring-gold-500/30">
                  This round used your current server seed. Rotate the seed above to reveal it, or paste the
                  seed if you saved it.
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={check} disabled={!serverSeed.trim() || verifying}>
                  {verifying ? <Loader2 className="animate-spin" size={16} /> : "Verify round"}
                </Button>
                <span className="text-xs text-slate-400">
                  The seed is checked in your browser. It is not sent back to the site.
                </span>
              </div>

              {outcome && <VerificationResult outcome={outcome} />}
            </div>
          ) : bets.length > 0 ? (
            <div className="panel rounded-2xl p-6">
              <h2 className="font-display text-lg font-bold text-white">Choose a round</h2>
              <p className="mt-2 text-sm text-slate-400">
                Pick a settled round from the list. The verifier shows the committed hash and recomputes
                the result from the revealed seed.
              </p>
            </div>
          ) : null}

          <div className="panel rounded-2xl p-5 text-sm text-slate-400">
            <h2 className="font-display text-sm font-bold text-white">How the check works</h2>
            <p className="mt-2">
              The server commits a SHA-256 hash before play. Each result comes from
              HMAC-SHA256(server seed, <code className="font-mono text-xs text-slate-300">client seed:nonce:cursor</code>).
              Each four-byte block becomes a float in [0,1), and the game math maps those floats to the
              recorded outcome.
            </p>
            <p className="mt-2 text-xs">
              The paid multiplier is shown separately. Site edge, tiers, and win caps can change the
              payout without changing the seed-derived outcome.
            </p>
          </div>
        </div>

        <aside className="order-first space-y-4 lg:order-none">
          <div className="panel rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-white">Settled rounds</h2>
              <span className="text-xs text-slate-400">{bets.length} recent</span>
            </div>

            <label
              htmlFor="verify-game-filter"
              className="mb-1.5 mt-4 block text-xs font-semibold text-slate-300"
            >
              Game
            </label>
            <select
              id="verify-game-filter"
              value={filter}
              onChange={(e) => changeFilter(e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="all">All games</option>
              {gameIds.map((id) => (
                <option key={id} value={id}>
                  {gameName(id)}
                </option>
              ))}
            </select>

            {loadState === "error" && (
              <div role="status" className="mt-3 rounded-lg bg-red-500/10 px-3 py-3 ring-1 ring-red-500/30">
                <p className="text-xs text-red-200">{loadError}</p>
                <button
                  type="button"
                  onClick={() => void loadBets()}
                  className="tap mt-2 inline-flex h-11 items-center rounded-lg border border-red-500/30 px-4 text-xs font-semibold text-red-100 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                  Retry
                </button>
              </div>
            )}

            {loadState === "loading" && bets.length === 0 && (
              <p className="mt-3 rounded-lg border border-dashed border-slate-800 px-3 py-4 text-xs text-slate-400">
                Loading settled rounds.
              </p>
            )}

            {loadState === "ready" && bets.length === 0 && (
              <div className="mt-3 rounded-lg border border-dashed border-slate-800 px-3 py-4 text-xs text-slate-400">
                <p>No settled rounds yet. Play a round, then it appears here.</p>
                {gamesOpen && (
                  <Link
                    href="/games"
                    className="tap mt-2 inline-flex h-11 items-center font-semibold text-gold-300 underline underline-offset-2 hover:text-gold-200"
                  >
                    Open games
                  </Link>
                )}
              </div>
            )}

            {bets.length > 0 && filtered.length === 0 && (
              <div className="mt-3 rounded-lg border border-dashed border-slate-800 px-3 py-4 text-xs text-slate-400">
                <p>No settled {filterLabel} rounds yet.</p>
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="tap mt-2 inline-flex h-11 items-center font-semibold text-gold-300 underline underline-offset-2 hover:text-gold-200"
                >
                  Show all games
                </button>
              </div>
            )}

            {filtered.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {filtered.map((b) => {
                  const active = b.key === selectedKey;
                  return (
                    <li key={b.key}>
                      <button
                        type="button"
                        onClick={() => selectBet(b.key)}
                        aria-pressed={active}
                        className={cn(
                          "tap w-full rounded-lg px-3 py-2 text-left text-xs ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400",
                          active
                            ? "bg-gold-500/10 ring-gold-500/30"
                            : "bg-ink-900/60 ring-white/5 hover:bg-ink-800"
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-slate-200">
                            {gameName(b.game)}
                          </span>
                          <span
                            className={cn(
                              "font-display font-bold tabular-nums",
                              b.won ? "text-emerald-300" : "text-slate-400"
                            )}
                          >
                            {b.multiplier.toFixed(2)}x
                          </span>
                        </span>
                        <span className="mt-1 flex items-center justify-between gap-2 text-slate-400">
                          <span className="truncate">#{b.nonce} · {dayLabel(b.createdAt)}</span>
                          <span className={cn("font-mono tabular-nums", b.won ? "text-emerald-300" : "text-slate-400")}>
                            {b.won ? `+${fmt(b.payout)}` : `-${fmt(b.stake)}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
