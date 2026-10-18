import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  ChartLineUp,
  LockKey,
  ShieldCheck,
  ShoppingCart,
  SquaresFour,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { getVisibleHubs, visibleModules } from "@/lib/crm/modules";
import { reviewQueue } from "@/lib/crm/onboarding";
import { can } from "@/lib/crm/permissions";
import { roleDashboard } from "@/lib/crm/reports";
import { roleLabels, type Principal } from "@/lib/crm/types";
import { canManageWork, listOrders, listTasks } from "@/lib/crm/work";
import { DealerCommercePanel } from "./DealerCommercePanel";
import { CrmModuleIcon } from "./ModuleIcon";
import { OnboardingChecklist } from "./PartnerLibraryPages";
import { OrderTable, TaskList, WorkHeader } from "./WorkPages";

/*
Impeccable direction contract — seed key d6192f7e (operate / canon):
- Finish line: FINISH: This lands when it reads like canon: Modern Enterprise SaaS Standard — High-density Golden-Orange (#F59E0B / #D97706 / #EA580C) B2B SaaS workspace with warm cream surfaces (#FFFBF5), crisp white cards (#FFFFFF), persistent 256px left sidebar, 4 live operational KPI queue cards, and tabular VND numerals.
- Exemplars: Linear (high-density operational workspace, keyboard-first command bar, crisp borders); Stripe Dashboard (clear B2B financial tables, status pills, and tabular numerals)
- Keep: Persistent 256px left navigation sidebar, 4 top operational queue KPI cards, tabular-nums on all VND amounts and ratios
- Avoid: Sci-fi particle networks, floating bottom docks, neon dark-mode gradients, decorative fake charts
*/

