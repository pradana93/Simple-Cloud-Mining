import { getCachedPayouts, getCachedSettings, getCachedStats } from "@/lib/catalog";
import { getMoneyCfg } from "@/lib/currency";
import { moneyUnit } from "@/lib/money";
import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";
import { PayoutFeed } from "@/components/payout-feed";

export const revalidate = 30;

export default async function PayoutsPage() {
  const [s, { deposits, withdrawals }, stats] = await Promise.all([
    getCachedSettings(),
    getCachedPayouts(),
    getCachedStats(),
  ]);
  const cfg = await getMoneyCfg();
  return (
    <div className="space-y-8 py-8 sm:py-10">
      <Reveal>
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-bold text-white sm:text-5xl">Payout history</h1>
          <p className="mt-3 text-slate-400">
            Deposits and withdrawal requests, with their current status.{" "}
            {stats.totalPaid > 0 ? (
              <>
                <span className="font-semibold text-gold-300">
                  <CountUp value={stats.totalPaid} decimals={s.currency_decimals} cfg={cfg} />{" "}
                  {moneyUnit(cfg)}
                </span>{" "}
                completed payouts so far.
              </>
            ) : (
              "No completed payouts yet."
            )}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Withdrawals are reviewed and paid by hand. Canceled requests stay visible for
            transparency, but they are not counted as paid.
          </p>
        </div>
      </Reveal>
      <Reveal delay={80}>
        <div className="space-y-3">
          <PayoutFeed
            deposits={deposits}
            withdrawals={withdrawals}
            currencyCode={s.currency_code}
            decimals={s.currency_decimals}
            cfg={cfg}
          />
          <p className="text-xs leading-relaxed text-slate-400">
            Paid means the withdrawal was completed. Pending review means it is waiting for manual
            approval. Canceled means the amount was returned to the member and is not counted as a
            payout.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
