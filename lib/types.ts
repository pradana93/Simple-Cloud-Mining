export type Plan = {
  id: number;
  plan_name: string;
  is_default: boolean;
  point_per_day: number | null;
  version: string | null;
  earning_rate: number | null; // per-minute rate (legacy semantics)
  image: string;
  price: number;
  duration: number; // days
  profit: string | null;
  speed: string;
};

export type Profile = {
  id: string; // auth.users uuid
  username: string;
  email: string | null;
  unique_id: number;
  balance: number;
  cashouts: number;
  reference_user_id: string | null;
  affiliate_earns: number;
  affiliate_paid: number;
  is_admin: boolean;
  created_at: string;
};

export type UserPlan = {
  id: number;
  user_id: string;
  plan_id: number;
  status: "active" | "inactive";
  created_at: string;
  expire_date: string | null;
  last_sum: string | null;
  plan?: Plan;
};

export type TransactionRow = {
  id: number;
  user_id: string;
  plan_id: number;
  amount: number;
  paid_amount: number | null;
  status: "pending" | "waiting" | "paid" | "canceled";
  hash: string | null;
  txid: string | null;
  params: unknown | null;
  date: string;
};

export type WithdrawalRow = {
  id: number;
  user_id: string;
  type: string;
  amount: number;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "CANCELED";
  tx: string | null;
  created_at: string;
  date_paid: string | null;
};

export type DepositRow = {
  id: number;
  user_id: string;
  amount: number;
  status: "PENDING" | "PROCESSING" | "SUCCESS";
  tx: string | null;
  created_at: string;
  date_paid: string | null;
};

// Loose Database typing for the migration (avoids supabase-js generic
// inference issues across 15+ tables). Replace with `supabase gen types`
// output for strictness later.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;

export type SiteSettings = {
  id: number;
  sitename: string;
  siteslogan: string;
  currency_name: string;
  currency_symbol: string;
  currency_code: string;
  currency_decimals: number;
  min_withdraw: number;
  max_withdraw: number;
  aff_comission: number;
  max_pending_transactions: number;
  coin_cur1: string;
  coin_cur2: string;
  coin_mode: "api" | "gateway";
  coin_email: "user" | "admin";
  theme: string;
};
