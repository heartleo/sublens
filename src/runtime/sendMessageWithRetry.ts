function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries with backoff absorb the "Receiving end does not exist" race when the message wakes a
// torn-down service worker — an immediate single retry can still land before Windows finishes
// the cold start, so give it a few spaced attempts before surfacing a failure.
const RETRY_DELAYS_MS = [0, 150, 400, 800];

export async function sendMessageWithRetry<T>(message: unknown): Promise<T> {
  let lastError: unknown;
  for (const wait of RETRY_DELAYS_MS) {
    if (wait > 0) await delay(wait);
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
