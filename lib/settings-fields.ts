import type { SiteSettings } from "./types";

// Single source of truth for the settings editor and its server-side validation.

export type SettingsFieldType =
  | "text"
  | "textarea"
  | "number"
  | "slider"
  | "select"
  | "segmented"
  | "password"
  | "date"
  | "switch"
  | "url";

export type SettingsField = {
  key: keyof SiteSettings;
  label: string;
  type: SettingsFieldType;
  help?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  required?: boolean;
  integer?: boolean;
  nullable?: boolean;
  boolean?: boolean;
};

export type SettingsSection = {
  id: string;
  title: string;
  blurb: string;
  fields: SettingsField[];
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "brand",
    title: "Brand",
    blurb: "Name, tagline and metadata shown across the site and search results.",
    fields: [
      { key: "sitename", label: "Site name", type: "text", required: true, maxLength: 191 },
      { key: "siteslogan", label: "Tagline", type: "text", maxLength: 191 },
      { key: "keywords", label: "Keywords", type: "text", maxLength: 191, help: "Comma separated." },
      { key: "description", label: "Meta description", type: "textarea", maxLength: 191 },
      { key: "theme", label: "Theme", type: "select", options: [{ value: "dogeminer", label: "Doge miner (dark)" }] },
      { key: "default_theme", label: "Default appearance", type: "segmented", options: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }], help: "First-visit appearance. Members can switch any time." },
    ],
  },
  {
    id: "currency",
    title: "Currency",
    blurb: "How balances and payouts read to members.",
    fields: [
      { key: "currency_name", label: "Currency name", type: "text", required: true, maxLength: 191 },
      { key: "currency_symbol", label: "Symbol", type: "text", maxLength: 10 },
      { key: "currency_code", label: "Code", type: "text", required: true, maxLength: 10 },
      { key: "currency_decimals", label: "Decimals", type: "slider", min: 0, max: 18, step: 1, integer: true },
      { key: "fiat_enabled", label: "Fiat display", type: "switch", boolean: true, help: "Let members switch balances and prices to fiat, converted at a live rate." },
      { key: "fiat_currency", label: "Default fiat", type: "text", maxLength: 3, help: "Fallback display currency, ISO code such as USD. Visitors are auto-matched to their local currency." },
      { key: "price_currency", label: "Plan price currency", type: "text", maxLength: 3, help: "Currency plan prices are set and charged in, for example USD." },
      { key: "coin_cur1", label: "Coin paid in", type: "text", maxLength: 20 },
      { key: "coin_cur2", label: "Coin paid out", type: "text", maxLength: 20 },
    ],
  },
  {
    id: "limits",
    title: "Limits & rewards",
    blurb: "Withdrawal bounds, affiliate rate and invoice throttle.",
    fields: [
      { key: "min_withdraw", label: "Min withdrawal", type: "number", min: 0, step: 0.00000001 },
      { key: "max_withdraw", label: "Max withdrawal", type: "number", min: 0, step: 0.00000001 },
      { key: "aff_comission", label: "Affiliate commission", type: "slider", min: 0, max: 100, step: 1, integer: true, help: "Percent credited to referrers." },
      { key: "max_pending_transactions", label: "Max pending invoices", type: "slider", min: 1, max: 50, step: 1, integer: true },
      { key: "pagination", label: "Rows per page", type: "slider", min: 5, max: 100, step: 1, integer: true },
    ],
  },
  {
    id: "engagement",
    title: "Engagement",
    blurb: "Announcement banner and the daily check-in bonus.",
    fields: [
      { key: "announce_enabled", label: "Announcement banner", type: "switch", boolean: true, help: "Show a dismissible banner above the header." },
      { key: "announce_text", label: "Banner message", type: "textarea", maxLength: 280, nullable: true },
      { key: "announce_link", label: "Banner link", type: "url", maxLength: 191, nullable: true },
      { key: "checkin_enabled", label: "Daily check-in", type: "switch", boolean: true, help: "Let members claim a small bonus once a day." },
      { key: "checkin_amount", label: "Check-in bonus", type: "number", min: 0, step: 0.00000001, help: "Credited in the site currency each claim." },
    ],
  },
  {
    id: "casino",
    title: "Casino",
    blurb: "Provably fair games members play with their balance.",
    fields: [
      { key: "games_enabled", label: "Casino", type: "switch", boolean: true, help: "Open the games lobby. Off hides every game and closes the bet API." },
      { key: "games_min_bet", label: "Minimum bet", type: "number", min: 0, step: 0.00000001, help: "Smallest stake per round, in the site currency. 0 disables the floor." },
      { key: "games_max_bet", label: "Maximum bet", type: "number", min: 0, step: 0.00000001, help: "Largest stake per round, in the site currency. 0 disables the cap." },
      { key: "games_edge_boost", label: "Extra house edge", type: "slider", min: 0, max: 50, step: 1, help: "Percent trimmed from every payout. 0 is the game's own edge. Outcomes stay provably fair; only the paid amount changes." },
      { key: "games_max_win", label: "Max win", type: "number", min: 0, step: 0.00000001, help: "Ceiling on a single payout, in the site currency. 0 leaves wins uncapped." },
      { key: "games_disabled", label: "Disabled games", type: "text", maxLength: 191, help: "Comma separated ids to hide and close, for example crash,plinko. Empty turns nothing off." },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    blurb: "CoinPayments mode and network confirmations.",
    fields: [
      { key: "coin_mode", label: "Checkout mode", type: "segmented", options: [{ value: "gateway", label: "Gateway" }, { value: "api", label: "API" }] },
      { key: "pay_coins", label: "Buyer coin options", type: "text", maxLength: 191, help: "Comma separated coins the buyer can pick at checkout, for example BTC,DOGE,LTC." },
      { key: "coin_email", label: "Buyer email", type: "segmented", options: [{ value: "user", label: "Member" }, { value: "admin", label: "Admin" }] },
      { key: "blockchain", label: "Confirmations", type: "slider", min: 0, max: 12, step: 1, integer: true },
    ],
  },
  {
    id: "wallets",
    title: "Wallet & launch",
    blurb: "Payout wallet bounds and the launch countdown.",
    fields: [
      { key: "wallet_min", label: "Wallet min", type: "number", min: 0, integer: true },
      { key: "wallet_max", label: "Wallet max", type: "number", min: 0, integer: true },
      { key: "show_start_date", label: "Show launch countdown", type: "switch" },
      { key: "start_date", label: "Launch date", type: "date", nullable: true },
      { key: "start_date_increment", label: "Countdown increment (days)", type: "number", min: 0, integer: true },
    ],
  },
  {
    id: "automation",
    title: "Automation",
    blurb: "Optional auto-payout for small, allowlisted withdrawals.",
    fields: [
      { key: "auto_payout_enabled", label: "Auto-payout", type: "switch", boolean: true, help: "Send approved requests automatically when the wallet API is configured." },
      { key: "auto_payout_max", label: "Auto-payout ceiling", type: "number", min: 0, step: 0.00000001, help: "Only requests at or below this amount are sent automatically. 0 disables the ceiling." },
    ],
  },
  {
    id: "smtp",
    title: "Email",
    blurb: "Outbound mail for receipts and notifications.",
    fields: [
      { key: "smtp_host", label: "SMTP host", type: "text", maxLength: 191, nullable: true },
      { key: "smtp_user", label: "SMTP user", type: "text", maxLength: 191, nullable: true },
      { key: "smtp_pass", label: "SMTP password", type: "password", maxLength: 191, nullable: true, help: "Leave blank to keep the current value." },
      { key: "smtp_port", label: "Port", type: "number", min: 1, max: 65535, integer: true, nullable: true },
      { key: "smtp_secure", label: "Encryption", type: "select", options: [{ value: "null", label: "None" }, { value: "tls", label: "TLS" }, { value: "ssl", label: "SSL" }] },
      { key: "smtp_sender", label: "From address", type: "text", maxLength: 191, nullable: true },
    ],
  },
  {
    id: "social",
    title: "Social",
    blurb: "Links surfaced in the footer and contact page.",
    fields: [
      { key: "facebook", label: "Facebook", type: "url", maxLength: 191, nullable: true },
      { key: "telegram", label: "Telegram", type: "url", maxLength: 191, nullable: true },
      { key: "twitter", label: "Twitter / X", type: "url", maxLength: 191, nullable: true },
      { key: "vk", label: "VK", type: "url", maxLength: 191, nullable: true },
    ],
  },
  {
    id: "code",
    title: "Custom code",
    blurb: "Injected into the document head and before the closing body tag.",
    fields: [
      { key: "header_codes", label: "Header code", type: "textarea", nullable: true },
      { key: "footer_codes", label: "Footer code", type: "textarea", nullable: true },
    ],
  },
];

export const ALL_FIELDS: SettingsField[] = SETTINGS_SECTIONS.flatMap((s) => s.fields);
