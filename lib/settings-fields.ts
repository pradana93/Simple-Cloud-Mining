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
    id: "payments",
    title: "Payments",
    blurb: "CoinPayments mode and network confirmations.",
    fields: [
      { key: "coin_mode", label: "Checkout mode", type: "segmented", options: [{ value: "gateway", label: "Gateway" }, { value: "api", label: "API" }] },
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
