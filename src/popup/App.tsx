import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { getMessages, I18nContext, LocaleContext, type Locale } from "../i18n";
import { createPermissionManager } from "../permissions";
import { providers } from "../providers";
import { isFreePlan } from "../providers/base";
import { extensionStorage, type ExtensionState } from "../storage";
import {
  getBuiltInTool,
  listBuiltInTools,
  searchBuiltInTools,
  type ToolCategory,
  type ToolDefinition,
} from "../tools";
import { SubscriptionPanel } from "./components/SubscriptionPanel";
import { ToolCard } from "./components/ToolCard";
import { ToolLogo } from "./components/ToolLogo";
import "./styles.css";

type ThemeMode = "system" | "light" | "dark";
type CategoryFilter = "all" | ToolCategory;
type View = "home" | "tools";
type DropPosition = "before" | "after";

const locales: Locale[] = ["en", "zh"];
const themes: ThemeMode[] = ["light", "dark", "system"];
const views: View[] = ["home", "tools"];
const categories = ["all", "chat", "create", "code", "explore"] as const;
const defaultFavoriteIds = ["chatgpt", "claude", "cursor"];
const tools = listBuiltInTools();
const categoryCounts = tools.reduce<Record<ToolCategory, number>>(
  (counts, tool) => {
    counts[tool.category] += 1;
    return counts;
  },
  { chat: 0, create: 0, code: 0, explore: 0 }
);
const permissionManager = createPermissionManager(
  providers.map((provider) => ({
    providerId: provider.id,
    permissions: provider.permissions,
  })),
  {
    contains: (permissions) => chrome.permissions.contains(permissions),
    request: (permissions) => chrome.permissions.request(permissions),
    remove: (permissions) => chrome.permissions.remove(permissions),
  }
);

function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  root.classList.add("theme-changing");
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove("theme-changing"));
  });
}

