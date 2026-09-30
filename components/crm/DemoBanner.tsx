import "server-only";

export function DemoBanner() {
  const isDemo =
    process.env.CRM_ENVIRONMENT === "DEMO" ||
    process.env.CRM_DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_CRM_DEMO === "true";

  if (!isDemo) return null;

  return (
    <aside className="crm-demo-banner" role="status" aria-label="Môi trường demo">
      <span className="crm-demo-banner__badge">DEMO</span>
      <span className="crm-demo-banner__text">MÔI TRƯỜNG DEMO — DỮ LIỆU GIẢ LẬP</span>
      <span className="crm-demo-banner__sub">
        Dữ liệu mô phỏng phục vụ trải nghiệm tính năng nội bộ
      </span>
    </aside>
  );
}
