import { useEffect, useState, useCallback, useRef } from "react";
import { isFreePlan, type SubscriptionInfo } from "../providers/base";
import { loadSubscriptions, loadCardOrder, saveCardOrder } from "../storage";
import { SummaryCard } from "./components/SummaryCard";
import { SubscriptionCard } from "./components/SubscriptionCard";
import { SkeletonCard } from "./components/SkeletonCard";
import { providers } from "../providers";
import { saveSubscription } from "../storage";
import "./styles.css";

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

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  // Load theme on mount
  useEffect(() => {
    chrome.storage.local.get("theme").then((r) => {
      const saved = (r.theme as ThemeMode) || "system";
      setTheme(saved);
      applyTheme(saved);
      setResolvedTheme(getResolvedTheme(saved));
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

  useEffect(() => {
    void load().then(async (data) => {
      // Auto-refresh providers that need login or have no cached data
      const needsRefresh = providers.some(
        (p) => !data[p.id] || data[p.id].loginUrl
      );
      if (needsRefresh) {
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
        setRefreshing(false);
      }
    });
  }, [load]);

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
    theme === "light" ? "Theme: Light" : theme === "dark" ? "Theme: Dark" : "Theme: Auto";

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">S</div>
          <span className="brand">SubLens</span>
        </div>
        <div className="header-actions">
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
          <button
            className={`icon-btn ${refreshing ? "spinning" : ""}`}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh all"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M13.65 2.35A7.96 7.96 0 008 0C3.58 0 0 3.58 0 8s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 018 14 6 6 0 018 2c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z"
                fill="currentColor"
              />
            </svg>
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
                      active: false,
                      nextBillingDate: null,
                      daysUntilBilling: null,
                      usagePercent: null,
                      usageLabel: null,
                      error: "Click refresh to load",
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
        All data stored locally
      </footer>
    </div>
  );
}