export async function CrmDashboard({ user }: { user: Principal }) {
  const internal = user.area === "crm";
  const visibleHubs = getVisibleHubs(user);
  const modules = visibleModules(user);

  let pendingOrders: Awaited<ReturnType<typeof listOrders>> | null = null;
  let inProgressOrders: Awaited<ReturnType<typeof listOrders>> | null = null;
  let readyOrders: Awaited<ReturnType<typeof listOrders>> | null = null;
  let applications: Awaited<ReturnType<typeof reviewQueue>> | null = null;
  let tasks: Awaited<ReturnType<typeof listTasks>> = [];
  let overdue: Awaited<ReturnType<typeof listTasks>> = [];
  let roleQueue: Awaited<ReturnType<typeof roleDashboard>> = [];

  if (internal) {
    try {
      if (can(user, "orders.read")) {
        [pendingOrders, inProgressOrders, readyOrders] = await Promise.all([
          listOrders(user, { status: "PENDING_REVIEW" }),
          listOrders(user, { status: "IN_PROGRESS" }),
          listOrders(user, { status: "READY" }),
        ]);
      }
    } catch {
      pendingOrders = null;
      inProgressOrders = null;
      readyOrders = null;
    }

    try {
      if (user.role === "ADMIN") {
        applications = await reviewQueue(user);
      }
    } catch {
      applications = null;
    }

    try {
      if (canManageWork(user)) {
        [tasks, overdue] = await Promise.all([
          listTasks(user, { today: "true", pageSize: "5" }),
          listTasks(user, { overdue: "true", pageSize: "5" }),
        ]);
      }
    } catch {
      tasks = [];
      overdue = [];
    }

    try {
      roleQueue = await roleDashboard(user);
    } catch {
      roleQueue = [];
    }
  }

  // Keep Dealer Portal (/portal) 100% untouched
  if (user.area === "portal") {
    return (
      <>
        <WorkHeader
          title="Không gian đại lý"
          description={`${user.organizationName} · Danh mục và thông tin trong phạm vi của bạn.`}
          action={
            can(user, "partners.write") ? (
              <Link className="button button--primary" href="/crm/customers/new">
                Thêm khách hàng
              </Link>
            ) : undefined
          }
        />
        <OnboardingChecklist user={user} />
        {can(user, "orders.read") && <DealerCommercePanel user={user} />}
        <section className="work-section">
          <h2>Truy cập nhanh</h2>
          <div className="work-shortcuts">
            {modules
              .filter((m) => m.status === "CONNECTED")
              .map((m) => (
                <Link href={`/${user.area}/${m.id}`} key={m.id} className="crm-module-tile">
                  <CrmModuleIcon name={m.icon} size={22} />
                  <span>{m.label}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
          </div>
        </section>
        <details className="work-disclosure work-roadmap">
          <summary>Các nghiệp vụ đang hoàn thiện</summary>
          <p>Kho, ký gửi, thu chi và công nợ cần chính sách được chốt trước khi mở ghi sổ.</p>
          <ul>
            {modules
              .filter((m) => m.status === "PENDING")
              .map((m) => (
                <li key={m.id}>
                  <Link href={`/${user.area}/${m.id}`}>{m.label}</Link>
                </li>
              ))}
          </ul>
        </details>
      </>
    );
  }

  const connected = modules.filter((m) => m.status === "CONNECTED");
  const planned = modules.filter((m) => m.status === "PENDING");

  const newOrdersCount = pendingOrders?.total ?? 0;
  const inProgressCount = inProgressOrders?.total ?? 0;
  const readyCount = readyOrders?.total ?? 0;
  const overdueCount = overdue.length;
  const todayCount = tasks.length;
  const pendingAppCount = applications?.total ?? 0;

  const totalActionItems = Math.max(
    1,
    newOrdersCount + overdueCount + todayCount + pendingAppCount
  );

  const refreshed = new Date().toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  return (
    <div className="crm-dashboard-saas">
      {/* 1. Executive Command Header */}
      <header className="crm-dash-header">
        <div className="crm-dash-header__title-group">
          <div className="crm-dash-header__eyebrow-row">
            <span className="crm-dash-header__eyebrow">
              <SquaresFour size={14} weight="bold" aria-hidden="true" />
              HỆ THỐNG ĐIỀU HÀNH NỘI BỘ · COHAMY CRM
            </span>
            <span className="crm-dash-header__live-pill">
              <span className="crm-dash-header__live-dot" aria-hidden="true" />
              Trực tuyến · Chuẩn dữ liệu thực
            </span>
          </div>
          <h1>Bàn làm việc</h1>
          <p>
            Điều phối tập trung yêu cầu đặt hàng, báo giá theo phiên bản, đối tác mua đứt – ký gửi,
            tồn kho đa vị trí và công nợ theo quyền thực tế.
          </p>
        </div>

        <div className="crm-dash-header__right">
          <dl className="crm-dash-meta" aria-label="Thông tin phiên điều hành">
            <div className="crm-dash-meta__chip">
              <dt>Vai trò</dt>
              <dd>{roleLabels[user.role]}</dd>
            </div>
            <div className="crm-dash-meta__chip">
              <dt>Đơn vị</dt>
              <dd>{user.organizationName}</dd>
            </div>
            <div className="crm-dash-meta__chip">
              <dt>Cập nhật</dt>
              <dd>{refreshed}</dd>
            </div>
          </dl>

          <div className="crm-dash-quickbar" aria-label="Lối tắt tác nghiệp">
            <Link href="/crm/orders" className="button button--primary button--compact">
              <ShoppingCart size={15} weight="bold" aria-hidden="true" />
              <span>Tiếp nhận đơn ({newOrdersCount})</span>
            </Link>
            <Link href="/crm/tasks" className="button button--secondary button--compact">
              <CalendarCheck size={15} weight="bold" aria-hidden="true" />
              <span>Công việc ({overdueCount + todayCount})</span>
            </Link>
            <Link href="/crm/quotations" className="button button--secondary button--compact">
              <ChartLineUp size={15} weight="bold" aria-hidden="true" />
              <span>Báo giá phiên bản</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Bento KPI Queue Strip (4 Cards) */}
      <section className="crm-kpi-grid" aria-label="Hàng đợi tác nghiệp ưu tiên">
        <Link href="/crm/orders?status=PENDING_REVIEW" className="crm-kpi-card crm-kpi-card--amber">
          <div className="crm-kpi-card__top">
            <span className="crm-kpi-card__code">
              <ShoppingCart size={14} weight="bold" aria-hidden="true" />
              REQ · ĐƠN ĐẶT HÀNG
            </span>
            <span className="crm-kpi-card__tag">Tiếp nhận ngay</span>
          </div>
          <strong className="crm-kpi-card__value">{newOrdersCount}</strong>
          <div className="crm-kpi-card__bar" aria-hidden="true">
            <span
              style={{
                width: `${Math.min(100, Math.max(12, Math.round((newOrdersCount / totalActionItems) * 100)))}%`,
              }}
            />
          </div>
          <p className="crm-kpi-card__label">Yêu cầu mới cần tiếp nhận</p>
          <span className="crm-kpi-card__hint">
            Đang tư vấn: {inProgressCount} · Đã chốt: {readyCount}
          </span>
        </Link>

        <Link
          href="/crm/tasks?overdue=true"
          className={`crm-kpi-card ${overdueCount > 0 ? "crm-kpi-card--danger" : "crm-kpi-card--amber"}`}
        >
          <div className="crm-kpi-card__top">
            <span className="crm-kpi-card__code">
              <WarningCircle size={14} weight="bold" aria-hidden="true" />
              TSK · CẦN XỬ LÝ GẤP
            </span>
            <span className="crm-kpi-card__tag">
              {overdueCount > 0 ? "Ưu tiên cao" : "Đúng tiến độ"}
            </span>
          </div>
          <strong className="crm-kpi-card__value">{overdueCount}</strong>
          <div className="crm-kpi-card__bar" aria-hidden="true">
            <span
              style={{
                width: `${Math.min(100, Math.max(10, Math.round((overdueCount / totalActionItems) * 100)))}%`,
              }}
            />
          </div>
          <p className="crm-kpi-card__label">Việc quá hạn</p>
          <span className="crm-kpi-card__hint">Mở danh sách việc quá hạn cần hoàn tất</span>
        </Link>

        <Link href="/crm/tasks?today=true" className="crm-kpi-card crm-kpi-card--amber">
          <div className="crm-kpi-card__top">
            <span className="crm-kpi-card__code">
              <CalendarCheck size={14} weight="bold" aria-hidden="true" />
              TOD · TRONG NGÀY
            </span>
            <span className="crm-kpi-card__tag">Lịch hôm nay</span>
          </div>
          <strong className="crm-kpi-card__value">{todayCount}</strong>
          <div className="crm-kpi-card__bar" aria-hidden="true">
            <span
              style={{
                width: `${Math.min(100, Math.max(12, Math.round((todayCount / totalActionItems) * 100)))}%`,
              }}
            />
          </div>
          <p className="crm-kpi-card__label">Còn hạn hôm nay</p>
          <span className="crm-kpi-card__hint">Theo dõi nhắc việc gắn với đơn và đối tác</span>
        </Link>

        <Link href="/crm/applications" className="crm-kpi-card crm-kpi-card--amber">
          <div className="crm-kpi-card__top">
            <span className="crm-kpi-card__code">
              <ShieldCheck size={14} weight="bold" aria-hidden="true" />
              APP · XÉT DUYỆT ĐẠI LÝ
            </span>
            <span className="crm-kpi-card__tag">Hồ sơ đăng ký</span>
          </div>
          <strong className="crm-kpi-card__value">{pendingAppCount}</strong>
          <div className="crm-kpi-card__bar" aria-hidden="true">
            <span
              style={{
                width: `${Math.min(100, Math.max(12, Math.round((pendingAppCount / totalActionItems) * 100)))}%`,
              }}
            />
          </div>
          <p className="crm-kpi-card__label">Hồ sơ đối tác chờ duyệt</p>
          <span className="crm-kpi-card__hint">
            Đối chiếu thông tin đại lý, hạn mức và tuyến phân phối
          </span>
        </Link>
      </section>

      {/* 3. Main 2-Column Bento Operational Workbench */}
      <div className="crm-workbench-grid">
        {/* Left Primary Column */}
        <div className="crm-workbench-main">
          {/* Card A: Live Order Intake Queue */}
          <section className="crm-panel" aria-labelledby="new-orders-heading">
            <div className="crm-panel__head">
              <div>
                <span className="crm-panel__eyebrow">CHỨNG TỪ & ĐƠN ĐẶT HÀNG TRỰC TIẾP</span>
                <h2 id="new-orders-heading">Yêu cầu mới cần tiếp nhận</h2>
              </div>
              <div className="crm-panel__head-actions">
                <div className="crm-status-pills-row" aria-label="Tóm tắt trạng thái đơn">
                  <Link href="/crm/orders?status=PENDING_REVIEW" className="crm-mini-filter is-active">
                    Chờ tiếp nhận <strong>{newOrdersCount}</strong>
                  </Link>
                  <Link href="/crm/orders?status=IN_PROGRESS" className="crm-mini-filter">
                    Đang tư vấn <strong>{inProgressCount}</strong>
                  </Link>
                  <Link href="/crm/orders?status=READY" className="crm-mini-filter">
                    Đã chốt <strong>{readyCount}</strong>
                  </Link>
                </div>
                <Link href="/crm/orders" className="button button--secondary button--compact">
                  <span>Mở danh sách đơn</span>
                  <ArrowRight size={14} weight="bold" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <OrderTable orders={(pendingOrders?.items ?? []).slice(0, 5)} />
          </section>

          {/* Card B: Split Task Queues (Overdue & Due Today) */}
          {canManageWork(user) && (
            <div className="crm-dual-panels">
              <section className="crm-panel" aria-labelledby="overdue-tasks-heading">
                <div className="crm-panel__head">
                  <div>
                    <span className="crm-panel__eyebrow">CẢNH BÁO TIẾN ĐỘ</span>
                    <h2 id="overdue-tasks-heading">Việc quá hạn ({overdueCount})</h2>
                  </div>
                  <Link href="/crm/tasks?overdue=true" className="crm-text-action">
                    Xem tất cả →
                  </Link>
                </div>
                <TaskList tasks={overdue} />
              </section>

              <section className="crm-panel" aria-labelledby="today-tasks-heading">
                <div className="crm-panel__head">
                  <div>
                    <span className="crm-panel__eyebrow">LỊCH TRÌNH TRONG NGÀY</span>
                    <h2 id="today-tasks-heading">Còn hạn hôm nay ({todayCount})</h2>
                  </div>
                  <Link href="/crm/tasks?today=true" className="crm-text-action">
                    Mở lịch việc →
                  </Link>
                </div>
                <TaskList tasks={tasks} />
              </section>
            </div>
          )}

          {/* Card C: 11 Operational Hubs (Bento Hub Corridors) */}
          <section className="crm-panel" aria-labelledby="hubs-directory-heading">
            <div className="crm-panel__head">
              <div>
                <span className="crm-panel__eyebrow">KIẾN TRÚC 11 TUYẾN NGHIỆP VỤ (BENTO HUBS)</span>
                <h2 id="hubs-directory-heading">Không gian nghiệp vụ ({visibleHubs.length} nhóm)</h2>
              </div>
              <span className="crm-panel__badge">{connected.length} phân hệ đang mở</span>
            </div>

            <div className="crm-hub-grid">
              {visibleHubs.map(({ hub, modules: hubModules }) => {
                const activeItems = hubModules.filter((item) => item.status === "CONNECTED");
                return (
                  <article key={hub.id} className="crm-hub-card">
                    <div className="crm-hub-card__head">
                      <span className="crm-hub-card__icon" aria-hidden="true">
                        <CrmModuleIcon name={hub.icon} size={18} />
                      </span>
                      <div className="crm-hub-card__titles">
                        <Link href={`/crm/hub/${hub.id}`} className="crm-hub-card__title">
                          {hub.label}
                        </Link>
                        <span>
                          {activeItems.length}/{hubModules.length} phân hệ hoạt động
                        </span>
                      </div>
                    </div>
                    <p className="crm-hub-card__desc">{hub.description}</p>
                    <div className="crm-hub-card__links">
                      {hubModules.slice(0, 4).map((item) => (
                        <Link key={item.id} href={`/crm/${item.id}`} className="crm-module-chip">
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Card D: Quick Access to All Connected Modules */}
          <section className="crm-panel" aria-labelledby="all-modules-heading">
            <div className="crm-panel__head">
              <div>
                <span className="crm-panel__eyebrow">DANH MỤC TRỰC TIẾP 33 PHÂN HỆ</span>
                <h2 id="all-modules-heading">Truy cập nhanh phân hệ nghiệp vụ</h2>
              </div>
            </div>
            <div className="crm-module-pills">
              {connected.map((item) => (
                <Link key={item.id} href={`/crm/${item.id}`} className="crm-module-pill">
                  <CrmModuleIcon name={item.icon} size={15} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Right Sticky Inspector Rail */}
        <aside className="crm-workbench-aside" aria-label="Hàng đợi vai trò và hồ sơ chờ duyệt">
          {/* Aside 1: Role Queues */}
          <section className="crm-panel crm-panel--accent" aria-labelledby="role-queue-heading">
            <div className="crm-panel__head">
              <div>
                <span className="crm-panel__eyebrow">PHÂN LUỒNG THEO VAI TRÒ</span>
                <h2 id="role-queue-heading">Hàng đợi theo vai trò</h2>
              </div>
              {can(user, "reports.read") && (
                <Link href="/crm/reports" className="crm-text-action">
                  Báo cáo →
                </Link>
              )}
            </div>
            {roleQueue.length > 0 ? (
              <ul className="crm-queue-list">
                {roleQueue.map((queue) => (
                  <li key={queue.label}>
                    <Link href={queue.href} className="crm-queue-row">
                      <span>{queue.label}</span>
                      <strong>{queue.value}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="crm-empty-inline">Chưa có hàng đợi phát sinh trong ca hiện tại.</p>
            )}
          </section>

          {/* Aside 2: Partner Applications Review */}
          <section className="crm-panel" aria-labelledby="partner-apps-heading">
            <div className="crm-panel__head">
              <div>
                <span className="crm-panel__eyebrow">MỞ RỘNG MẠNG LƯỚI ĐẠI LÝ</span>
                <h2 id="partner-apps-heading">Hồ sơ đối tác chờ duyệt</h2>
              </div>
              <Link href="/crm/applications" className="crm-text-action">
                Tất cả →
              </Link>
            </div>
            {!applications || !applications.items.length ? (
              <p className="crm-empty-inline">Không có hồ sơ đối tác mới chờ xét duyệt.</p>
            ) : (
              <ul className="crm-app-list">
                {applications.items.slice(0, 5).map((app) => (
                  <li key={app.id}>
                    <Link href={`/crm/applications/${app.id}`} className="crm-app-item">
                      <div>
                        <strong>{app.company_name}</strong>
                        <span>
                          {app.representative} · {app.phone}
                        </span>
                      </div>
                      <span className="work-status work-status--amber">Chờ duyệt</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Aside 3: Commercial Governance & Data Integrity Rules */}
          <section className="crm-panel crm-panel--subtle" aria-labelledby="governance-rules-heading">
            <div className="crm-panel__head">
              <div>
                <span className="crm-panel__eyebrow">
                  <LockKey size={13} weight="bold" aria-hidden="true" /> KIỂM SOÁT SỐ LIỆU THƯƠNG MẠI
                </span>
                <h2 id="governance-rules-heading">Nguyên tắc vận hành & kiểm soát số liệu</h2>
              </div>
            </div>
            <ul className="crm-rules-list">
              <li>
                <strong>Không tự sinh công nợ khi chưa khóa chứng từ:</strong> Số dư công nợ, tồn kho
                và đối soát ký gửi chỉ ghi nhận từ chứng từ gốc đã duyệt.
              </li>
              <li>
                <strong>Lưu vết báo giá & bảng giá theo phiên bản:</strong> Mọi bản báo giá phát hành
                giữ nguyên lịch sử phiên bản và tỷ lệ quy đổi đơn vị đã xác nhận.
              </li>
              <li>
                <strong>Gộp hồ sơ trùng có xem trước 10 phút:</strong> Cảnh báo trùng mã số thuế / số
                điện thoại không tự động xóa; bắt buộc xem trước tác động trước khi xác nhận gộp.
              </li>
            </ul>
            {planned.length > 0 && (
              <p className="crm-planned-note">
                Hiện có <strong>{planned.length}</strong> phân hệ đang ở trạng thái chờ khóa chính sách
                ghi sổ đầu kỳ.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
