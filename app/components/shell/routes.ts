import type { Ionicons } from "@expo/vector-icons";

export type NavItem = {
  label: string;
  href: "/" | "/discover" | "/watchlist" | "/search" | "/track-record" | "/compare" | "/profile";
  icon: keyof typeof Ionicons.glyphMap;
};

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Research",
    items: [
      { label: "Overview", href: "/", icon: "grid-outline" },
      { label: "Company Explorer", href: "/discover", icon: "albums-outline" },
      { label: "Watchlist", href: "/watchlist", icon: "bookmark-outline" },
      { label: "Trial & paper search", href: "/search", icon: "search-outline" },
    ],
  },
  {
    title: "Analysis",
    items: [
      { label: "Signal track record", href: "/track-record", icon: "analytics-outline" },
      { label: "Compare companies", href: "/compare", icon: "git-compare-outline" },
    ],
  },
];

export const COMPANY_TABS = [
  { key: "overview", label: "Overview" },
  { key: "financials", label: "Financials" },
  { key: "pipeline", label: "Clinical Pipeline" },
  { key: "commercial", label: "Commercial Analysis" },
  { key: "research", label: "Research" },
  { key: "catalysts", label: "Catalysts" },
] as const;

export type CompanyTabKey = (typeof COMPANY_TABS)[number]["key"];

export function isCompanyTab(value: unknown): value is CompanyTabKey {
  return COMPANY_TABS.some((tab) => tab.key === value);
}

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/discover": "Company Explorer",
  "/watchlist": "Watchlist",
  "/search": "Trial & paper search",
  "/track-record": "Signal track record",
  "/compare": "Compare companies",
  "/profile": "Account",
  "/stock-detail": "Price chart",
  "/disclaimer": "Disclaimer",
  "/privacy": "Privacy",
};

/** Breadcrumb trail for the top bar, e.g. ["Company Explorer", "Arvinas"]. */
export function breadcrumbFor(pathname: string, companyName?: string): string[] {
  if (pathname.startsWith("/company/")) return ["Company Explorer", companyName ?? "Company"];
  if (pathname.startsWith("/auth/")) return ["Account"];
  return [TITLES[pathname] ?? "BioLens"];
}

/** Which sidebar item a path belongs under. */
export function activeNavHref(pathname: string): NavItem["href"] | null {
  if (pathname.startsWith("/company/")) return "/discover";
  const all = NAV_SECTIONS.flatMap((s) => s.items);
  return all.find((item) => item.href === pathname)?.href ?? null;
}
