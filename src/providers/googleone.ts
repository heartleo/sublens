import type { SubscriptionInfo, SubscriptionProvider } from "./base";

const SETTINGS_URL =
  "https://one.google.com/settings?expand=upgrade&g1_last_touchpoint=64&g1_landing_page=1";

/** Extract an AF_initDataCallback data block by key from the page HTML. */
function extractDsData(html: string, key: string): unknown | null {
  const regex = new RegExp(
    `AF_initDataCallback\\(\\{key:\\s*'${key}',\\s*hash:\\s*'[^']*',\\s*data:([\\s\\S]*?),\\s*sideChannel:\\s*\\{`,
  );
  const m = regex.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return null;
  }
}

/**
 * Extract the current plan name from ds:5[0].
 * The plan name is embedded as a JSON string inside the productId field:
 *   ds:5[0][1][...] contains '{"name":"Google AI Plus (200GB)", ...}'
 */
function extractCurrentPlan(html: string): {
  plan: string;
  price: string;
  originalPrice: string | null;
  storageTier: string;
} | null {
  const ds5 = extractDsData(html, "ds:5") as unknown[][] | null;
  if (!ds5?.[0]) return null;

  // ds:5[0] is the current plan array, ds:5[0][0] holds plan details:
  //   [0] = ["200 GB", bytes]  — storage tier
  //   [1] = ["$3.99 / month", ...] — actual/discounted monthly price
  //   [5] = "Google AI Plus" — plan name
  const current = ds5[0] as unknown[];
  const details = current[0] as unknown[] | undefined;
  if (!details) return null;

  const storageTier = (details[0] as unknown[])?.[0] as string | undefined;
  if (!storageTier) return null;

  // Plan name directly from details[5]
  const planName = (details[5] as string) ?? storageTier;

  // Actual price (including promo/discount) from details[1][0], e.g. "$3.99 / month"
  const priceStr = (details[1] as unknown[])?.[0] as string | undefined;
  let price = "";
  if (priceStr) {
    const m = priceStr.match(/(\$[\d.]+)/);
    price = m ? `${m[1]}/mo` : "";
  }

  // Original (base) price from productId JSON, e.g. "price":"$7.99"
  let originalPrice: string | null = null;
  const str = JSON.stringify(current);
  const basePriceMatch = str.match(/\\"price\\":\\"(\$[\d.]+)\\"/);
  if (basePriceMatch?.[1] && price) {
    const baseStr = `${basePriceMatch[1]}/mo`;
    // Only set originalPrice if it differs from actual price (i.e. there's a discount)
    if (baseStr !== price) {
      originalPrice = baseStr;
    }
  }

  return { plan: planName, price, originalPrice, storageTier };
}

/**
 * Extract storage usage from ds:6.
 * ds:6 = [["200 GB", bytes], ["0.11 GB", bytes], "0", "Your storage is 0% full", 3]
 */
function extractStorageUsage(html: string): {
  usagePercent: number;
  usageLabel: string;
} | null {
  const ds6 = extractDsData(html, "ds:6") as unknown[] | null;
  if (!ds6) return null;

  const total = (ds6[0] as string[])?.[0] as string | undefined;
  const used = (ds6[1] as string[])?.[0] as string | undefined;
  const percent = ds6[2] as string | undefined;

  if (!total || !used || percent == null) return null;

  return {
    usagePercent: parseInt(percent, 10),
    usageLabel: `${used} of ${total}`,
  };
}

/**
 * Extract member-since epoch from ds:0[8].
 * ds:0[8] = [epochSeconds, nanos]
 */
function extractMemberSinceEpoch(html: string): number | null {
  const ds0 = extractDsData(html, "ds:0") as unknown[] | null;
  const epoch = (ds0?.[8] as number[])?.[0];
  return typeof epoch === "number" ? epoch : null;
}

/** Compute the next monthly billing date from the member-since epoch. */
function computeNextBillingDate(memberSinceEpoch: number): Date {
  const start = new Date(memberSinceEpoch * 1000);
  const now = new Date();
  const next = new Date(start);
  while (next <= now) {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysUntil(d: Date): number {
  const ms = d.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export const googleOneProvider: SubscriptionProvider = {
  id: "googleone",
  name: "Google One",

  async fetch(): Promise<SubscriptionInfo> {
    const now = new Date().toISOString();
    const base: SubscriptionInfo = {
      id: "googleone",
      name: "Google One",
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
      homeUrl: "https://one.google.com",
      lastUpdated: now,
    };

    try {
      const pageResp = await fetch(SETTINGS_URL, { credentials: "include" });
      if (!pageResp.ok) {
        return {
          ...base,
          error: "Not logged in to Google",
          loginUrl: "https://accounts.google.com/signin",
        };
      }
      const html = await pageResp.text();

      // Check if logged in (CSRF token present)
      if (!html.match(/SNlM0e":"[^"]+"/)) {
        return {
          ...base,
          error: "Not logged in to Google",
          loginUrl: "https://accounts.google.com/signin",
        };
      }

      // Extract current plan from ds:5
      const currentPlan = extractCurrentPlan(html);
      if (!currentPlan) {
        return { ...base, error: "Could not determine plan" };
      }

      const { plan, price, originalPrice, storageTier } = currentPlan;
      const isFree = storageTier === "15 GB";

      // Storage usage from ds:6
      const usage = extractStorageUsage(html);

      // Next billing date from member-since timestamp in ds:0
      let nextBillingDate: string | null = null;
      let daysUntilBilling: number | null = null;
      if (!isFree) {
        const memberSinceEpoch = extractMemberSinceEpoch(html);
        if (memberSinceEpoch) {
          const next = computeNextBillingDate(memberSinceEpoch);
          nextBillingDate = toISODate(next);
          daysUntilBilling = daysUntil(next);
        }
      }

      return {
        ...base,
        plan,
        price,
        originalPrice,
        active: true,
        nextBillingDate,
        daysUntilBilling,
        usagePercent: usage?.usagePercent ?? null,
        usageLabel: usage?.usageLabel ?? null,
      };
    } catch (err) {
      return {
        ...base,
        error: err instanceof Error ? err.message : "Failed to fetch",
      };
    }
  },
};
