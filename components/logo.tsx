export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Simple Cloud Mining">
      <defs>
        <linearGradient id="logo-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#logo-gold)" />
      {/* hash mark: hashrate */}
      <path
        d="M16 10 L13.5 30 M26 10 L23.5 30 M9.5 16.5 H30.5 M9 23.5 H30"
        stroke="#070a10"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
