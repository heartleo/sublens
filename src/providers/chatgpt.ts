import type { SubscriptionInfo, SubscriptionProvider } from "./base";

const API_BASE = "https://chatgpt.com";

interface SessionResponse {
  user: { id: string; name: string; email: string };
  accessToken: string;
  account: { planType: string };
}

interface Entitlement {
  has_active_subscription: boolean;
  subscription_plan: string;
  billing_period: string | null;
  renews_at: string | null;
  expires_at: string | null;
  cancels_at: string | null;
}

interface AccountEntry {
  account: { plan_type: string };
  entitlement: Entitlement;
}

interface AccountsCheckResponse {
  accounts: Record<string, AccountEntry>;
  account_ordering: string[];
}

const planLabel: Record<string, string> = {
  chatgptfreeplan: "Free",
  chatgptplusplan: "Plus",
  chatgptgoplan: "Go",
  chatgptprolite: "Pro Lite",
  chatgptpro: "Pro",
  chatgptteamplan: "Team",
};

const planPrice: Record<string, string> = {
  chatgptplusplan: "$20/mo",
  chatgptgoplan: "$50/mo",
  chatgptprolite: "$100/mo",
  chatgptpro: "$200/mo",
  chatgptteamplan: "$25/user/mo",
};

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

export const chatgptProvider: SubscriptionProvider = {
  id: "chatgpt",
  name: "ChatGPT",

  async fetch(): Promise<SubscriptionInfo> {
    const now = new Date().toISOString();
    const base: SubscriptionInfo = {
      id: "chatgpt",
      name: "ChatGPT",
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
      homeUrl: "https://chatgpt.com",
      lastUpdated: now,
    };

    try {
      // Step 1: get session + accessToken
      const sessionResp = await fetch(`${API_BASE}/api/auth/session`, {
        credentials: "include",
      });
      if (!sessionResp.ok) {
        return {
          ...base,
          error: "Not logged in to ChatGPT",
          loginUrl: "https://chatgpt.com/auth/login",
        };
      }
      const session: SessionResponse = await sessionResp.json();
      if (!session.accessToken) {
        return {
          ...base,
          error: "Not logged in to ChatGPT",
          loginUrl: "https://chatgpt.com/auth/login",
        };
      }

      // Step 2: get account details with Bearer token
      const checkResp = await fetch(`${API_BASE}/backend-api/accounts/check/v4-2023-04-27`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        credentials: "include",
      });
      if (!checkResp.ok) {
        return { ...base, error: `Account check failed: HTTP ${checkResp.status}` };
      }
      const data: AccountsCheckResponse = await checkResp.json();

      // Find the active account (first in ordering, fallback to "default")
      const accountKey = data.account_ordering?.[0] ?? "default";
      const entry = data.accounts[accountKey] ?? data.accounts["default"];
      if (!entry) {
        return { ...base, error: "No account found" };
      }

      const ent = entry.entitlement;
      const plan = planLabel[ent.subscription_plan] ?? entry.account.plan_type ?? "Free";
      const price = planPrice[ent.subscription_plan] ?? "";
      const renewDate = ent.renews_at ?? ent.expires_at;

      return {
        ...base,
        plan,
        price,
        active: ent.has_active_subscription,
        nextBillingDate: renewDate ? formatDate(renewDate) : null,
        daysUntilBilling: renewDate ? daysUntil(renewDate) : null,
      };
    } catch (err) {
      return {
        ...base,
        error: err instanceof Error ? err.message : "Failed to fetch",
      };
    }
  },
};
