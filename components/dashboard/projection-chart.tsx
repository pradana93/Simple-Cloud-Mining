import { formatCrypto } from "@/lib/utils";

// A straight projection of the balance at the current hashrate. It is a
// projection, not a record of past earnings (which are not stored per day).
export function ProjectionChart({
  start,
  perDay,
  days,
  decimals,
  target,
}: {
  start: number;
  perDay: number;
  days: number;
  decimals: number;
  target?: number | null;
}) {
  const W = 680;
  const H = 200;
  const padL = 64;
  const padR = 20;
  const padT = 18;
  const padB = 30;
  const bottom = H - padB;
  const end = start + perDay * days;

  const candidates = [start, end, target ?? start, 0];
  let yMax = Math.max(...candidates);
  let yMin = Math.min(...candidates);
  if (yMax === yMin) yMax = yMin + 1;
  const span = yMax - yMin || 1;
  yMax += span * 0.06;
  yMin = Math.max(0, yMin - span * 0.08);
  const range = yMax - yMin || 1;

  const x = (d: number) => padL + (d / days) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - yMin) / range) * (H - padT - padB);

  const line = `M ${x(0)} ${y(start)} L ${x(days)} ${y(end)}`;
  const area = `${line} L ${x(days)} ${bottom} L ${x(0)} ${bottom} Z`;
  const showTarget = target != null && target > yMin && target < yMax;
  const gridVals = [yMax, yMin + range / 2, yMin];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Projected ${days} day balance from ${formatCrypto(start, decimals)} to ${formatCrypto(end, decimals)}, at ${formatCrypto(perDay, decimals)} per day`}
    >
      <defs>
        <linearGradient id="projection-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5b301" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#f5b301" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="rgba(148,163,184,0.14)" />
          <text x={padL - 8} y={y(v) + 3} textAnchor="end" fontSize="10" className="fill-slate-500">
            {formatCrypto(v, decimals)}
          </text>
        </g>
      ))}

      {showTarget && (
        <g>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(target as number)}
            y2={y(target as number)}
            stroke="rgba(16,185,129,0.55)"
            strokeDasharray="4 4"
          />
          <text x={W - padR} y={y(target as number) - 6} textAnchor="end" fontSize="10" className="fill-emerald-300">
            withdrawals unlock
          </text>
        </g>
      )}

      <path d={area} fill="url(#projection-fill)" />
      <path d={line} fill="none" stroke="#f5b544" strokeWidth="2" />
      <circle cx={x(0)} cy={y(start)} r="3.5" fill="#f5b544" />

      <text x={x(0)} y={H - 10} fontSize="10" className="fill-slate-500">
        now
      </text>
      <text x={x(days / 2)} y={H - 10} textAnchor="middle" fontSize="10" className="fill-slate-500">
        +{Math.round(days / 2)}d
      </text>
      <text x={x(days)} y={H - 10} textAnchor="end" fontSize="10" className="fill-slate-500">
        +{days}d
      </text>
    </svg>
  );
}
