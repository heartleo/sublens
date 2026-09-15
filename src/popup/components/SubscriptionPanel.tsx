import type { SubscriptionProvider } from "../../providers";
import { isFreePlan, type SubscriptionInfo } from "../../providers/base";
import { formatRelativeTime, type Locale } from "../../i18n";
import type { LocaleMessages } from "../../i18n/locales/en";
import { getBuiltInTool } from "../../tools";
import { ToolLogo } from "../../components/ToolLogo";

interface SubscriptionPanelProps {
  open: boolean;
  providers: readonly SubscriptionProvider[];
  subscriptions: Record<string, SubscriptionInfo>;
  connections: Record<string, boolean>;
  pendingProviderId: string | null;
  messages: LocaleMessages;
  locale: Locale;
  refreshing: boolean;
  onClose(): void;
  onConnect(providerId: string): void;
  onDisconnect(providerId: string): void;
  onSignIn(providerId: string): void;
  onRefresh(): void;
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.023 9.348h4.992v-4.99M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function AccountStatusIcon({ connected }: { connected: boolean }) {
  return connected ? (
    <svg className="connection-status-icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" />
      <path d="m5.4 8 1.65 1.65 3.55-3.7" />
    </svg>
  ) : (
    <svg className="connection-status-icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="5.2" r="2.1" />
      <path d="M4.2 12.5c.4-2.15 1.67-3.25 3.8-3.25s3.4 1.1 3.8 3.25" />
    </svg>
  );
}

export function SubscriptionPanel({
  open,
  providers,
  subscriptions,
  connections,
  pendingProviderId,
  messages: t,
  locale,
  refreshing,
  onClose,
  onConnect,
  onDisconnect,
  onSignIn,
  onRefresh,
}: SubscriptionPanelProps) {
  if (!open) return null;

  const anyConnected = providers.some((provider) => connections[provider.id] === true);
  const latestUpdate = providers.reduce<string | null>((latest, provider) => {
    if (connections[provider.id] !== true) return latest;
    const updatedAt = subscriptions[provider.id]?.lastUpdated;
    if (!updatedAt) return latest;
    return !latest || updatedAt > latest ? updatedAt : latest;
  }, null);

  return (
    <div className="dialog-layer">
      <div className="dialog-scrim" aria-hidden="true" onMouseDown={onClose} />
      <section
        className="subscription-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="subs-title"
      >
        <header className="panel-header">
          <span className="panel-heading">
            <h2 id="subs-title">{t.subscriptions}</h2>
            {anyConnected ? (
              <small className="panel-updated" role="status" aria-live="polite">
                {refreshing
                  ? t.refreshing
                  : latestUpdate
                    ? `${t.lastRefreshed} ${formatRelativeTime(latestUpdate, locale)}`
                    : t.clickToLoad}
              </small>
            ) : null}
          </span>
          <span className="header-actions">
            {anyConnected ? (
              <button
                className={`icon-button refresh-button${refreshing ? " is-spinning" : ""}`}
                type="button"
                aria-label={refreshing ? t.refreshing : t.refresh}
                disabled={refreshing}
                onClick={onRefresh}
              >
                <RefreshIcon />
              </button>
            ) : null}
            <button
              autoFocus
              className="icon-button"
              type="button"
              aria-label={t.close}
              onClick={onClose}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </span>
        </header>

        <div className="provider-list">
          {providers.map((provider) => {
            const connected = connections[provider.id] === true;
            const snapshot = subscriptions[provider.id];
            const pending = pendingProviderId === provider.id;
            const paid = snapshot?.active && !isFreePlan(snapshot);
            const providerTool = getBuiltInTool(provider.id);

            return (
              <article className="provider-row" key={provider.id}>
                {providerTool ? <ToolLogo tool={providerTool} size="small" /> : null}
                <div className="provider-copy">
                  <span className="provider-name-row">
                    <strong>{provider.name}</strong>
                    <span className={`connection-status${connected ? "" : " is-signed-out"}`}>
                      <AccountStatusIcon connected={connected} />
                      {connected ? t.connected : t.notConnected}
                    </span>
                  </span>
                  {connected ? (
                    <span
                      className={snapshot?.error ? "provider-error" : "provider-detail"}
                      role="status"
                      aria-atomic="true"
                    >
                      {snapshot?.error
                        ? snapshot.error
                        : snapshot
                          ? `${snapshot.plan || t.active}${paid && snapshot.price ? ` · ${snapshot.price}` : ""}`
                          : t.readyToRefresh}
                    </span>
                  ) : null}
                </div>
                <div className="provider-actions">
                  {connected && snapshot?.loginUrl ? (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onSignIn(provider.id)}
                    >
                      {t.signIn}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={connected ? "text-button muted" : "connect-button"}
                    disabled={pending}
                    onClick={() => (connected ? onDisconnect(provider.id) : onConnect(provider.id))}
                  >
                    {pending ? t.working : connected ? t.disconnect : t.connect}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
