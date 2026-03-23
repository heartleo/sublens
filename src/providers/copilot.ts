import type { SubscriptionInfo, SubscriptionProvider } from "./base";

const COOKIE_URL = "https://github.com";
const COOKIE_NAME = "user_session";
const BILLING_URL = "https://github.com/settings/billing";

interface EmbeddedPayload {
  copilotForIndividualsData?: {
    subscriptionItem?: {
      name: string;
      price: number;
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
  userPremiumRequestEntitlement: number;
  discountQuantity: number;
}

async function getGitHubSession(): Promise<string | null> {
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

function toISODate(dateStr: string): string {
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  // Try parsing "Mon DD, YYYY" format
  const parts = dateStr.match(/(\w+)\s+(\d+),\s+(\d+)/);
  if (parts) {
    const parsed = new Date(`${parts[1]} ${parts[2]}, ${parts[3]}`);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
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

async function fetchBillingPage(
  session: string
): Promise<{ csrf: string; payload: EmbeddedPayload; customerID: string }> {
  const resp = await fetch(BILLING_URL, {
    headers: {
      Cookie: `user_session=${session}`,
      "User-Agent": "Mozilla/5.0",
      Accept: "text/html",
    },
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`Billing page returned ${resp.status}`);
  const html = await resp.text();

  // Extract CSRF token.
  const csrfMatch = html.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
  if (!csrfMatch) throw new Error("CSRF token not found");

  // Extract embedded data.
  const dataMatch = html.match(
    /<script[^>]*data-target="react-app\.embeddedData"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!dataMatch) throw new Error("Embedded data not found");

  const root = JSON.parse(dataMatch[1].trim());
  const payload: EmbeddedPayload = root.payload;

  const customerID = payload.customer?.customerId;
  if (!customerID) throw new Error("Customer ID not found");

  return { csrf: csrfMatch[1], payload, customerID: String(customerID) };
}

async function fetchUsageCard(
  session: string,
  csrf: string,
  customerID: string,
  period: number
): Promise<UsageCardResponse> {
  const url = `https://github.com/settings/billing/copilot_usage_card?customer_id=${customerID}&period=${period}`;
  const resp = await fetch(url, {
    headers: {
      Cookie: `user_session=${session}`,
      "X-CSRF-Token": csrf,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
    credentials: "include",
  });
  if (!resp.ok) throw new Error(`Usage card returned ${resp.status}`);
  return resp.json();
}

export const copilotProvider: SubscriptionProvider = {
  id: "copilot",
  name: "GitHub Copilot",

  async fetch(): Promise<SubscriptionInfo> {
    const now = new Date().toISOString();
    const base: SubscriptionInfo = {
      id: "copilot",
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

    const session = await getGitHubSession();
    if (!session) {
      return { ...base, error: "Not logged in to GitHub", loginUrl: "https://github.com/login" };
    }

    try {
      const { csrf, payload, customerID } = await fetchBillingPage(session);
      const sub = payload.copilotForIndividualsData?.subscriptionItem;
      const nextDate = payload.nextPaymentTileData?.nextPaymentDate;

      const plan = sub?.name || "Unknown";
      const price =
        sub?.price && sub?.billingCycle
          ? `$${sub.price.toFixed(2)}/${sub.billingCycle === "month" ? "mo" : "yr"}`
          : "";

      // Fetch current month usage.
      const usage = await fetchUsageCard(session, csrf, customerID, 3);
      const entitlement = usage.userPremiumRequestEntitlement;
      const used = usage.discountQuantity;
      const pct = entitlement > 0 ? (used / entitlement) * 100 : null;

      return {
        ...base,
        plan,
        price,
        active: true,
        nextBillingDate: nextDate ? toISODate(nextDate) : null,
        daysUntilBilling: nextDate ? daysUntilDate(nextDate) : null,
        usagePercent: pct,
        usageLabel: entitlement > 0 ? `${Math.round(used)} / ${entitlement} requests` : null,
      };
    } catch (err) {
      return {
        ...base,
        error: err instanceof Error ? err.message : "Failed to fetch",
      };
    }
  },
};
