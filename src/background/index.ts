import { providers } from "../providers";
import { isFreePlan, type SubscriptionInfo } from "../providers/base";
import { extensionStorage } from "../storage";

const ALARM_NAME = "sublens-refresh";
const REFRESH_INTERVAL_MINUTES = 15;

function swLog(...args: unknown[]): void {
  console.log(`[SW ${new Date().toISOString()}]`, ...args);
}

function swError(...args: unknown[]): void {
  console.error(`[SW ${new Date().toISOString()}]`, ...args);
}

swLog("start", chrome.runtime.id, chrome.runtime.getManifest().version);

self.addEventListener("error", (event) => {
  swError("uncaught error", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  });
});

self.addEventListener("unhandledrejection", (event) => {
  swError("unhandled rejection", event.reason);
});

async function isProviderConnected(providerId: string): Promise<boolean> {
  const provider = providers.find((candidate) => candidate.id === providerId);
  return provider ? chrome.permissions.contains(provider.permissions) : false;
}

async function updateBadge(): Promise<void> {
  const state = await extensionStorage.load();
  const connectedProviderIds = new Set(
    (
      await Promise.all(
        providers.map(async (provider) => ({
          providerId: provider.id,
          connected: await chrome.permissions.contains(provider.permissions),
        }))
      )
    )
      .filter(({ connected }) => connected)
      .map(({ providerId }) => providerId)
  );
  const count = Object.values(state.subscriptions).filter(
    (snapshot) =>
      connectedProviderIds.has(snapshot.providerId) && snapshot.active && !isFreePlan(snapshot)
  ).length;
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#7c3aed" });
}

async function refreshProvider(providerId: string): Promise<SubscriptionInfo | null> {
  const provider = providers.find((candidate) => candidate.id === providerId);
  if (!provider || !(await isProviderConnected(provider.id))) return null;
  const snapshot = await provider.fetch();
  await extensionStorage.saveSubscription(snapshot);
  return snapshot;
}

async function refreshConnectedProviders(): Promise<void> {
  for (const provider of providers) {
    try {
      await refreshProvider(provider.id);
    } catch {
      // Providers return account failures through SubscriptionInfo.error.
    }
  }
  await updateBadge();
}

chrome.alarms.create(ALARM_NAME, { periodInMinutes: REFRESH_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void refreshConnectedProviders().catch((err) => swError("alarm refresh failed", err));
});

chrome.runtime.onInstalled.addListener(() => {
  void refreshConnectedProviders().catch((err) => swError("onInstalled refresh failed", err));
});

chrome.permissions.onRemoved.addListener(() => {
  void updateBadge().catch((err) => swError("badge update failed", err));
});

void updateBadge()
  .then(() => swLog("init success"))
  .catch((err) => swError("init failed", err));

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (typeof message !== "object" || message === null || !("type" in message)) return;

  if (message.type === "refresh") {
    void refreshConnectedProviders()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        swError("refresh message failed", err);
        sendResponse({ ok: false });
      });
    return true;
  }
  if (message.type === "refresh-provider" && "providerId" in message) {
    void refreshProvider(String(message.providerId))
      .then(async (snapshot) => {
        await updateBadge();
        sendResponse({
          ok: snapshot !== null && snapshot.error === null,
          error: snapshot?.error ?? (snapshot ? null : "Provider is not connected"),
        });
      })
      .catch((err) => {
        swError("refresh-provider message failed", err);
        sendResponse({ ok: false, error: "Provider refresh failed" });
      });
    return true;
  }
  if (message.type === "update-badge") {
    void updateBadge()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        swError("update-badge message failed", err);
        sendResponse({ ok: false });
      });
    return true;
  }
  if (message.type === "set-favorite" && "toolId" in message && "favorite" in message) {
    void extensionStorage
      .setFavorite(String(message.toolId), Boolean(message.favorite))
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        swError("set-favorite message failed", err);
        sendResponse({ ok: false });
      });
    return true;
  }
  if (message.type === "open-provider-login" && "providerId" in message) {
    void extensionStorage
      .load()
      .then(async (state) => {
        const snapshot = state.subscriptions[String(message.providerId)];
        if (snapshot?.loginUrl?.startsWith("https://")) {
          await chrome.tabs.create({ url: snapshot.loginUrl });
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false });
        }
      })
      .catch((err) => {
        swError("open-provider-login message failed", err);
        sendResponse({ ok: false });
      });
    return true;
  }
});
