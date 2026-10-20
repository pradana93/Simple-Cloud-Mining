export type AutoRule = "reset" | "increase";

export type AutoConfig = {
  rounds: string;
  stopProfit: string;
  stopLoss: string;
  onWin: AutoRule;
  winIncrease: string;
  onLoss: AutoRule;
  lossIncrease: string;
};

export type AutoPlan = {
  rounds: number;
  stopProfit: number;
  stopLoss: number;
  onWin: AutoRule;
  winIncrease: number;
  onLoss: AutoRule;
  lossIncrease: number;
};

export type AutoParse = { ok: true; plan: AutoPlan } | { ok: false; error: string };

export const AUTO_DEFAULTS: AutoConfig = {
  rounds: "10",
  stopProfit: "0",
  stopLoss: "0",
  onWin: "reset",
  winIncrease: "0",
  onLoss: "reset",
  lossIncrease: "0",
};

function readNumber(value: string): number {
  return value.trim() === "" ? NaN : Number(value);
}

export function parseAutoConfig(config: AutoConfig): AutoParse {
  const rounds = readNumber(config.rounds);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 100) {
    return { ok: false, error: "Number of bets must be a whole number from 1 to 100." };
  }

  const stopProfit = readNumber(config.stopProfit);
  if (!Number.isFinite(stopProfit) || stopProfit < 0) {
    return { ok: false, error: "Profit stop must be zero or more." };
  }

  const stopLoss = readNumber(config.stopLoss);
  if (!Number.isFinite(stopLoss) || stopLoss < 0) {
    return { ok: false, error: "Loss stop must be zero or more." };
  }

  const winIncrease = config.onWin === "increase" ? readNumber(config.winIncrease) : 0;
  if (config.onWin === "increase" && (!Number.isFinite(winIncrease) || winIncrease < 0 || winIncrease > 100)) {
    return { ok: false, error: "Win increase must be from 0 to 100 percent." };
  }

  const lossIncrease = config.onLoss === "increase" ? readNumber(config.lossIncrease) : 0;
  if (
    config.onLoss === "increase" &&
    (!Number.isFinite(lossIncrease) || lossIncrease < 0 || lossIncrease > 100)
  ) {
    return { ok: false, error: "Loss increase must be from 0 to 100 percent." };
  }

  return {
    ok: true,
    plan: {
      rounds,
      stopProfit,
      stopLoss,
      onWin: config.onWin,
      winIncrease,
      onLoss: config.onLoss,
      lossIncrease,
    },
  };
}

export function nextAutoStake({
  current,
  base,
  won,
  plan,
  minBet,
  maxBet,
  balance,
  decimals,
}: {
  current: number;
  base: number;
  won: boolean;
  plan: AutoPlan;
  minBet: number;
  maxBet: number;
  balance: number;
  decimals: number;
}): number {
  const rule = won ? plan.onWin : plan.onLoss;
  const percent = won ? plan.winIncrease : plan.lossIncrease;
  let next = rule === "increase" ? current * (1 + percent / 100) : base;
  if (!Number.isFinite(next) || next < 0) next = 0;
  next = Number(next.toFixed(decimals));
  if (minBet > 0 && next < minBet) next = minBet;
  if (maxBet > 0 && next > maxBet) next = maxBet;
  if (next > balance) next = Number(balance.toFixed(decimals));
  return next;
}

export function autoStopReason(
  plan: AutoPlan,
  profit: number,
  format: (value: number) => string,
  symbol: string
): string | null {
  if (plan.stopProfit > 0 && profit >= plan.stopProfit) {
    return `Stopped at profit target of ${format(plan.stopProfit)} ${symbol}.`;
  }
  if (plan.stopLoss > 0 && profit <= -plan.stopLoss) {
    return `Stopped at loss limit of ${format(plan.stopLoss)} ${symbol}.`;
  }
  return null;
}
