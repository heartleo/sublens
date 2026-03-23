import { useState } from "react";
import { isFreePlan, type SubscriptionInfo } from "../../providers/base";

interface Props {
  info: SubscriptionInfo;
  highlight?: boolean;
  dim?: boolean;
}

const iconMeta: Record<string, { logo: string; letter: string; className: string }> = {
  cursor: { logo: "logos/cursor.svg", letter: "C", className: "cursor" },
  copilot: { logo: "logos/copilot.svg", letter: "G", className: "copilot" },
  chatgpt: { logo: "logos/chatgpt.svg", letter: "G", className: "chatgpt" },
  claude: { logo: "logos/claude.svg", letter: "C", className: "claude" },
  googleone: { logo: "logos/googleone.svg", letter: "G", className: "googleone" },
};

export function SubscriptionCard({ info, highlight, dim }: Props) {
  const meta = iconMeta[info.id] ?? { logo: "", letter: "?", className: "" };
  const [imgFailed, setImgFailed] = useState(false);

  const needsLogin = !!info.loginUrl;
  const hasError = !!info.error && !needsLogin;
  const isFree = isFreePlan(info);
  const isPaid = info.active && !isFree;

  return (
    <div
      className={`sub-card ${hasError ? "has-error" : ""} ${highlight ? "highlight" : ""} ${dim ? "dimmed" : ""}`}
      onDoubleClick={() => {
        if (!needsLogin && info.homeUrl) {
          chrome.tabs.create({ url: info.homeUrl });
        }
      }}
    >
      <div className="sub-card-header">
        <div className={`sub-icon ${meta.className}`}>
          {meta.logo && !imgFailed ? (
            <img
              src={meta.logo}
              alt={info.name}
              width={24}
              height={24}
              style={{ borderRadius: 4, objectFit: "contain" }}
              onError={() => setImgFailed(true)}
            />
          ) : (
            meta.letter
          )}
        </div>

        <div className="sub-info">
          <div className="sub-top-row">
            <span className="sub-name">{info.name}</span>
            {info.plan && (
              <span className={`plan-badge ${isPaid ? "paid" : "free"}`}>{info.plan}</span>
            )}
          </div>
          {needsLogin ? (
            <div className="sub-detail connect">
              <span>Connect your account</span>
              <button
                className="connect-btn"
                onClick={() => chrome.tabs.create({ url: info.loginUrl! })}
              >
                Sign in
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 3l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ) : hasError ? (
            <div className="sub-detail error">{info.error}</div>
          ) : isPaid && info.nextBillingDate ? (
            <div className="sub-detail">
              {info.originalPrice && (
                <span className="price-original">{info.originalPrice}</span>
              )}
              {info.price}
              <span className="sep" />
              Renews {info.nextBillingDate}
              {info.daysUntilBilling != null && (
                <span className="days-left">{info.daysUntilBilling}d</span>
              )}
            </div>
          ) : (
            <div className="sub-detail dim">
              {isFree ? "Free plan" : info.active ? (
                <>
                  {info.originalPrice && <span className="price-original">{info.originalPrice}</span>}
                  {info.price || "Active"}
                </>
              ) : "Not subscribed"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
