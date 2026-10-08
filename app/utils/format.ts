/**
 * Display formatting for the research views. Every formatter takes the raw
 * number and returns a string -- callers decide what to show for null
 * (see components/ui/Missing.tsx), these never invent a placeholder value.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** $263.0M, $1.24B, -$81.2M. */
export function formatUsdCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** Axis ticks: $0, $100M, $1.5B -- fewer decimals than table values. */
export function formatUsdAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs === 0) return "$0";
  if (abs >= 1e9) return `${sign}$${trimZeros((abs / 1e9).toFixed(1))}B`;
  if (abs >= 1e6) return `${sign}$${trimZeros((abs / 1e6).toFixed(0))}M`;
  if (abs >= 1e3) return `${sign}$${trimZeros((abs / 1e3).toFixed(0))}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function trimZeros(text: string): string {
  return text.replace(/\.0$/, "");
}

export function formatPrice(value: number, prefix = "$"): string {
  return `${prefix}${value.toFixed(2)}`;
}

export function formatSignedPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatMultiple(value: number): string {
  return `${value.toFixed(1)}x`;
}

/** "2026-06-30" -> "Jun 30, 2026"; "2026-06" or day-less -> "Jun 2026". */
export function formatIsoDate(iso: string, withDay = true): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month) return iso;
  const monthLabel = MONTHS[month - 1];
  return withDay && day ? `${monthLabel} ${day}, ${year}` : `${monthLabel} ${year}`;
}

/** An ISO datetime as a short local date + time: "Oct 8, 2026, 4:00 PM". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** AI-drafted profiles (api/app/services/discovery.py) fill fields the
 * trial registry doesn't state with "Not specified in trial data" and the
 * like. That's a missing value, not content: return null so the UI shows
 * it as missing instead of printing the placeholder as if it were data. */
export function disclosed(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^\s*not specified\b/i.test(value) ? null : value;
}
