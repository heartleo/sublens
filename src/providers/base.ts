/** Common subscription data shape returned by all providers. */
export interface SubscriptionInfo {
  /** Subscription Provider identifier, e.g. "cursor" or "copilot". */
  providerId: string;
  /** Catalog Tool represented by this snapshot, or null when there is no verified association. */
  linkedToolId: string | null;
  /** Display name, e.g. "Cursor" or "GitHub Copilot". */
  name: string;
  /** User's plan name, e.g. "PRO", "GitHub Copilot Pro". */
  plan: string;
  /** Monthly/yearly price label, e.g. "$20/mo". */
  price: string;
  /** Original (non-discounted) price, e.g. "$7.99/mo". Null when no discount. */
  originalPrice: string | null;
  /** Whether the subscription is currently active. */
  active: boolean;
  /** Next billing date (ISO date string, e.g. "2026-04-23"). Formatted in UI layer. */
  nextBillingDate: string | null;
  /** Days until next billing. */
  daysUntilBilling: number | null;
  /** Usage percentage (0-100), null if not applicable. */
  usagePercent: number | null;
  /** Human-readable usage label, e.g. "60 / 500 requests". */
  usageLabel: string | null;
  /** Error message if data couldn't be fetched. */
  error: string | null;
  /** Login URL when user is not authenticated. */
  loginUrl: string | null;
  /** Home/dashboard URL for the service. */
  homeUrl: string | null;
  /** When this data was last refreshed (ISO string). */
  lastUpdated: string;
}

/** Canonical fields used by every provider for a free subscription tier. */
export const FREE_PLAN = { plan: "Free", price: "" } as const;

/** Fields a provider can override when creating a subscription result. */
export type SubscriptionInfoOverrides = Partial<
  Omit<SubscriptionInfo, "providerId" | "linkedToolId" | "name">
>;

/**
 * Create a complete subscription result with safe defaults.
 *
 * Providers only need to override fields returned by their upstream service. Errors should be
 * returned through the `error` field so one failed provider cannot stop the full refresh.
 */
export function createSubscriptionInfo(
  provider: Pick<SubscriptionProvider, "id" | "name" | "defaultToolId">,
  overrides: SubscriptionInfoOverrides = {}
): SubscriptionInfo {
  return {
    providerId: provider.id,
    linkedToolId: provider.defaultToolId,
    name: provider.name,
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
    homeUrl: null,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

/** Check whether a subscription is a free (non-paid) plan. */
export function isFreePlan(info: SubscriptionInfo): boolean {
  return !info.price || info.price === "$0" || /free/i.test(info.plan);
}

/** A provider fetches subscription data for one service. */
export interface SubscriptionProvider {
  id: string;
  name: string;
  /** Tool normally represented by this Provider; null when association depends on fetched data. */
  defaultToolId: string | null;
  permissions: chrome.permissions.Permissions;
  /** Fetch current subscription info. */
  fetch(): Promise<SubscriptionInfo>;
}
