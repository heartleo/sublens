import type { SubscriptionInfo, SubscriptionProvider } from "./base";

const COOKIE_URL = "https://cursor.com";
const COOKIE_NAME = "WorkosCursorSessionToken";
const API_BASE = "https://cursor.com";

interface StripeResponse {
  membershipType: string;
  subscriptionStatus: string;
  isYearlyPlan: boolean;
  cancelAtPeriodEnd: boolean;
}

interface UsageSummaryResponse {
  membershipType: string;
  billingCycleStart: string;
  billingCycleEnd: string;
  individualUsage: {
    plan: {
      used: number;
      limit: number;
      totalPercentUsed: number;
    };
  };
}

async function getCursorToken(): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({
      url: COOKIE_URL,
      name: COOKIE_NAME,
    });
    return cookie?.value ?? null;
  } catch {
    return null;
  }
}

async function cursorFetch<T>(token: string, path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: {
      Cookie: `WorkosCursorSessionToken=${token}`,
    },
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`Cursor API ${path}: HTTP ${resp.status}`);
  return resp.json();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export const cursorProvider: SubscriptionProvider = {
  id: "cursor",
  name: "Cursor",

  async fetch(): Promise<SubscriptionInfo> {
    const now = new Date().toISOString();
    const base: SubscriptionInfo = {
      id: "cursor",
      name: "Cursor",
      plan: "",
      price: "",
      originalPrice: null,
      active: false,
      nextBillingDate: null,
      daysUntilBilling: null,
      usagePercent: null,
      usageLabel: null,
      error: null,
      loginUrl: null,
      homeUrl: "https://cursor.com",
      lastUpdated: now,
    };

    const token = await getCursorToken();
    if (!token) {
      return { ...base, error: "Not logged in to Cursor", loginUrl: "https://cursor.com/settings" };
    }

    try {
      const [stripe, usage] = await Promise.all([
        cursorFetch<StripeResponse>(token, "/api/auth/stripe"),
        cursorFetch<UsageSummaryResponse>(token, "/api/usage-summary"),
      ]);

      const plan = stripe.membershipType?.toUpperCase() || "FREE";
      const cycle = stripe.isYearlyPlan ? "year" : "month";

      const priceMap: Record<string, Record<string, string>> = {
        PRO: { month: "$20/mo", year: "$192/yr" },
        BUSINESS: { month: "$40/mo", year: "$384/yr" },
      };
      const price = priceMap[plan]?.[cycle] || "";

      const u = usage.individualUsage.plan;
      const billingEnd = usage.billingCycleEnd;

      return {
        ...base,
        plan,
        price,
        active: stripe.subscriptionStatus === "active",
        nextBillingDate: formatDate(billingEnd),
        daysUntilBilling: daysUntil(billingEnd),
        usagePercent: u.totalPercentUsed,
        usageLabel: `${u.used} / ${u.limit} requests`,
      };
    } catch (err) {
      return {
        ...base,
        error: err instanceof Error ? err.message : "Failed to fetch",
      };
    }
  },
};
