import type { SubscriptionInfo, SubscriptionProvider } from "./base";

const API_BASE = "https://cursor.com";

class CursorAuthenticationError extends Error {}

interface StripeResponse {
  membershipType?: string | null;
  subscriptionStatus?: string | null;
  isYearlyPlan?: boolean | null;
  cancelAtPeriodEnd?: boolean | null;
}

interface UsageSummaryResponse {
  membershipType?: string | null;
  billingCycleStart?: string | null;
  billingCycleEnd?: string | null;
  individualUsage?: {
    plan?: {
      used?: number | null;
      limit?: number | null;
      totalPercentUsed?: number | null;
    } | null;
  } | null;
}

async function cursorFetch<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
    credentials: "include",
    cache: "no-store",
  });
  if (resp.status === 401 || resp.status === 403) {
    throw new CursorAuthenticationError("Not logged in to Cursor");
  }
  if (!resp.ok) throw new Error(`Cursor API ${path}: HTTP ${resp.status}`);
  if (!resp.headers.get("content-type")?.includes("application/json")) {
    throw new CursorAuthenticationError("Not logged in to Cursor");
  }
  return resp.json();
}

function toISODate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export const cursorProvider: SubscriptionProvider = {
  id: "cursor",
  name: "Cursor",
  defaultToolId: "cursor",
  permissions: { origins: ["https://cursor.com/*"] },

  async fetch(): Promise<SubscriptionInfo> {
    const now = new Date().toISOString();
    const base: SubscriptionInfo = {
      providerId: "cursor",
      linkedToolId: "cursor",
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

    try {
      const usage = await cursorFetch<UsageSummaryResponse>("/api/usage-summary");
      let stripe: StripeResponse | null = null;
      try {
        stripe = await cursorFetch<StripeResponse>("/api/auth/stripe");
      } catch {
        // The usage summary already proves authentication and carries the current plan.
      }

      const plan = (stripe?.membershipType ?? usage.membershipType ?? "hobby").toUpperCase();
      const cycle = stripe?.isYearlyPlan ? "year" : "month";

      const priceMap: Record<string, Record<string, string>> = {
        PRO: { month: "$20/mo", year: "$192/yr" },
        TEAM: { month: "$40/user/mo", year: "$384/user/yr" },
        STANDARD: { month: "$40/user/mo", year: "$384/user/yr" },
      };
      const price = priceMap[plan]?.[cycle] || "";

      const u = usage.individualUsage?.plan;
      const billingEnd = usage.billingCycleEnd;

      return {
        ...base,
        plan,
        price,
        active: stripe?.subscriptionStatus
          ? ["active", "trialing"].includes(stripe.subscriptionStatus)
          : true,
        nextBillingDate: billingEnd ? toISODate(billingEnd) : null,
        daysUntilBilling: billingEnd ? daysUntil(billingEnd) : null,
        usagePercent: u?.totalPercentUsed ?? null,
        usageLabel:
          typeof u?.used === "number" && typeof u.limit === "number"
            ? `${u.used} / ${u.limit} requests`
            : null,
      };
    } catch (err) {
      return {
        ...base,
        error: err instanceof Error ? err.message : "Failed to fetch",
        loginUrl: err instanceof CursorAuthenticationError ? "https://cursor.com/settings" : null,
      };
    }
  },
};
