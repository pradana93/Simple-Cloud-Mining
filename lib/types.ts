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
  address: string | null;
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

export type ChatSender = "user" | "admin";

export type ChatMessage = {
  id: number;
  sender: ChatSender;
  body: string;
  created_at: string;
  read_by_user?: boolean;
};

export type ChatThread = {
  userId: string;
  username: string;
  lastBody: string;
  lastSender: ChatSender;
  lastAt: string;
  unread: number;
};

export type SiteSettings = {
  id: number;
  sitename: string;
  siteslogan: string;
  keywords: string;
  description: string;
  pagination: number;
  max_pending_transactions: number;
  min_withdraw: number;
  max_withdraw: number;
  aff_comission: number;
  currency_name: string;
  currency_symbol: string;
  currency_code: string;
  currency_decimals: number;
  fiat_enabled: boolean;
  fiat_currency: string;
  price_currency: string;
  coin_cur1: string;
  coin_cur2: string;
  smtp_host: string | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  smtp_port: number | null;
  smtp_secure: "null" | "tls" | "ssl";
  smtp_sender: string | null;
  facebook: string | null;
  telegram: string | null;
  twitter: string | null;
  vk: string | null;
  wallet_min: number;
  wallet_max: number;
  blockchain: number;
  theme: string;
  start_date: string | null;
  show_start_date: "yes" | "no";
  start_date_increment: number;
  header_codes: string | null;
  footer_codes: string | null;
  announce_enabled: boolean;
  announce_text: string | null;
  announce_link: string | null;
  checkin_enabled: boolean;
  checkin_amount: number;
  pay_coins: string;
  default_theme: string;
  games_enabled: boolean;
  games_min_bet: number;
  games_max_bet: number;
  games_edge_boost: number;
  games_max_win: number;
  games_disabled: string;
  games_config: Record<string, unknown>;
  games_tiers: unknown[];
  games_schedule: Record<string, unknown>;
};
