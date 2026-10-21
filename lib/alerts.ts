import * as Sentry from "@sentry/nextjs";

type AlertLevel = "info" | "warning" | "error";

type AlertPayload = {
  title: string;
  message: string;
  level?: AlertLevel;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  error?: unknown;
};

// One outbound hook for money and operations alerts. Slack and Discord both
// accept `text`/`content`, so a single JSON body works for either without
// pinning the app to one provider.
export async function sendAlert(payload: AlertPayload): Promise<boolean> {
  const level = payload.level ?? "error";
  const line = `[${level}] ${payload.title}: ${payload.message}`;
  if (level === "error") console.error(line, payload.extra ?? {});
  else if (level === "warning") console.warn(line, payload.extra ?? {});
  else console.info(line, payload.extra ?? {});

  Sentry.withScope((scope) => {
    if (payload.tags) scope.setTags(payload.tags);
    if (payload.extra) scope.setExtras(payload.extra);
    scope.setLevel(level);
    if (payload.error) Sentry.captureException(payload.error);
    else Sentry.captureMessage(line);
  });

  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return false;

  const body = {
    text: line,
    content: line,
    alert: {
      title: payload.title,
      message: payload.message,
      level,
      tags: payload.tags ?? {},
      extra: payload.extra ?? {},
      at: new Date().toISOString(),
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
