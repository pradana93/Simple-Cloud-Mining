import Link from "next/link";
import { getCachedFaqs } from "@/lib/catalog";
import { FaqList } from "@/components/faq-list";

export const revalidate = 300;

const FALLBACK_FAQS = [
  { id: -1, question: "How do I start mining?", answer: "<p>Create an account and the free miner starts hashing instantly.</p>" },
  { id: -2, question: "When do I get paid?", answer: "<p>Earnings accrue every minute. Withdraw anytime within the limits.</p>" },
  { id: -3, question: "How do upgrades work?", answer: "<p>Deploy a paid plan via CoinPayments — it activates automatically on confirmation.</p>" },
];

export default async function FaqPage() {
  const faqs = await getCachedFaqs();
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8 sm:py-12">
      <div className="text-center">
        <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-gold-400">Knowledge base</p>
        <h1 className="font-display mt-2 text-3xl font-bold text-white sm:text-5xl">Questions, answered</h1>
        <p className="mt-3 text-slate-400">
          Still stuck? <Link href="/contact" className="font-semibold text-gold-300 hover:text-gold-400">Talk to us →</Link>
        </p>
      </div>
      <FaqList faqs={faqs.length ? faqs : FALLBACK_FAQS} />
    </div>
  );
}
