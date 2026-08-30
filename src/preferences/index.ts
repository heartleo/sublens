import type { DefaultView, Preferences, ThemeMode } from "./types";
import type { Locale } from "../i18n";

export const PREFERENCES_KEY = "sublens_preferences";
const LEGACY_THEME_KEY = "theme";
const LEGACY_LOCALE_KEY = "locale";

const DEFAULT_PREFERENCES: Preferences = {
  version: 1,
  theme: "system",
  locale: "en",
  defaultView: "home",
};

export interface PreferencesAdapter {
  read(keys: readonly string[]): Promise<Record<string, unknown>>;
  write(items: Record<string, unknown>): Promise<void>;
}

export interface PreferencesStore {
  load(): Promise<Preferences>;
  update(patch: Partial<Omit<Preferences, "version">>): Promise<Preferences>;
  reset(): Promise<Preferences>;
}

function isTheme(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh";
}

function isDefaultView(value: unknown): value is DefaultView {
  return value === "home" || value === "tools";
}

function normalizePreferences(value: unknown): Preferences | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<Preferences>;
  if (candidate.version !== 1) return null;
  return {
    version: 1,
    theme: isTheme(candidate.theme) ? candidate.theme : DEFAULT_PREFERENCES.theme,
    locale: isLocale(candidate.locale) ? candidate.locale : DEFAULT_PREFERENCES.locale,
    defaultView: isDefaultView(candidate.defaultView)
      ? candidate.defaultView
      : DEFAULT_PREFERENCES.defaultView,
  };
}

export function createPreferencesStore(adapter: PreferencesAdapter): PreferencesStore {
  let mutationQueue: Promise<void> = Promise.resolve();

  async function load(): Promise<Preferences> {
    const stored = await adapter.read([PREFERENCES_KEY, LEGACY_THEME_KEY, LEGACY_LOCALE_KEY]);
    const preferences = normalizePreferences(stored[PREFERENCES_KEY]);
    if (preferences) return preferences;

    const migrated: Preferences = {
      ...DEFAULT_PREFERENCES,
      theme: isTheme(stored[LEGACY_THEME_KEY])
        ? stored[LEGACY_THEME_KEY]
        : DEFAULT_PREFERENCES.theme,
      locale: isLocale(stored[LEGACY_LOCALE_KEY])
        ? stored[LEGACY_LOCALE_KEY]
        : DEFAULT_PREFERENCES.locale,
    };
    await adapter.write({ [PREFERENCES_KEY]: migrated });
    return migrated;
  }

  function mutate(update: (current: Preferences) => Preferences): Promise<Preferences> {
    const operation = mutationQueue.then(async () => {
      const next = update(await load());
      await adapter.write({ [PREFERENCES_KEY]: next });
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
    update(patch) {
      return mutate((current) => ({ ...current, ...patch, version: 1 }));
    },
    async reset() {
      const next = { ...DEFAULT_PREFERENCES };
      await adapter.write({ [PREFERENCES_KEY]: next });
      return next;
    },
  };
}

const chromePreferencesAdapter: PreferencesAdapter = {
  read: async (keys) => chrome.storage.local.get([...keys]),
  write: async (items) => chrome.storage.local.set(items),
};

export const preferencesStore = createPreferencesStore(chromePreferencesAdapter);
export { DEFAULT_PREFERENCES };
export type { DefaultView, Preferences, ThemeMode } from "./types";
