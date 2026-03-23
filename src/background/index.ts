import { providers } from "../providers";
import { loadSubscriptions, saveSubscription } from "../storage";
import { isFreePlan } from "../providers/base";

/** Update the toolbar icon badge with the paid subscription count. */
async function updateBadge(): Promise<void> {
  const subs = await loadSubscriptions();
  const count = Object.values(subs).filter((s) => s.active && !isFreePlan(s)).length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#7c3aed" });
}

const ALARM_NAME = "sublens-refresh";
const REFRESH_INTERVAL_MINUTES = 15; // refresh every 15 minutes

/** Refresh all providers and save results. */
async function refreshAll(): Promise<void> {
  for (const provider of providers) {
    try {
      const info = await provider.fetch();
      await saveSubscription(info);
    } catch {
      // Individual provider failure is stored as error in the info.
    }
  }
  await updateBadge();
}

// Set up periodic alarm.
chrome.alarms.create(ALARM_NAME, {
  periodInMinutes: REFRESH_INTERVAL_MINUTES,
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    refreshAll();
  }
});

// Refresh on install/update.
chrome.runtime.onInstalled.addListener(() => {
  refreshAll();
});

// Update badge on service worker startup from cached data.
updateBadge();

// Listen for manual refresh requests from popup.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "refresh") {
    refreshAll().then(() => sendResponse({ ok: true }));
    return true; // keep message channel open for async response
  }
  if (message.type === "update-badge") {
    updateBadge().then(() => sendResponse({ ok: true }));
    return true;
  }
});
