import { useI18n } from "../../i18n";

interface Props {
  paidCount: number;
  totalMonthly: number;
  onPaidDoubleClick?: () => void;
}

export function SummaryCard({ paidCount, totalMonthly, onPaidDoubleClick }: Props) {
  const t = useI18n();
  return (
    <div className="summary">
      <div
        className="summary-item summary-item-interactive"
        onDoubleClick={onPaidDoubleClick}
        title={t.highlightPaidTip}
      >
        <span className="summary-value">{paidCount}</span>
        <span className="summary-label">{t.paid}</span>
      </div>
      <div className="summary-divider" />
      <div className="summary-item">
        <span className="summary-value accent">${totalMonthly.toFixed(2)}</span>
        <span className="summary-label">{t.monthly}</span>
      </div>
    </div>
  );
}
