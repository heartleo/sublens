import type { SubscriptionInfo } from "./providers/base";

const STORAGE_KEY = "subscriptions";

/** Save subscription data to local storage. */
export async function saveSubscriptions(data: Record<string, SubscriptionInfo>): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

/** Load subscription data from local storage. */
export async function loadSubscriptions(): Promise<Record<string, SubscriptionInfo>> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? {};
}

/** Save a single provider's data. */
export async function saveSubscription(info: SubscriptionInfo): Promise<void> {
  const data = await loadSubscriptions();
  data[info.id] = info;
  await saveSubscriptions(data);
}

const ORDER_KEY = "card_order";

/** Save the user's preferred card order. */
export async function saveCardOrder(order: string[]): Promise<void> {
  await chrome.storage.local.set({ [ORDER_KEY]: order });
}

/** Load the user's preferred card order. */
export async function loadCardOrder(): Promise<string[] | null> {
  const result = await chrome.storage.local.get(ORDER_KEY);
  return result[ORDER_KEY] ?? null;
}
