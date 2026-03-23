export type { SubscriptionInfo, SubscriptionProvider } from "./base";
export { cursorProvider } from "./cursor";
export { copilotProvider } from "./copilot";
export { chatgptProvider } from "./chatgpt";
export { claudeProvider } from "./claude";
export { googleOneProvider } from "./googleone";

import { cursorProvider } from "./cursor";
import { copilotProvider } from "./copilot";
import { chatgptProvider } from "./chatgpt";
import { claudeProvider } from "./claude";
import { googleOneProvider } from "./googleone";
import type { SubscriptionProvider } from "./base";

/** All registered providers. Add new ones here. */
export const providers: SubscriptionProvider[] = [
  chatgptProvider,
  claudeProvider,
  copilotProvider,
  googleOneProvider,
  cursorProvider,
];
