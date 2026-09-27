import Link from 'next/link';
import { visibleModules, getVisibleHubs } from '@/lib/crm/modules';
import type { Principal } from '@/lib/crm/types';
import { can } from '@/lib/crm/permissions';
import { canManageWork, listOrders, listTasks } from '@/lib/crm/work';
import { reviewQueue } from '@/lib/crm/onboarding';
import { roleDashboard } from '@/lib/crm/reports';
import { roleLabels } from '@/lib/crm/types';
import { CrmModuleIcon } from './ModuleIcon';
import { OrderTable, TaskList, WorkHeader } from './WorkPages';
import { OnboardingChecklist } from './PartnerLibraryPages';
import { DealerCommercePanel } from './DealerCommercePanel';

export async function CrmDashboard({ user }: { user: Principal }) {
  const internal = user.area === 'crm';
  const visibleHubs = getVisibleHubs(user);
  const modules = visibleModules(user);

  // Fetch real counts safely
  let orders: Awaited<ReturnType<typeof listOrders>> | null = null;
  let applications: Awaited<ReturnType<typeof reviewQueue>> | null = null;
  let tasks: Awaited<ReturnType<typeof listTasks>> = [];
  let overdue: Awaited<ReturnType<typeof listTasks>> = [];
  let roleQueue: Awaited<ReturnType<typeof roleDashboard>> = [];

  if (internal) {
    try {
      if (can(user, 'orders.read')) {
        orders = await listOrders(user, { status: 'PENDING_REVIEW' });
      }
    } catch {
      orders = null;
    }

    try {
      if (user.role === 'ADMIN') {
        applications = await reviewQueue(user);
      }
    } catch {
      applications = null;
    }

    try {
      if (canManageWork(user)) {
        [tasks, overdue] = await Promise.all([
          listTasks(user, { today: 'true', pageSize: '5' }),
          listTasks(user, { overdue: 'true', pageSize: '5' }),
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

  if (user.area === 'portal') {
    return (
      <>
        <WorkHeader
          title="Không gian đại lý"
          description={`${user.organizationName} · Danh mục và thông tin trong phạm vi của bạn.`}
          action={
            can(user, 'partners.write') ? (
              <Link className="button button--primary" href="/crm/customers/new">
                Thêm khách hàng
              </Link>
            ) : undefined
          }
        />
        <OnboardingChecklist user={user} />
        {can(user, 'orders.read') && <DealerCommercePanel user={user} />}
        <section className="work-section">
          <h2>Truy cập nhanh</h2>
          <div className="work-shortcuts">
            {modules
              .filter((m) => m.status === 'CONNECTED')
              .map((m) => (
                <Link href={`/${user.area}/${m.id}`} key={m.id} className="crm-module-tile">
                  <CrmModuleIcon name={m.icon} size={22} aria-hidden />
                  <span>{m.label}</span>
                  <span aria-hidden>→</span>
                </Link>
              ))}
          </div>
        </section>
        <details className="work-disclosure work-roadmap">
          <summary>Các nghiệp vụ đang hoàn thiện</summary>
          <p>Kho, ký gửi, thu chi và công nợ cần chính sách được chốt trước khi mở ghi sổ.</p>
          <ul>
            {modules
              .filter((m) => m.status === 'PENDING')
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

  // Get real badge counts for hubs
  function getHubBadge(hubId: string): number | null {
    if (hubId === 'orders' && orders && orders.total > 0) return orders.total;
    if (hubId === 'dealers' && applications && applications.total > 0) return applications.total;
    if (hubId === 'tasks' && overdue && overdue.length > 0) return overdue.length;
    return null;
  }

  return (
    <div className="crm-dashboard">
      <div className="crm-dashboard__content">
        {/* Main Launcher Hero */}
        <header className="crm-dashboard__hero">
          <h1>Hệ thống quản trị Cohamy</h1>
          <p className="crm-dashboard__meta">
            Phiên làm việc: <strong>{user.displayName}</strong> · Phân quyền: <span className="crm-role-badge">{roleLabels[user.role]}</span>
          </p>
        </header>

        {/* 11 Hub Modules Launcher Grid */}
        <section className="crm-launcher-section" aria-label="Các nhóm phân hệ quản trị">
          <div className="crm-module-grid">
            {visibleHubs.map(({ hub, modules: subModules }) => {
              const badge = getHubBadge(hub.id);
              // If only 1 submodule, can link directly, but hub page provides clean overview
              const href = subModules.length === 1 ? `/${user.area}/${subModules[0].id}` : `/${user.area}/hub/${hub.id}`;
              return (
                <Link
                  key={hub.id}
                  href={href}
                  className="crm-module-tile"
                  style={
                    {
                      '--tile-start': hub.color,
                      '--tile-end': hub.color,
                      background: hub.gradient,
                    } as React.CSSProperties
                  }
                  aria-label={`${hub.label}${badge ? ` (${badge} mục cần xử lý)` : ''}`}
                >
                  {badge !== null && (
                    <span className="crm-tile-badge" aria-label={`${badge} cần xử lý`}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                  <div className="crm-tile-icon" aria-hidden>
                    <CrmModuleIcon name={hub.icon} size={46} color="#ffffff" />
                  </div>
                  <span className="crm-tile-label">{hub.label}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Operations Desk Section below Launcher */}
        <div className="crm-dashboard__operations">
          <header className="crm-operations-header">
            <h2 className="crm-operations-title">Bàn làm việc</h2>
            <p className="crm-operations-desc">
              {internal
                ? 'Hàng đợi xử lý, yêu cầu kinh doanh và các công việc trọng tâm cần tiếp nhận.'
                : `${user.organizationName} · Danh mục và thông tin nghiệp vụ trong phạm vi đại lý.`}
            </p>
          </header>

          {!internal && <OnboardingChecklist user={user} />}
          {!internal && can(user, 'orders.read') && <DealerCommercePanel user={user} />}

          {applications && applications.total > 0 && (
            <section className="work-section crm-dark-panel">
              <div className="work-section-title">
                <div>
                  <h2>
                    Hồ sơ đối tác chờ duyệt <span className="work-count">{applications.total}</span>
                  </h2>
                  <p>Hồ sơ đã gửi; mở từng hồ sơ để đối chiếu và xét duyệt.</p>
                </div>
                <Link href="/crm/applications" className="crm-panel-action">
                  Duyệt hồ sơ chờ tiếp nhận →
                </Link>
              </div>
              <ul className="work-task-list">
                {applications.items.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link href={'/crm/applications/' + a.id}>{a.company_name}</Link>
                    <span>{a.representative}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {orders && (
            <section className="work-section work-section--table crm-dark-panel">
              <div className="work-section-title">
                <div>
                  <h2>
                    Yêu cầu mới cần tiếp nhận <span className="work-count">{orders.total}</span>
                  </h2>
                  <p>Phân công người xử lý, liên hệ và xác nhận nhu cầu.</p>
                </div>
                <Link href="/crm/orders" className="crm-panel-action">
                  Xem tất cả yêu cầu →
                </Link>
              </div>
              <OrderTable orders={orders.items.slice(0, 5)} />
            </section>
          )}

          {internal && canManageWork(user) && (
            <>
              {overdue.length > 0 && (
                <section className="work-section crm-dark-panel">
                  <div className="work-section-title">
                    <h2>
                      Việc quá hạn <span className="work-count crm-count-danger">{overdue.length}</span>
                    </h2>
                    <Link href="/crm/tasks?overdue=true" className="crm-panel-action">
                      Xử lý việc quá hạn →
                    </Link>
                  </div>
                  <TaskList tasks={overdue} />
                </section>
              )}

              <section className="work-section crm-dark-panel">
                <div className="work-section-title">
                  <h2>Còn hạn hôm nay</h2>
                  <Link href="/crm/tasks?today=true" className="crm-panel-action">
                    Xem việc hôm nay →
                  </Link>
                </div>
                <p className="work-help">Từ hiện tại đến hết ngày Việt Nam; việc quá hạn nằm ở mục phía trên.</p>
                <TaskList tasks={tasks} />
              </section>
            </>
          )}

          {roleQueue.length > 0 && (
            <section className="work-section crm-dark-panel">
              <div className="work-section-title">
                <div>
                  <h2>Hàng đợi theo vai trò</h2>
                  <p>Mỗi số mở đúng nguồn chứng từ trong phạm vi hiện tại.</p>
                </div>
                {can(user, 'reports.read') && (
                  <Link href="/crm/reports" className="crm-panel-action">
                    Xem báo cáo vận hành →
                  </Link>
                )}
              </div>
              <ul className="work-task-list">
                {roleQueue.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href}>{item.label}</Link>
                    <strong>{item.value}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="work-section crm-dark-panel">
            <h2>Truy cập nhanh tất cả module</h2>
            <div className="work-shortcuts crm-shortcuts-grid">
              {modules
                .filter((m) => m.status === 'CONNECTED')
                .map((m) => (
                  <Link href={`/${user.area}/${m.id}`} key={m.id} className="crm-shortcut-item">
                    <CrmModuleIcon name={m.icon} size={22} aria-hidden />
                    <span>{m.label}</span>
                    <span aria-hidden>→</span>
                  </Link>
                ))}
            </div>
          </section>

          <details className="work-disclosure work-roadmap crm-dark-disclosure">
            <summary>Các nghiệp vụ đang hoàn thiện</summary>
            <p>Kho, ký gửi, thu chi và công nợ cần chính sách được chốt trước khi mở ghi sổ.</p>
            <ul>
              {modules
                .filter((m) => m.status === 'PENDING')
                .map((m) => (
                  <li key={m.id}>
                    <Link href={`/${user.area}/${m.id}`}>{m.label}</Link>
                  </li>
                ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