function resetPopupScroll(): void {
  document.body.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function monthlyPrice(price: string): number | null {
  if (!price.startsWith("$") || price.includes("/user")) return null;
  const amount = Number(price.match(/^\$([\d.]+)/)?.[1]);
  if (!Number.isFinite(amount)) return null;
  return price.includes("/yr") ? amount / 12 : amount;
}

function categoryLabel(category: ToolCategory, locale: Locale): string {
  const labels: Record<Locale, Record<ToolCategory, string>> = {
    en: {
      chat: "Chat",
      create: "Create",
      code: "Code",
      explore: "Explore",
    },
    zh: { chat: "对话", create: "创作", code: "编程", explore: "探索" },
  };
  return labels[locale][category];
}

function orderTools(toolOrder: readonly string[]): readonly ToolDefinition[] {
  const toolsById = new Map(tools.map((tool) => [tool.id, tool]));
  const ordered: ToolDefinition[] = [];
  const seen = new Set<string>();

  for (const toolId of toolOrder) {
    const tool = toolsById.get(toolId);
    if (!tool || seen.has(toolId)) continue;
    ordered.push(tool);
    seen.add(toolId);
  }

  for (const tool of tools) {
    if (!seen.has(tool.id)) ordered.push(tool);
  }

  return ordered;
}

function moveTool(
  currentTools: readonly ToolDefinition[],
  sourceId: string,
  targetId: string,
  position: DropPosition
): string[] {
  const nextIds = currentTools.map((tool) => tool.id).filter((toolId) => toolId !== sourceId);
  const targetIndex = nextIds.indexOf(targetId);
  if (targetIndex < 0) return currentTools.map((tool) => tool.id);
  nextIds.splice(targetIndex + (position === "after" ? 1 : 0), 0, sourceId);
  return nextIds;
}

export default function App() {
  const [state, setState] = useState<ExtensionState | null>(null);
  const [connections, setConnections] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [activeView, setActiveView] = useState<View>("home");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [locale, setLocale] = useState<Locale>("en");
  const [subscriptionsOpen, setSubscriptionsOpen] = useState(false);
  const [pendingProviderId, setPendingProviderId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [draggingToolId, setDraggingToolId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    toolId: string;
    position: DropPosition;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const subscriptionButtonRef = useRef<HTMLButtonElement>(null);
  const viewRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const categoryRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingSearchFocusRef = useRef(false);
  const deferredQuery = useDeferredValue(query);
  const t = getMessages(locale);

  const loadRuntimeState = useCallback(async () => {
    const [nextState, connectionEntries] = await Promise.all([
      extensionStorage.load(),
      Promise.all(
        providers.map(
          async (provider) =>
            [provider.id, await permissionManager.isConnected(provider.id)] as const
        )
      ),
    ]);
    setState(nextState);
    setConnections(Object.fromEntries(connectionEntries));
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      extensionStorage.load(),
      Promise.all(
        providers.map(
          async (provider) =>
            [provider.id, await permissionManager.isConnected(provider.id)] as const
        )
      ),
      chrome.storage.local.get(["theme", "locale"]),
    ]).then(([nextState, connectionEntries, preferences]) => {
      if (!active) return;
      const savedTheme = (preferences.theme as ThemeMode | undefined) ?? "system";
      const savedLocale = (preferences.locale as Locale | undefined) ?? "en";
      applyTheme(savedTheme);
      setTheme(savedTheme);
      setLocale(savedLocale);
      setState(nextState);
      setConnections(Object.fromEntries(connectionEntries));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (activeView === "tools") searchRef.current?.focus();
        else {
          pendingSearchFocusRef.current = true;
          setActiveView("tools");
          requestAnimationFrame(resetPopupScroll);
        }
      }
      if (event.key === "Escape") {
        if (subscriptionsOpen) {
          setSubscriptionsOpen(false);
          requestAnimationFrame(() => subscriptionButtonRef.current?.focus());
        } else {
          setQuery("");
          setSelectedIndex(0);
        }
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeView, subscriptionsOpen]);

  useEffect(() => {
    if (activeView !== "tools" || !pendingSearchFocusRef.current) return;
    pendingSearchFocusRef.current = false;
    searchRef.current?.focus();
  }, [activeView]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const orderedTools = useMemo(() => orderTools(state?.toolOrder ?? []), [state?.toolOrder]);
  const searchResults = useMemo(
    () => (deferredQuery.trim() ? searchBuiltInTools(deferredQuery, orderedTools) : []),
    [deferredQuery, orderedTools]
  );
  const visibleTools = useMemo(
    () => orderedTools.filter((tool) => category === "all" || tool.category === category),
    [category, orderedTools]
  );
  const favoriteIds = useMemo(
    () => new Set(state?.favorites ?? defaultFavoriteIds),
    [state?.favorites]
  );
  const favoriteTools = useMemo(
    () => orderedTools.filter((tool) => favoriteIds.has(tool.id)),
    [favoriteIds, orderedTools]
  );
  const recentTools = useMemo(
    () =>
      (state?.recent ?? [])
        .map(({ toolId }) => getBuiltInTool(toolId))
        .filter((tool): tool is ToolDefinition => tool !== null),
    [state?.recent]
  );
  const activeResultIndex = Math.min(selectedIndex, Math.max(0, searchResults.length - 1));
  const connectedSnapshots = Object.values(state?.subscriptions ?? {}).filter(
    (snapshot) => connections[snapshot.providerId]
  );
  const paidCount = connectedSnapshots.filter(
    (snapshot) => snapshot.active && !isFreePlan(snapshot)
  ).length;
  const monthlyTotal = connectedSnapshots.reduce((total, snapshot) => {
    const normalized = monthlyPrice(snapshot.price);
    return normalized === null ? total : total + normalized;
  }, 0);

  const handleOpen = useCallback(async (toolId: string) => {
    const result = await chrome.runtime.sendMessage({ type: "open-tool", toolId });
    if (result?.status && result.status !== "opened") setNotice(result.message ?? result.status);
  }, []);

  const handleFavorite = useCallback(
    async (toolId: string, favorite: boolean) => {
      await chrome.runtime.sendMessage({ type: "set-favorite", toolId, favorite });
      await loadRuntimeState();
    },
    [loadRuntimeState]
  );

  const persistToolOrder = useCallback(
    (toolIds: string[]) => {
      setState((current) => (current ? { ...current, toolOrder: toolIds } : current));
      void extensionStorage.setToolOrder(toolIds).catch(() => {
        setNotice(t.orderSaveFailed);
        void loadRuntimeState();
      });
    },
    [loadRuntimeState, t.orderSaveFailed]
  );

  const reorderTool = useCallback(
    (sourceId: string, targetId: string, position: DropPosition) => {
      if (sourceId === targetId) return false;
      const nextOrder = moveTool(orderedTools, sourceId, targetId, position);
      if (nextOrder.join("\0") === orderedTools.map((tool) => tool.id).join("\0")) return false;
      persistToolOrder(nextOrder);
      return true;
    },
    [orderedTools, persistToolOrder]
  );

  const handleToolDragStart = useCallback(
    (toolId: string, event: React.DragEvent<HTMLButtonElement>) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", toolId);
      const card = event.currentTarget.closest(".tool-card");
      if (card instanceof HTMLElement) event.dataTransfer.setDragImage(card, 20, 32);
      setDraggingToolId(toolId);
      setDropTarget(null);
    },
    []
  );

  const handleToolDragOver = useCallback(
    (toolId: string, event: React.DragEvent<HTMLElement>) => {
      if (!draggingToolId || draggingToolId === toolId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const bounds = event.currentTarget.getBoundingClientRect();
      const position: DropPosition =
        event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
      setDropTarget((current) =>
        current?.toolId === toolId && current.position === position ? current : { toolId, position }
      );
    },
    [draggingToolId]
  );

  const clearToolDrag = useCallback(() => {
    setDraggingToolId(null);
    setDropTarget(null);
  }, []);

  const handleToolDrop = useCallback(
    (toolId: string, event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      const sourceId = event.dataTransfer.getData("text/plain") || draggingToolId;
      const position = dropTarget?.toolId === toolId ? dropTarget.position : "before";
      if (sourceId && reorderTool(sourceId, toolId, position)) setNotice(t.orderSaved);
      clearToolDrag();
    },
    [clearToolDrag, draggingToolId, dropTarget, reorderTool, t.orderSaved]
  );

  const handleToolMove = useCallback(
    (toolId: string, direction: "up" | "down") => {
      const currentIndex = visibleTools.findIndex((tool) => tool.id === toolId);
      const targetIndex = currentIndex + (direction === "up" ? -1 : 1);
      const target = visibleTools[targetIndex];
      if (!target) return;
      const position: DropPosition = direction === "up" ? "before" : "after";
      if (reorderTool(toolId, target.id, position)) {
        const tool = visibleTools[currentIndex];
        setNotice(`${direction === "up" ? t.movedUp : t.movedDown}: ${tool.name}`);
      }
    },
    [reorderTool, t.movedDown, t.movedUp, visibleTools]
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await chrome.runtime.sendMessage({ type: "refresh" });
      await loadRuntimeState();
      setNotice(t.refreshed);
    } finally {
      setRefreshing(false);
    }
  }, [loadRuntimeState, t.refreshed]);

  const handleConnect = useCallback(
    async (providerId: string) => {
      setPendingProviderId(providerId);
      try {
        const result = await permissionManager.connect(providerId);
        if (result.status === "connected") {
          const refreshResult = await chrome.runtime.sendMessage({
            type: "refresh-provider",
            providerId,
          });
          setNotice(
            refreshResult?.ok ? t.connectionGranted : (refreshResult?.error ?? t.connectionFailed)
          );
        } else {
          setNotice(t.connectionDenied);
        }
        await loadRuntimeState();
      } finally {
        setPendingProviderId(null);
      }
    },
    [loadRuntimeState, t.connectionDenied, t.connectionFailed, t.connectionGranted]
  );

  const handleDisconnect = useCallback(
    async (providerId: string) => {
      setPendingProviderId(providerId);
      const result = await permissionManager.disconnect(providerId);
      setNotice(result.status === "disconnected" ? t.disconnected : t.connectionFailed);
      await chrome.runtime.sendMessage({ type: "update-badge" });
      await loadRuntimeState();
      setPendingProviderId(null);
    },
    [loadRuntimeState, t.connectionFailed, t.disconnected]
  );

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((current) => Math.min(current + 1, searchResults.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter" && searchResults[activeResultIndex]) {
      event.preventDefault();
      void handleOpen(searchResults[activeResultIndex].id);
    } else if (event.key === "Escape") {
      setQuery("");
      setSelectedIndex(0);
    }
  };

  const selectView = (view: View) => {
    setActiveView(view);
    setQuery("");
    setSelectedIndex(0);
    requestAnimationFrame(resetPopupScroll);
  };

  const handleViewKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % views.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + views.length) % views.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = views.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectView(views[nextIndex]);
    viewRefs.current[nextIndex]?.focus();
  };

  const cycleTheme = () => {
    const next = themes[(themes.indexOf(theme) + 1) % themes.length];
    setTheme(next);
    applyTheme(next);
    void chrome.storage.local.set({ theme: next });
  };

  const handleCategoryKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % categories.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + categories.length) % categories.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = categories.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setCategory(categories[nextIndex]);
    categoryRefs.current[nextIndex]?.focus();
  };

  const cycleLocale = () => {
    const next = locales[(locales.indexOf(locale) + 1) % locales.length];
    setLocale(next);
    void chrome.storage.local.set({ locale: next });
  };

  const toolDetail = (tool: ToolDefinition) =>
    tool.subcategory ? t[tool.subcategory] : categoryLabel(tool.category, locale);

  const closeSubscriptions = () => {
    setSubscriptionsOpen(false);
    requestAnimationFrame(() => subscriptionButtonRef.current?.focus());
  };

  return (
    <LocaleContext.Provider value={locale}>
      <I18nContext.Provider value={t}>
        <main className="app-shell" inert={subscriptionsOpen}>
          <h1 className="visually-hidden">SubLens</h1>
          <header className="app-header">
            <div className="brand-lockup">
              <span className="brand-mark">S</span>
              <span>
                <strong>SubLens</strong>
                <small>{t.launcherTagline}</small>
              </span>
            </div>
            <div className="header-actions">
              <button
                type="button"
                className="icon-button language-button"
                aria-label={t.switchLanguage}
                title={t.switchLanguage}
                onClick={cycleLocale}
              >
                {locale.toUpperCase()}
              </button>
              <button
                type="button"
                className="icon-button theme-button is-active"
                aria-label={`${t.switchTheme}: ${t[themes[(themes.indexOf(theme) + 1) % themes.length]]}`}
                title={t[theme]}
                onClick={cycleTheme}
              >
                {theme === "light" ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
                  </svg>
                ) : theme === "dark" ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20.5 15.6A9 9 0 0 1 8.4 3.5a9 9 0 1 0 12.1 12.1Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="13" rx="2" />
                    <path d="M8 21h8m-4-4v4" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className={`icon-button refresh-button ${refreshing ? "is-refreshing" : ""}`}
                aria-label={t.refresh}
                title={t.refresh}
                disabled={refreshing}
                onClick={() => void handleRefresh()}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />
                </svg>
              </button>
            </div>
          </header>

          <div className="page-tabs" role="tablist" aria-label={t.mainViews}>
            {views.map((view, index) => {
              const selected = activeView === view;
              const label = view === "home" ? t.home : t.tools;
              return (
                <button
                  ref={(element) => {
                    viewRefs.current[index] = element;
                  }}
                  id={`view-${view}`}
                  key={view}
                  type="button"
                  role="tab"
                  aria-label={view === "tools" ? `${label} (${tools.length})` : label}
                  aria-selected={selected}
                  aria-controls={`${view}-view`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectView(view)}
                  onKeyDown={(event) => handleViewKeyDown(event, index)}
                >
                  {view === "home" ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9Z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 6h13M8 12h13M8 18h13" />
                      <path d="M3 6h.01M3 12h.01M3 18h.01" />
                    </svg>
                  )}
                  <span>{label}</span>
                  {view === "tools" ? (
                    <span className="tab-count" aria-hidden="true">
                      {tools.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {activeView === "home" ? (
            <div id="home-view" className="home-view" role="tabpanel" aria-labelledby="view-home">
              <button
                ref={subscriptionButtonRef}
                type="button"
                className="subscription-summary"
                onClick={() => setSubscriptionsOpen(true)}
              >
                <span>
                  <strong>{paidCount}</strong>
                  <small>{t.paid}</small>
                </span>
                <span className="summary-divider" />
                <span>
                  <strong>${monthlyTotal.toFixed(2)}</strong>
                  <small>{t.monthly}</small>
                </span>
                <span className="summary-action">{t.manage}</span>
              </button>

              <section aria-labelledby="favorites-title">
                <div className="section-heading">
                  <h2 id="favorites-title">
                    {t.favorites}
                    <span className="section-count">{favoriteTools.length}</span>
                  </h2>
                </div>
                {favoriteTools.length ? (
                  <div className="favorite-grid">
                    {favoriteTools.map((tool) => (
                      <button key={tool.id} type="button" onClick={() => void handleOpen(tool.id)}>
                        <ToolLogo tool={tool} size="small" />
                        <span>{tool.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state compact">
                    <strong>{t.noFavoritesTitle}</strong>
                    <span>{t.noFavoritesCopy}</span>
                  </div>
                )}
              </section>

              {recentTools.length ? (
                <section aria-labelledby="recent-title">
                  <div className="section-heading">
                    <h2 id="recent-title">{t.recent}</h2>
                  </div>
                  <div className="recent-list">
                    {recentTools.map((tool) => (
                      <button key={tool.id} type="button" onClick={() => void handleOpen(tool.id)}>
                        <ToolLogo tool={tool} size="small" />
                        <span>{tool.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <div
              id="tools-view"
              className="tools-view"
              role="tabpanel"
              aria-labelledby="view-tools"
            >
              <label className="search-wrap">
                <span className="visually-hidden">{t.searchPlaceholder}</span>
                <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16 16 4 4" />
                </svg>
                <input
                  ref={searchRef}
                  value={query}
                  type="search"
                  name="tool-search"
                  autoComplete="off"
                  spellCheck={false}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-label={t.searchPlaceholder}
                  aria-expanded={Boolean(query)}
                  aria-controls="search-results"
                  aria-activedescendant={
                    query && searchResults.length
                      ? `result-${searchResults[activeResultIndex].id}`
                      : undefined
                  }
                  placeholder={t.searchPlaceholder}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                />
                <kbd>⌘K</kbd>
              </label>

              {query ? (
                <section className="search-section" aria-labelledby="search-title">
                  <div className="section-heading">
                    <h2 id="search-title">
                      {t.searchResults}
                      <span className="section-count">{searchResults.length}</span>
                    </h2>
                  </div>
                  <div id="search-results" className="search-results" role="listbox">
                    {searchResults.length ? (
                      searchResults.map((tool, index) => (
                        <button
                          id={`result-${tool.id}`}
                          key={tool.id}
                          type="button"
                          role="option"
                          aria-selected={index === activeResultIndex}
                          className="search-result"
                          data-active={index === activeResultIndex}
                          onMouseEnter={() => setSelectedIndex(index)}
                          onClick={() => void handleOpen(tool.id)}
                        >
                          <ToolLogo tool={tool} size="small" />
                          <span>
                            <strong>{tool.name}</strong>
                            <small>{tool.tags.slice(0, 3).join(" · ")}</small>
                          </span>
                          <span className="open-hint">{t.open}</span>
                        </button>
                      ))
                    ) : (
                      <div className="empty-state" role="status">
                        <strong>{t.noResultsTitle}</strong>
                        <span>{t.noResultsCopy}</span>
                      </div>
                    )}
                  </div>
                </section>
              ) : (
                <>
                  <p id="tool-reorder-instructions" className="visually-hidden">
                    {t.reorderInstructions}
                  </p>
                  <div className="category-tabs" role="tablist" aria-label={t.categories}>
                    {categories.map((item, index) => {
                      const label = item === "all" ? t.all : categoryLabel(item, locale);
                      const count = item === "all" ? tools.length : categoryCounts[item];
                      return (
                        <button
                          ref={(element) => {
                            categoryRefs.current[index] = element;
                          }}
                          id={`category-${item}`}
                          key={item}
                          type="button"
                          role="tab"
                          aria-label={`${label} (${count})`}
                          aria-selected={category === item}
                          aria-controls="tool-panel"
                          tabIndex={category === item ? 0 : -1}
                          onClick={() => setCategory(item)}
                          onKeyDown={(event) => handleCategoryKeyDown(event, index)}
                        >
                          <span className="category-label">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div
                    id="tool-panel"
                    className="tool-grid"
                    role="tabpanel"
                    aria-labelledby={`category-${category}`}
                  >
                    {visibleTools.map((tool) => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        detail={toolDetail(tool)}
                        favorite={favoriteIds.has(tool.id)}
                        openLabel={t.open}
                        favoriteLabel={favoriteIds.has(tool.id) ? t.removeFavorite : t.addFavorite}
                        reorderLabel={t.reorderTool}
                        dragging={draggingToolId === tool.id}
                        dropPosition={dropTarget?.toolId === tool.id ? dropTarget.position : null}
                        onOpen={(toolId) => void handleOpen(toolId)}
                        onFavorite={(toolId, favorite) => void handleFavorite(toolId, favorite)}
                        onDragStart={handleToolDragStart}
                        onDragOver={handleToolDragOver}
                        onDrop={handleToolDrop}
                        onDragEnd={clearToolDrag}
                        onMove={handleToolMove}
                        onReorderHint={() => setNotice(t.reorderInstructions)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </main>

        {notice ? (
          <div
            className={`notice-toast ${subscriptionsOpen ? "is-dialog-open" : ""}`}
            role="status"
          >
            {notice}
          </div>
        ) : null}

        <SubscriptionPanel
          open={subscriptionsOpen}
          providers={providers}
          subscriptions={state?.subscriptions ?? {}}
          connections={connections}
          pendingProviderId={pendingProviderId}
          messages={t}
          onClose={closeSubscriptions}
          onConnect={(providerId) => void handleConnect(providerId)}
          onDisconnect={(providerId) => void handleDisconnect(providerId)}
          onSignIn={(providerId) =>
            void chrome.runtime.sendMessage({ type: "open-provider-login", providerId })
          }
        />
      </I18nContext.Provider>
    </LocaleContext.Provider>
  );
}
