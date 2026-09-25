/**
 * Prefix for a quote's price. Only USD used to get one, so a non-US
 * listing (Innovent Biologics, 1801.HK) showed a bare number that read as
 * dollars. Unknown codes fall back to the ISO code itself — never blank.
 */
const PREFIXES: Record<string, string> = {
  USD: "$",
  HKD: "HK$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "CN¥",
};

export function currencyPrefix(currency: string | null | undefined): string {
  if (!currency) return "";
  return PREFIXES[currency] ?? `${currency} `;
}
