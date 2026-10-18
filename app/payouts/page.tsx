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
          <h1 className="font-display text-3xl font-bold text-white sm:text-5xl">Live payouts</h1>
          <p className="mt-3 text-slate-400">
            Every deposit and withdrawal, published as it lands.{" "}
            <span className="font-semibold text-gold-300">
              <CountUp value={stats.totalPaid} decimals={s.currency_decimals} cfg={cfg} /> {moneyUnit(cfg)}
            </span>{" "}
            paid out so far.
          </p>
        </div>
      </Reveal>
      <Reveal delay={80}>
        <PayoutFeed
          deposits={deposits}
          withdrawals={withdrawals}
          currencyCode={s.currency_code}
          decimals={s.currency_decimals}
          cfg={cfg}
        />
      </Reveal>
    </div>
  );
}
