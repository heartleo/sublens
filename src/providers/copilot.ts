import { FREE_PLAN, type SubscriptionInfo, type SubscriptionProvider } from "./base";

const BILLING_URL = "https://github.com/settings/billing";

class GitHubAuthenticationError extends Error {}

interface EmbeddedPayload {
  copilotForIndividualsData?: {
    onFreeTier?: boolean;
    subscriptionItem?: {
      name: string;
      price: number | string;
      billingCycle: string;
    };
  };
  nextPaymentTileData?: {
    nextPaymentDate: string;
  };
  customer?: {
    customerId: number;
  };
}

interface UsageCardResponse {
  userPremiumRequestEntitlement?: number;
  user_premium_request_entitlement?: number;
  discountQuantity?: number;
  discount_quantity?: number;
  payload?: UsageCardResponse;
  data?: UsageCardResponse;
}

function toISODate(dateStr: string): string {
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  // Try parsing "Mon DD, YYYY" format
  const parts = dateStr.match(/(\w+)\s+(\d+),\s+(\d+)/);
  if (parts) {
    const parsed = new Date(`${parts[1]} ${parts[2]}, ${parts[3]}`);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  return dateStr;
}

function daysUntilDate(dateStr: string): number | null {
  // Parse "Mon DD, YYYY" or ISO.
  let d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const months: Record<string, number> = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };
    const m = dateStr.match(/(\w+)\s+(\d+),\s+(\d+)/);
    if (m) {
      d = new Date(parseInt(m[3]), months[m[1]] ?? 0, parseInt(m[2]));
    } else {
      return null;
    }
  }
  const ms = d.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

async function fetchBillingPage(): Promise<{
  csrf: string | null;
  payload: EmbeddedPayload;
  customerID: string | null;
}> {
  const resp = await fetch(BILLING_URL, {
    headers: {
      Accept: "text/html",
    },
    credentials: "include",
    cache: "no-store",
  });
  if (resp.status === 401 || resp.status === 403 || resp.status === 404) {
    throw new GitHubAuthenticationError("Not logged in to GitHub");
  }
  if (!resp.ok) throw new Error(`Billing page returned ${resp.status}`);
  const html = await resp.text();
  if (resp.url.includes("/login") || /<form[^>]+action="\/session"/i.test(html)) {
    throw new GitHubAuthenticationError("Not logged in to GitHub");
  }

  // Extract CSRF token.
  const csrfMatch = html.match(/name="authenticity_token"[^>]*value="([^"]+)"/);

  // Extract embedded data.
  const dataMatch = html.match(
    /<script[^>]*data-target="react-app\.embeddedData"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!dataMatch) throw new Error("Embedded data not found");

  const root = JSON.parse(dataMatch[1].trim());
  const payload: EmbeddedPayload = root.payload;

  const customerID =
    payload.customer?.customerId ??
    html.match(/"customerId"\s*:\s*"?(\d+)"?/)?.[1] ??
    html.match(/customerId&amp;quot;\s*:\s*&amp;quot;?(\d+)/)?.[1] ??
    html.match(/customer_id=(\d+)/)?.[1];

  return {
    csrf: csrfMatch?.[1] ?? null,
    payload,
    customerID: customerID ? String(customerID) : null,
  };
}

async function fetchUsageCard(
  csrf: string | null,
  customerID: string,
  period: number
): Promise<UsageCardResponse> {
  const url = `https://github.com/settings/billing/copilot_usage_card?customer_id=${customerID}&period=${period}`;
  const headers: Record<string, string> = {
    "X-Requested-With": "XMLHttpRequest",
    Accept: "application/json",
  };
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const resp = await fetch(url, {
    headers,
    credentials: "include",
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`Usage card returned ${resp.status}`);
  const root: UsageCardResponse = await resp.json();
  return root.payload ?? root.data ?? root;
}

export const copilotProvider: SubscriptionProvider = {
  id: "copilot",
  name: "GitHub Copilot",
  defaultToolId: "copilot",
  permissions: { origins: ["https://github.com/*"] },

  async fetch(): Promise<SubscriptionInfo> {
    const now = new Date().toISOString();
    const base: SubscriptionInfo = {
      providerId: "copilot",
      linkedToolId: "copilot",
      name: "GitHub Copilot",
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
      homeUrl: "https://github.com/copilot",
      lastUpdated: now,
    };

    try {
      const { csrf, payload, customerID } = await fetchBillingPage();
      const copilotData = payload.copilotForIndividualsData;
      if (!copilotData) throw new Error("GitHub Copilot billing data not found");
      const sub = copilotData?.subscriptionItem;
      const isFreeTier = copilotData?.onFreeTier === true;
      const nextDate = payload.nextPaymentTileData?.nextPaymentDate;

      // Determine plan name and price from billing data.
      const plan = isFreeTier ? FREE_PLAN.plan : sub?.name || "Unknown";
      const price = isFreeTier
        ? FREE_PLAN.price
        : sub?.price && sub?.billingCycle
          ? `$${Number(sub.price).toFixed(2)}/${sub.billingCycle === "month" ? "mo" : "yr"}`
          : "";

      // Usage is supplementary. Keep the subscription usable if GitHub changes this endpoint.
      let usagePercent: number | null = null;
      let usageLabel: string | null = null;
      if (customerID) {
        try {
          const usage = await fetchUsageCard(csrf, customerID, 3);
          const entitlement =
            usage.userPremiumRequestEntitlement ?? usage.user_premium_request_entitlement ?? 0;
          const used = usage.discountQuantity ?? usage.discount_quantity ?? 0;
          usagePercent = entitlement > 0 ? (used / entitlement) * 100 : null;
          usageLabel = entitlement > 0 ? `${Math.round(used)} / ${entitlement} requests` : null;
        } catch {
          // The billing plan is still valid when usage is temporarily unavailable.
        }
      }

      return {
        ...base,
        plan,
        price,
        active: true,
        nextBillingDate: nextDate ? toISODate(nextDate) : null,
        daysUntilBilling: nextDate ? daysUntilDate(nextDate) : null,
        usagePercent,
        usageLabel,
      };
    } catch (err) {
      return {
        ...base,
        error: err instanceof Error ? err.message : "Failed to fetch",
        loginUrl: err instanceof GitHubAuthenticationError ? "https://github.com/login" : null,
      };
    }
  },
};
