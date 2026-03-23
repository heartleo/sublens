import { useEffect, useState, useCallback, useRef } from "react";
import { isFreePlan, type SubscriptionInfo } from "../providers/base";
import { loadSubscriptions, loadCardOrder, saveCardOrder } from "../storage";
import { SummaryCard } from "./components/SummaryCard";
import { SubscriptionCard } from "./components/SubscriptionCard";
import { SkeletonCard } from "./components/SkeletonCard";
import { providers } from "../providers";
import { saveSubscription } from "../storage";
import { I18nContext, LocaleContext, getMessages, type Locale } from "../i18n";
import "./styles.css";

const locales: Locale[] = ["en", "zh"];

const defaultOrder = providers.map((p) => p.id);

type ThemeMode = "system" | "light" | "dark";

function applyTheme(mode: ThemeMode) {
  if (mode === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", mode);
  }
}

function getResolvedTheme(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const themeOrder: ThemeMode[] = ["light", "dark", "system"];

export default function App() {
  const [subs, setSubs] = useState<Record<string, SubscriptionInfo>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [, setResolvedTheme] = useState<"light" | "dark">("dark");
  const [locale, setLocale] = useState<Locale>("en");
  const t = getMessages(locale);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  // Load theme and locale on mount
  useEffect(() => {
    chrome.storage.local.get(["theme", "locale"]).then((r) => {
      const saved = (r.theme as ThemeMode) || "system";
      setTheme(saved);
      applyTheme(saved);
      setResolvedTheme(getResolvedTheme(saved));
      if (r.locale) setLocale(r.locale as Locale);
    });

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => setResolvedTheme(getResolvedTheme(theme));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const cycleTheme = () => {
    const next = themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length];
    setTheme(next);
    applyTheme(next);
    setResolvedTheme(getResolvedTheme(next));
    chrome.storage.local.set({ theme: next });
  };

  const cycleLocale = () => {
    const next = locales[(locales.indexOf(locale) + 1) % locales.length];
    setLocale(next);
    chrome.storage.local.set({ locale: next });
  };

  const load = useCallback(async () => {
    const [data, savedOrder] = await Promise.all([loadSubscriptions(), loadCardOrder()]);
    setSubs(data);
    if (savedOrder) {
      const merged = [
        ...savedOrder.filter((id) => defaultOrder.includes(id)),
        ...defaultOrder.filter((id) => !savedOrder.includes(id)),
      ];
      setOrder(merged);
    }
    setLoaded(true);
    return data;
  }, []);

  const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

  const silentRefresh = useCallback(async () => {
    setRefreshing(true);
    for (const provider of providers) {
      try {
        const info = await provider.fetch();
        await saveSubscription(info);
      } catch {
        // errors stored inside info
      }
    }
    await load();
    chrome.runtime.sendMessage({ type: "update-badge" }).catch(() => {});
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    void load().then(async (data) => {
      // Check if any provider is stale (>10min) or missing
      const now = Date.now();
      const isStale = providers.some((p) => {
        const info = data[p.id];
        if (!info) return true;
        const age = now - new Date(info.lastUpdated).getTime();
        return age > STALE_THRESHOLD_MS;
      });
      if (isStale) {
        await silentRefresh();
      }
    });
  }, [load, silentRefresh]);

  const handleRefresh = async () => {
    setRefreshing(true);
    for (const provider of providers) {
      try {
        const info = await provider.fetch();
        await saveSubscription(info);
      } catch {
        // errors stored inside info
      }
    }
    await load();
    chrome.runtime.sendMessage({ type: "update-badge" }).catch(() => {});
    setRefreshing(false);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    dragNodeRef.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = "move";
    requestAnimationFrame(() => {
      dragNodeRef.current?.classList.add("dragging");
    });
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIndex !== null && idx !== dragIndex) {
      setOverIndex(idx);
    }
  };

  const handleDragEnd = async () => {
    dragNodeRef.current?.classList.remove("dragging");
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const newOrder = [...order];
      const [moved] = newOrder.splice(dragIndex, 1);
      newOrder.splice(overIndex, 0, moved);
      setOrder(newOrder);
      await saveCardOrder(newOrder);
    }
    setDragIndex(null);
    setOverIndex(null);
    dragNodeRef.current = null;
  };

  const entries = order.map((id) => ({
    id,
    info: subs[id],
    provider: providers.find((p) => p.id === id)!,
  }));

  const [highlightPaid, setHighlightPaid] = useState(false);

  const paidIds = new Set(
    entries.filter((e) => e.info?.active && !isFreePlan(e.info)).map((e) => e.id)
  );
  const paidCount = paidIds.size;
  const totalMonthly = entries.reduce((sum, e) => {
    if (!e.info?.price) return sum;
    const m = e.info.price.match(/\$([0-9.]+)/);
    return m ? sum + parseFloat(m[1]) : sum;
  }, 0);

  const themeTitle =
    theme === "light" ? t.themeLight : theme === "dark" ? t.themeDark : t.themeAuto;

  return (
    <LocaleContext.Provider value={locale}>
    <I18nContext.Provider value={t}>
    <div className="app">
      {/* Header */}
      <header className="header">
        <div
          className="header-left"
          onDoubleClick={handleRefresh}
          title={t.refreshTip}
          style={{ cursor: "pointer", userSelect: "none" }}
        >
          <div className={`logo ${refreshing ? "spinning" : ""}`}>S</div>
          <span className="brand">SubLens</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={cycleLocale} title={locale.toUpperCase()}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{locale.toUpperCase()}</span>
          </button>
          <button className="icon-btn" onClick={cycleTheme} title={themeTitle}>
            {theme === "light" ? (
              /* Sun */
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.36-7.36l-1.42 1.42M7.05 16.95l-1.42 1.42m12.72 0l-1.42-1.42M7.05 7.05L5.63 5.63"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : theme === "dark" ? (
              /* Moon */
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21.75 15.5a9.72 9.72 0 01-13.25-13.25A10 10 0 1021.75 15.5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              /* Monitor = Auto/System */
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <rect
                  x="2"
                  y="3"
                  width="20"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M8 21h8m-4-4v4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Summary strip */}
      {loaded && (
        <SummaryCard
          paidCount={paidCount}
          totalMonthly={totalMonthly}
          onPaidDoubleClick={() => setHighlightPaid((v) => !v)}
        />
      )}

      {/* Subscription cards */}
      <div className="card-list">
        {!loaded
          ? providers.map((p) => <SkeletonCard key={p.id} />)
          : entries.map(({ id, info, provider }, i) => (
              <div
                key={id}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={`drag-wrapper ${
                  dragIndex !== null && overIndex === i ? "drag-over" : ""
                } ${dragIndex === i ? "drag-source" : ""}`}
              >
                <SubscriptionCard
                  highlight={highlightPaid && paidIds.has(id)}
                  dim={highlightPaid && !paidIds.has(id)}
                  info={
                    info ?? {
                      id: provider.id,
                      name: provider.name,
                      plan: "",
                      price: "",
                      originalPrice: null,
                      active: false,
                      nextBillingDate: null,
                      daysUntilBilling: null,
                      usagePercent: null,
                      usageLabel: null,
                      error: t.clickToLoad,
                      loginUrl: null,
                      homeUrl: null,
                      lastUpdated: "",
                    }
                  }
                />
              </div>
            ))}
      </div>

      {/* Footer */}
      <footer className="footer">
        <span className="footer-dot" />
        {t.storedLocally}
      </footer>
    </div>
    </I18nContext.Provider>
    </LocaleContext.Provider>
  );
}
