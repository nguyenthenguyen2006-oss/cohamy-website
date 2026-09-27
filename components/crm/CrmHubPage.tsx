import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { crmHubs, visibleModules, type CrmModule } from "@/lib/crm/modules";
import type { Principal } from "@/lib/crm/types";
import { CrmModuleIcon } from "./ModuleIcon";
import { ParticleNetwork } from "./ParticleNetwork";

export function CrmHubPage({ hubId, user }: { hubId: string; user: Principal }) {
  const hub = crmHubs.find((h) => h.id === hubId);
  if (!hub) notFound();

  const allowed = visibleModules(user);
  const hubModules = allowed.filter((m) => hub.moduleIds.includes(m.id));

  const root = `/${user.area}`;

  return (
    <div className="crm-hub-page">
      <ParticleNetwork tone="white" />
      <div className="crm-hub-container">
        <nav className="crm-hub-nav" aria-label="Đường dẫn">
          <Link href={root} className="crm-hub-back">
            <ArrowLeft size={16} aria-hidden />
            <span>Quay lại Hệ thống quản trị</span>
          </Link>
          <span className="crm-hub-breadcrumb-sep">/</span>
          <span className="crm-hub-current">{hub.label}</span>
        </nav>

        <header className="crm-hub-header">
          <div
            className="crm-hub-badge-icon"
            style={{ background: hub.gradient }}
            aria-hidden
          >
            <CrmModuleIcon name={hub.icon} size={36} color="#ffffff" />
          </div>
          <div className="crm-hub-title-box">
            <h1>{hub.label}</h1>
            <p>{hub.description}</p>
          </div>
        </header>

        {hubModules.length === 0 ? (
          <div className="crm-hub-empty" role="alert">
            <h2>Chưa được cấp quyền</h2>
            <p>Tài khoản của bạn chưa có quyền truy cập phân hệ nào trong nhóm này.</p>
            <Link href={root} className="button button--secondary">
              Về trang chủ
            </Link>
          </div>
        ) : (
          <section className="crm-hub-section" aria-label="Danh sách phân hệ">
            <h2 className="sr-only">Các phân hệ trực thuộc</h2>
            <div className="crm-hub-grid">
              {hubModules.map((m: CrmModule) => (
                <Link
                  key={m.id}
                  href={`${root}/${m.id}`}
                  className="crm-hub-submodule-card"
                >
                  <div
                    className="crm-hub-submodule-icon"
                    style={{ background: hub.gradient }}
                    aria-hidden
                  >
                    <CrmModuleIcon name={m.icon} size={28} color="#ffffff" />
                  </div>
                  <div className="crm-hub-submodule-info">
                    <h3>{m.label}</h3>
                    <p>{m.shortLabel}</p>
                  </div>
                  <div className="crm-hub-submodule-action" aria-hidden>
                    <span>Mở</span>
                    <ArrowRight size={16} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
