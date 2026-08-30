import { describe, expect, it } from "vitest";
import { createExtensionStorage, type StorageAdapter } from "./index";

function createMemoryStorage(seed: Record<string, unknown>): StorageAdapter {
  const values = structuredClone(seed);
  return {
    async read(keys) {
      return Object.fromEntries(
        keys.filter((key) => key in values).map((key) => [key, values[key]])
      );
    },
    async write(items) {
      Object.assign(values, structuredClone(items));
    },
  };
}

describe("Extension Storage", () => {
  it("migrates legacy subscriptions without linking a storage-only Google One plan to Gemini", async () => {
    const legacyGoogleOne = {
      id: "googleone",
      name: "Google One",
      plan: "Premium 2 TB",
      price: "$9.99/mo",
      originalPrice: null,
      active: true,
      nextBillingDate: null,
      daysUntilBilling: null,
      usagePercent: 10,
      usageLabel: "200 GB of 2 TB",
      error: null,
      loginUrl: null,
      homeUrl: "https://one.google.com",
      lastUpdated: "2026-08-01T00:00:00.000Z",
    };
    const storage = createExtensionStorage(
      createMemoryStorage({
        subscriptions: { googleone: legacyGoogleOne },
        card_order: ["googleone", "chatgpt"],
      })
    );

    const state = await storage.load();

    expect(state).toMatchObject({
      version: 3,
      favorites: ["chatgpt", "claude", "cursor"],
      toolOrder: [],
      hiddenBuiltInTools: [],
      subscriptionOrder: ["googleone", "chatgpt"],
      subscriptions: {
        googleone: {
          providerId: "googleone",
          linkedToolId: null,
          plan: "Premium 2 TB",
        },
      },
    });
  });

  it("records a Launch once in Recent and increments Usage", async () => {
    const storage = createExtensionStorage(createMemoryStorage({}));

    await storage.recordLaunch("claude", "2026-08-27T09:00:00.000Z");
    const state = await storage.recordLaunch("claude", "2026-08-27T10:00:00.000Z");

    expect(state.recent).toEqual([{ toolId: "claude", lastOpened: "2026-08-27T10:00:00.000Z" }]);
    expect(state.usage.claude).toEqual({
      launches: 2,
      lastOpened: "2026-08-27T10:00:00.000Z",
    });
  });

  it("persists explicit Favorite changes without duplicates", async () => {
    const storage = createExtensionStorage(createMemoryStorage({}));

    await storage.setFavorite("claude", false);
    await storage.setFavorite("gemini", true);
    const state = await storage.setFavorite("gemini", true);

    expect(state.favorites).toEqual(["chatgpt", "cursor", "gemini"]);
  });

  it("migrates version 2 state with new Tool visibility defaults", async () => {
    const storage = createExtensionStorage(
      createMemoryStorage({
        sublens_state: {
          version: 2,
          favorites: [],
          recent: [],
          usage: {},
          customTools: [],
          subscriptions: {},
          subscriptionOrder: [],
        },
      })
    );

    expect(await storage.load()).toMatchObject({
      version: 3,
      toolOrder: [],
      hiddenBuiltInTools: [],
    });
  });

  it("persists the custom Tool Order", async () => {
    const storage = createExtensionStorage(createMemoryStorage({}));

    const state = await storage.setToolOrder(["cursor", "claude", "chatgpt"]);

    expect(state.toolOrder).toEqual(["cursor", "claude", "chatgpt"]);
    expect((await storage.load()).toolOrder).toEqual(["cursor", "claude", "chatgpt"]);
  });

  it("serializes concurrent Launch writes so Usage increments are not lost", async () => {
    const storage = createExtensionStorage(createMemoryStorage({}));
    await storage.load();

    await Promise.all([
      storage.recordLaunch("cursor", "2026-08-27T09:00:00.000Z"),
      storage.recordLaunch("cursor", "2026-08-27T10:00:00.000Z"),
    ]);

    expect((await storage.load()).usage.cursor.launches).toBe(2);
  });

  it("preserves Subscription Snapshots saved concurrently", async () => {
    const storage = createExtensionStorage(createMemoryStorage({}));
    const snapshot = (providerId: string) => ({
      providerId,
      linkedToolId: providerId,
      name: providerId,
      plan: "Pro",
      price: "$20/mo",
      originalPrice: null,
      active: true,
      nextBillingDate: null,
      daysUntilBilling: null,
      usagePercent: null,
      usageLabel: null,
      error: null,
      loginUrl: null,
      homeUrl: null,
      lastUpdated: "2026-08-27T10:00:00.000Z",
    });

    await Promise.all([
      storage.saveSubscription(snapshot("chatgpt")),
      storage.saveSubscription(snapshot("claude")),
    ]);

    expect(Object.keys((await storage.load()).subscriptions)).toEqual(["chatgpt", "claude"]);
  });

  it("saves and updates a Custom Tool by its stable identity", async () => {
    const storage = createExtensionStorage(createMemoryStorage({}));
    const tool = {
      id: "custom-perplexity",
      name: "Perplexity",
      url: "https://www.perplexity.ai/",
      icon: "",
      iconSource: "favicon" as const,
      fallback: "P",
      category: "chat" as const,
      aliases: [],
      tags: [],
    };

    await storage.saveCustomTool(tool);
    const state = await storage.saveCustomTool({ ...tool, name: "Perplexity AI" });

    expect(state.customTools).toEqual([{ ...tool, name: "Perplexity AI" }]);
  });

  it("removes a Custom Tool and all launcher references to it", async () => {
    const customTool = {
      id: "custom-perplexity",
      name: "Perplexity",
      url: "https://www.perplexity.ai/",
      icon: "",
      iconSource: "favicon" as const,
      fallback: "P",
      category: "chat" as const,
      aliases: [],
      tags: [],
    };
    const storage = createExtensionStorage(
      createMemoryStorage({
        sublens_state: {
          version: 3,
          favorites: ["chatgpt", customTool.id],
          recent: [{ toolId: customTool.id, lastOpened: "2026-08-30T10:00:00.000Z" }],
          usage: {
            [customTool.id]: { launches: 3, lastOpened: "2026-08-30T10:00:00.000Z" },
          },
          customTools: [customTool],
          toolOrder: [customTool.id, "chatgpt"],
          hiddenBuiltInTools: [],
          subscriptions: {},
          subscriptionOrder: [],
        },
      })
    );

    const state = await storage.removeCustomTool(customTool.id);

    expect(state.customTools).toEqual([]);
    expect(state.favorites).toEqual(["chatgpt"]);
    expect(state.recent).toEqual([]);
    expect(state.usage).toEqual({});
    expect(state.toolOrder).toEqual(["chatgpt"]);
  });

  it("hides and restores a Built-in Tool without duplicating visibility state", async () => {
    const storage = createExtensionStorage(createMemoryStorage({}));

    await storage.setBuiltInVisible("gemini", false);
    await storage.setBuiltInVisible("gemini", false);
    expect((await storage.load()).hiddenBuiltInTools).toEqual(["gemini"]);

    expect((await storage.setBuiltInVisible("gemini", true)).hiddenBuiltInTools).toEqual([]);
  });

  it("resets launcher data without removing Subscription Snapshots", async () => {
    const storage = createExtensionStorage(createMemoryStorage({}));
    await storage.setFavorite("gemini", true);
    await storage.setBuiltInVisible("gemini", false);
    await storage.saveSubscription({
      providerId: "chatgpt",
      linkedToolId: "chatgpt",
      name: "ChatGPT",
      plan: "Plus",
      price: "$20/mo",
      originalPrice: null,
      active: true,
      nextBillingDate: null,
      daysUntilBilling: null,
      usagePercent: null,
      usageLabel: null,
      error: null,
      loginUrl: null,
      homeUrl: null,
      lastUpdated: "2026-08-30T10:00:00.000Z",
    });

    const state = await storage.resetLauncher();

    expect(state).toMatchObject({
      favorites: ["chatgpt", "claude", "cursor"],
      recent: [],
      usage: {},
      customTools: [],
      toolOrder: [],
      hiddenBuiltInTools: [],
    });
    expect(state.subscriptions.chatgpt.plan).toBe("Plus");
  });
});
