import { getBuiltInTool } from "../tools";
import type { SubscriptionInfo } from "../providers/base";
import type { ExtensionState, SubscriptionSnapshot } from "./types";

type LegacySubscriptionInfo = Omit<SubscriptionInfo, "providerId" | "linkedToolId"> & {
  id: string;
};

const STATE_KEY = "sublens_state";
const LEGACY_SUBSCRIPTIONS_KEY = "subscriptions";
const LEGACY_ORDER_KEY = "card_order";
const DEFAULT_FAVORITES = ["chatgpt", "claude", "cursor"];

export interface StorageAdapter {
  read(keys: readonly string[]): Promise<Record<string, unknown>>;
  write(items: Record<string, unknown>): Promise<void>;
}

export interface ExtensionStorage {
  load(): Promise<ExtensionState>;
  recordLaunch(toolId: string, openedAt: string): Promise<ExtensionState>;
  saveSubscription(snapshot: SubscriptionSnapshot): Promise<ExtensionState>;
  setFavorite(toolId: string, favorite: boolean): Promise<ExtensionState>;
  setToolOrder(toolIds: readonly string[]): Promise<ExtensionState>;
  setSubscriptionOrder(providerIds: readonly string[]): Promise<ExtensionState>;
}

function linkedToolIdForLegacySubscription(info: LegacySubscriptionInfo): string | null {
  if (info.id === "googleone") {
    return /\bgoogle ai\b/i.test(info.plan) ? "gemini" : null;
  }
  return getBuiltInTool(info.id) ? info.id : null;
}

function migrateSubscription(info: LegacySubscriptionInfo): SubscriptionSnapshot {
  const { id, ...snapshot } = info;
  return {
    ...snapshot,
    providerId: id,
    linkedToolId: linkedToolIdForLegacySubscription(info),
  };
}

function createDefaultState(): ExtensionState {
  return {
    version: 2,
    favorites: [...DEFAULT_FAVORITES],
    recent: [],
    usage: {},
    customTools: [],
    toolOrder: [],
    subscriptions: {},
    subscriptionOrder: [],
  };
}

function isExtensionState(value: unknown): value is ExtensionState {
  return typeof value === "object" && value !== null && "version" in value && value.version === 2;
}

function normalizeState(state: ExtensionState): ExtensionState {
  const toolOrder = (state as Partial<ExtensionState>).toolOrder;
  return {
    ...state,
    toolOrder: Array.isArray(toolOrder)
      ? toolOrder.filter((toolId): toolId is string => typeof toolId === "string")
      : [],
  };
}

export function createExtensionStorage(adapter: StorageAdapter): ExtensionStorage {
  let mutationQueue: Promise<void> = Promise.resolve();

  async function load(): Promise<ExtensionState> {
    const stored = await adapter.read([STATE_KEY, LEGACY_SUBSCRIPTIONS_KEY, LEGACY_ORDER_KEY]);
    if (isExtensionState(stored[STATE_KEY])) {
      const state = normalizeState(stored[STATE_KEY]);
      if (!Array.isArray((stored[STATE_KEY] as Partial<ExtensionState>).toolOrder)) {
        await adapter.write({ [STATE_KEY]: state });
      }
      return state;
    }

    const state = createDefaultState();
    const legacySubscriptions = stored[LEGACY_SUBSCRIPTIONS_KEY];
    if (typeof legacySubscriptions === "object" && legacySubscriptions !== null) {
      state.subscriptions = Object.fromEntries(
        Object.entries(legacySubscriptions).map(([providerId, value]) => {
          const info = value as LegacySubscriptionInfo;
          return [providerId, migrateSubscription(info)];
        })
      );
    }

    const legacyOrder = stored[LEGACY_ORDER_KEY];
    if (Array.isArray(legacyOrder)) {
      state.subscriptionOrder = legacyOrder.filter(
        (providerId): providerId is string => typeof providerId === "string"
      );
    }

    await adapter.write({ [STATE_KEY]: state });
    return state;
  }

  function mutate(update: (state: ExtensionState) => ExtensionState): Promise<ExtensionState> {
    const operation = mutationQueue.then(async () => {
      const next = update(await load());
      await adapter.write({ [STATE_KEY]: next });
      return next;
    });
    mutationQueue = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  }

  return {
    load,
    async recordLaunch(toolId, openedAt) {
      return mutate((state) => {
        const previousUsage = state.usage[toolId];
        return {
          ...state,
          recent: [
            { toolId, lastOpened: openedAt },
            ...state.recent.filter((entry) => entry.toolId !== toolId),
          ].slice(0, 8),
          usage: {
            ...state.usage,
            [toolId]: {
              launches: (previousUsage?.launches ?? 0) + 1,
              lastOpened: openedAt,
            },
          },
        };
      });
    },
    async setFavorite(toolId, favorite) {
      return mutate((state) => {
        const favorites = state.favorites.filter((id) => id !== toolId);
        if (favorite) favorites.push(toolId);
        return { ...state, favorites };
      });
    },
    async setToolOrder(toolIds) {
      return mutate((state) => ({ ...state, toolOrder: [...toolIds] }));
    },
    async saveSubscription(snapshot) {
      return mutate((state) => ({
        ...state,
        subscriptions: {
          ...state.subscriptions,
          [snapshot.providerId]: snapshot,
        },
      }));
    },
    async setSubscriptionOrder(providerIds) {
      return mutate((state) => ({ ...state, subscriptionOrder: [...providerIds] }));
    },
  };
}

const chromeStorageAdapter: StorageAdapter = {
  read: async (keys) => chrome.storage.local.get([...keys]),
  write: async (items) => chrome.storage.local.set(items),
};

export const extensionStorage = createExtensionStorage(chromeStorageAdapter);

export async function loadSubscriptions(): Promise<Record<string, SubscriptionSnapshot>> {
  return (await extensionStorage.load()).subscriptions;
}

export async function saveSubscription(snapshot: SubscriptionSnapshot): Promise<void> {
  await extensionStorage.saveSubscription(snapshot);
}

export async function loadCardOrder(): Promise<string[] | null> {
  const order = (await extensionStorage.load()).subscriptionOrder;
  return order.length > 0 ? order : null;
}

export async function saveCardOrder(providerIds: readonly string[]): Promise<void> {
  await extensionStorage.setSubscriptionOrder(providerIds);
}

export type { ExtensionState, RecentLaunch, SubscriptionSnapshot, UsageRecord } from "./types";
