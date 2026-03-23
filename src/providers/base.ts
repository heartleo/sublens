/** Common subscription data shape returned by all providers. */
export interface SubscriptionInfo {
  /** Provider identifier, e.g. "cursor" or "copilot". */
  id: string;
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

/** Check whether a subscription is a free (non-paid) plan. */
export function isFreePlan(info: SubscriptionInfo): boolean {
  return !info.price || info.price === "$0" || /free/i.test(info.plan);
}

/** A provider fetches subscription data for one service. */
export interface SubscriptionProvider {
  id: string;
  name: string;
  /** Fetch current subscription info. */
  fetch(): Promise<SubscriptionInfo>;
}
