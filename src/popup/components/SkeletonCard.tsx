export function SkeletonCard() {
  return (
    <div className="skeleton">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          className="skeleton-line"
          style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="skeleton-line" style={{ width: "60%" }} />
          <div className="skeleton-line" style={{ width: "40%", height: 10 }} />
        </div>
      </div>
      <div className="skeleton-line" style={{ width: "80%" }} />
      <div className="skeleton-line" style={{ width: "100%", height: 4 }} />
    </div>
  );
}
