import type { SubscriptionInfo, SubscriptionProvider } from "./base";

const API_BASE = "https://claude.ai";

interface Organization {
  uuid: string;
  name: string;
  capabilities: string[];
  billing_type: string | null;
}

interface SubscriptionDetails {
  next_charge_date: string | null;
  status: string | null;
  billing_interval: string | null;
}

const capabilityToPlan: Record<string, { plan: string; price: string }> = {
  claude_max: { plan: "Max", price: "$100/mo" },
  claude_pro: { plan: "Pro", price: "$20/mo" },
};

function detectPlan(capabilities: string[]): { plan: string; price: string } {
  for (const cap of capabilities) {
    if (capabilityToPlan[cap]) return capabilityToPlan[cap];
  }
  return { plan: "Free", price: "" };
}

export const claudeProvider: SubscriptionProvider = {
  id: "claude",
  name: "Claude",

  async fetch(): Promise<SubscriptionInfo> {
    const now = new Date().toISOString();
    const base: SubscriptionInfo = {
      id: "claude",
      name: "Claude",
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
      homeUrl: "https://claude.ai",
      lastUpdated: now,
    };

    try {
      const resp = await fetch(`${API_BASE}/api/organizations`, {
        credentials: "include",
      });
      if (!resp.ok) {
        return { ...base, error: "Not logged in to Claude", loginUrl: "https://claude.ai/login" };
      }
      const orgs: Organization[] = await resp.json();
      if (!orgs.length) {
        return { ...base, error: "No organization found" };
      }

      // Use the first org (personal account)
      const org = orgs[0];
      const { plan, price } = detectPlan(org.capabilities);

      // Fetch renewal date from subscription_details
      let nextBillingDate: string | null = null;
      let daysUntilBilling: number | null = null;
      try {
        const subResp = await fetch(
          `${API_BASE}/api/organizations/${org.uuid}/subscription_details`,
          { credentials: "include" },
        );
        if (subResp.ok) {
          const sub: SubscriptionDetails = await subResp.json();
          if (sub.next_charge_date) {
            const d = new Date(sub.next_charge_date);
            nextBillingDate = d.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const ms = d.getTime() - Date.now();
            daysUntilBilling = Math.max(0, Math.ceil(ms / 86_400_000));
          }
        }
      } catch {
        // Non-critical — skip silently
      }

      return {
        ...base,
        plan,
        price,
        active: true,
        nextBillingDate,
        daysUntilBilling,
      };
    } catch (err) {
      return {
        ...base,
        error: err instanceof Error ? err.message : "Failed to fetch",
      };
    }
  },
};
