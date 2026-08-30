import { describe, expect, it } from "vitest";
import { createPreferencesStore, type PreferencesAdapter } from "./index";

function createMemoryPreferences(seed: Record<string, unknown>): PreferencesAdapter {
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

describe("Preferences", () => {
  it("migrates legacy theme and locale keys", async () => {
    const store = createPreferencesStore(createMemoryPreferences({ theme: "dark", locale: "zh" }));

    expect(await store.load()).toEqual({
      version: 1,
      theme: "dark",
      locale: "zh",
      defaultView: "home",
    });
  });

  it("serializes concurrent preference updates", async () => {
    const store = createPreferencesStore(createMemoryPreferences({}));

    await Promise.all([store.update({ theme: "light" }), store.update({ defaultView: "tools" })]);

    expect(await store.load()).toMatchObject({ theme: "light", defaultView: "tools" });
  });

  it("resets all preferences to defaults", async () => {
    const store = createPreferencesStore(createMemoryPreferences({}));
    await store.update({ theme: "dark", locale: "zh", defaultView: "tools" });

    expect(await store.reset()).toEqual({
      version: 1,
      theme: "system",
      locale: "en",
      defaultView: "home",
    });
  });
});
