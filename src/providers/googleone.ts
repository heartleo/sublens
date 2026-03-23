import type { SubscriptionInfo, SubscriptionProvider } from "./base";

const ONE_URL = "https://one.google.com";

/** Known Google One storage tiers → plan name + price. */
const planMap: Record<string, { plan: string; price: string }> = {
  "15 GB": { plan: "Free", price: "" },
  "100 GB": { plan: "Basic", price: "$1.99/mo" },
  "200 GB": { plan: "Standard", price: "$2.99/mo" },
  "2 TB": { plan: "Premium", price: "$9.99/mo" },
  "5 TB": { plan: "AI Premium", price: "$19.99/mo" },
};

/** Extract the CSRF token (SNlM0e) from the Google One page HTML. */
function extractCsrfToken(html: string): string | null {
  const m = html.match(/SNlM0e":"([^"]+)"/);
  return m ? m[1] : null;
}

/**
 * Parse Google's batchexecute response format.
 * The response starts with `)]}'\n` followed by length-prefixed JSON lines.
 */
function parseBatchResponse(raw: string): string | null {
  // Strip the )]}' prefix
  const body = raw.replace(/^\)\]\}'\n?/, "");
  // Find the first data line (starts with a number = length prefix)
  const lines = body.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      // parsed is an array of arrays; the data is at [0][2]
      if (Array.isArray(parsed) && parsed[0]?.[2]) {
        return parsed[0][2];
      }
    } catch {
      continue;
    }
  }
  return null;
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
      // Step 1: Fetch the page to get CSRF token
      const pageResp = await fetch(ONE_URL, { credentials: "include" });
      if (!pageResp.ok) {
        return {
          ...base,
          error: "Not logged in to Google",
          loginUrl: "https://accounts.google.com/signin",
        };
      }
      const html = await pageResp.text();
      const csrfToken = extractCsrfToken(html);
      if (!csrfToken) {
        return {
          ...base,
          error: "Not logged in to Google",
          loginUrl: "https://accounts.google.com/signin",
        };
      }

      // Step 2: Call batchexecute with GI6Jdd to get current plan
      const rpcid = "GI6Jdd";
      const params = new URLSearchParams({
        rpcids: rpcid,
        "source-path": "/",
        hl: "en",
        "soc-app": "727",
        "soc-platform": "1",
        "soc-device": "1",
        rt: "c",
      });
      const body = new URLSearchParams({
        "f.req": `[[[${JSON.stringify(rpcid)},${JSON.stringify("[]")},null,"generic"]]]`,
        at: csrfToken,
      });

      const rpcResp = await fetch(
        `${ONE_URL}/_/SubscriptionsManagementUi/data/batchexecute?${params}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: body.toString(),
        }
      );
      if (!rpcResp.ok) {
        return { ...base, error: `API request failed: HTTP ${rpcResp.status}` };
      }

      const rawText = await rpcResp.text();
      const dataStr = parseBatchResponse(rawText);
      if (!dataStr) {
        return { ...base, error: "Failed to parse response" };
      }

      const data = JSON.parse(dataStr);
      // data is [[null, null, "US", null, null, "15 GB", null, "0", ...]]
      const inner = Array.isArray(data[0]) ? data[0] : data;
      const storageTier = inner[5] as string | undefined;
      const percentUsed = inner[7] as string | undefined;

      if (!storageTier) {
        return { ...base, error: "Could not determine plan" };
      }

      const matched = planMap[storageTier];
      const plan = matched?.plan ?? storageTier;
      const price = matched?.price ?? "";
      return {
        ...base,
        plan,
        price,
        active: true,
        usagePercent: percentUsed ? parseInt(percentUsed, 10) : null,
        usageLabel: percentUsed ? `${percentUsed}% of ${storageTier}` : null,
      };
    } catch (err) {
      return {
        ...base,
        error: err instanceof Error ? err.message : "Failed to fetch",
      };
    }
  },
};
