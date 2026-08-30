/**
 * Subscription provider template.
 *
 * Copy to `src/providers/<provider-id>.ts`, replace every Example value, then register the
 * exported provider in `src/providers/index.ts`. This template is compiled for validation but is
 * deliberately not registered, so it never performs a request at runtime.
 */
import { createSubscriptionInfo, type SubscriptionInfo, type SubscriptionProvider } from "./base";

const PROVIDER = {
  id: "example",
  name: "Example AI",
  defaultToolId: "example",
} as const;

const HOME_URL = "https://example.com";
const LOGIN_URL = `${HOME_URL}/login`;

interface AccountResponse {
  plan: string;
  price?: string;
  active?: boolean;
  renewsAt?: string | null;
}

function isAccountResponse(value: unknown): value is AccountResponse {
  return (
    typeof value === "object" && value !== null && "plan" in value && typeof value.plan === "string"
  );
}

function getBillingDate(
  value: string | null | undefined
): Pick<SubscriptionInfo, "nextBillingDate" | "daysUntilBilling"> {
  if (!value) return { nextBillingDate: null, daysUntilBilling: null };

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { nextBillingDate: null, daysUntilBilling: null };
  }

  return {
    nextBillingDate: date.toISOString().slice(0, 10),
    daysUntilBilling: Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000)),
  };
}

export const exampleProvider: SubscriptionProvider = {
  ...PROVIDER,
  permissions: { origins: ["https://example.com/*"] },

  async fetch(): Promise<SubscriptionInfo> {
    const base = createSubscriptionInfo(PROVIDER, { homeUrl: HOME_URL });

    try {
      const response = await fetch(`${HOME_URL}/api/account`, {
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        return {
          ...base,
          error: `Not logged in to ${PROVIDER.name}`,
          loginUrl: LOGIN_URL,
        };
      }

      if (!response.ok) {
        return {
          ...base,
          error: `Account request failed: HTTP ${response.status}`,
        };
      }

      const data: unknown = await response.json();
      if (!isAccountResponse(data)) {
        return { ...base, error: "Unexpected account response" };
      }

      return {
        ...base,
        plan: data.plan,
        price: data.price ?? "",
        active: data.active ?? true,
        ...getBillingDate(data.renewsAt),
      };
    } catch (error) {
      return {
        ...base,
        error: error instanceof Error ? error.message : "Failed to fetch subscription",
      };
    }
  },
};
