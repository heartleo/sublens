import type { SubscriptionInfo } from "../providers/base";
import type { ToolDefinition } from "../tools";

export interface RecentLaunch {
  toolId: string;
  lastOpened: string;
}

export interface UsageRecord {
  launches: number;
  lastOpened: string;
}

export type SubscriptionSnapshot = SubscriptionInfo;

export interface ExtensionState {
  version: 2;
  favorites: string[];
  recent: RecentLaunch[];
  usage: Record<string, UsageRecord>;
  customTools: ToolDefinition[];
  toolOrder: string[];
  subscriptions: Record<string, SubscriptionSnapshot>;
  subscriptionOrder: string[];
}
