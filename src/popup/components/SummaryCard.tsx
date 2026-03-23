interface Props {
  paidCount: number;
  totalMonthly: number;
  onPaidDoubleClick?: () => void;
}

export function SummaryCard({ paidCount, totalMonthly, onPaidDoubleClick }: Props) {
  return (
    <div className="summary">
      <div
        className="summary-item summary-item-interactive"
        onDoubleClick={onPaidDoubleClick}
        title="Double-click to highlight paid"
      >
        <span className="summary-value">{paidCount}</span>
        <span className="summary-label">Paid</span>
      </div>
      <div className="summary-divider" />
      <div className="summary-item">
        <span className="summary-value accent">${totalMonthly.toFixed(0)}</span>
        <span className="summary-label">Monthly</span>
      </div>
    </div>
  );
}
