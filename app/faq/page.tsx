import Link from "next/link";
import { getCachedFaqs } from "@/lib/catalog";
import { FaqList } from "@/components/faq-list";

export const revalidate = 300;

const FALLBACK_FAQS = [
  { id: -1, question: "Is the free plan really free?", answer: "<p>Yes. The starter plan activates when you create an account. It needs no card and no payment. The current daily credit is shown on the plan card.</p>" },
  { id: -2, question: "How does crypto payment work?", answer: "<p>Pick a coin and create an invoice. Send the exact amount shown to the deposit address. The miner activates after the network confirms the payment.</p>" },
  { id: -3, question: "When does my miner activate?", answer: "<p>After the payment reaches the required confirmations. The invoice page updates automatically, and the credit lands in your balance.</p>" },
  { id: -4, question: "When can I withdraw?", answer: "<p>When your balance meets the minimum shown on the withdrawal page. Withdrawals are reviewed and paid by hand.</p>" },
  { id: -5, question: "What happens if I send the wrong coin or amount?", answer: "<p>The payment may not be credited. Send only the selected coin on the correct network, and send the exact amount. If you make a mistake, contact support with the transaction id.</p>" },
  { id: -6, question: "Is the projected yield guaranteed?", answer: "<p>No. The projection uses the plan published daily rate for its full term. It is not a market forecast or a guarantee.</p>" },
];

export default async function FaqPage() {
  const faqs = await getCachedFaqs();
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8 sm:py-12">
      <div>
        <h1 className="font-display text-3xl font-bold text-white sm:text-5xl">Questions, answered</h1>
        <p className="mt-3 text-slate-400">
          Still stuck? <Link href="/contact" className="font-semibold text-gold-300 hover:text-gold-400">Talk to us</Link>
        </p>
      </div>
      <FaqList faqs={faqs.length ? faqs : FALLBACK_FAQS} />
    </div>
  );
}
