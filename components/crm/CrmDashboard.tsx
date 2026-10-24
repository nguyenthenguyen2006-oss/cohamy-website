import {DocumentFlowWorkspace} from './DocumentFlowWorkspace';
import {flowWorkspace} from '@/lib/crm/document-flow';
import {CrmNavLink as Link} from './CrmNavLink';
import { SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { visibleModules } from "@/lib/crm/modules";
import { reviewQueue } from "@/lib/crm/onboarding";
import { can, isWarehouseRole } from "@/lib/crm/permissions";
import { salesReconciliation, inventoryMatrix } from "@/lib/crm/reconciliation";
import { type Principal } from "@/lib/crm/types";
import { canManageWork, listOrders, listTasks } from "@/lib/crm/work";
import { DealerCommercePanel } from "./DealerCommercePanel";
import { CrmModuleIcon } from "./ModuleIcon";
import { OnboardingChecklist } from "./PartnerLibraryPages";
import { WorkHeader } from "./WorkPages";
import { DashboardWorkbench } from "./spreadsheet/DashboardWorkbench";

export async function CrmDashboard({ user }: { user: Principal }) {
  if(user.area==='crm'&&(user.role==='ACCOUNTANT'||user.role==='FACTORY'||isWarehouseRole(user.role))){
    return <DocumentFlowWorkspace initialData={await flowWorkspace(user)} user={user} initialTab={user.role==='ACCOUNTANT'?'receipts':isWarehouseRole(user.role)?'stock':'requests'}/>;
  }
  const internal = user.area === "crm";
  const modules = visibleModules(user);

  let pendingOrders: Awaited<ReturnType<typeof listOrders>> | null = null;
  let inProgressOrders: Awaited<ReturnType<typeof listOrders>> | null = null;
  let readyOrders: Awaited<ReturnType<typeof listOrders>> | null = null;
  let applications: Awaited<ReturnType<typeof reviewQueue>> | null = null;
  let tasks: Awaited<ReturnType<typeof listTasks>> = [];
  let overdue: Awaited<ReturnType<typeof listTasks>> = [];
  let reconciliationData: Awaited<ReturnType<typeof salesReconciliation>> | null = null;
  let matrixData: Awaited<ReturnType<typeof inventoryMatrix>> | null = null;

  if (internal) {
    // The four domains are independent. Keep each domain's existing failure fallback.
    const [orderData,stockData,applicationData,taskData]=await Promise.all([
      can(user,'orders.read')?Promise.all([listOrders(user,{status:'PENDING_REVIEW'}),listOrders(user,{status:'IN_PROGRESS'}),listOrders(user,{status:'READY'}),salesReconciliation(user)]).catch(()=>null):null,
      can(user,'warehouses.read')?inventoryMatrix(user).catch(()=>null):null,
      user.role==='ADMIN'?reviewQueue(user).catch(()=>null):null,
      canManageWork(user)?Promise.all([listTasks(user,{today:'true',pageSize:'20'}),listTasks(user,{overdue:'true',pageSize:'20'})]).catch(()=>null):null,
    ]);
    if(orderData)[pendingOrders,inProgressOrders,readyOrders,reconciliationData]=orderData;
    matrixData=stockData;applications=applicationData;
    if(taskData)[tasks,overdue]=taskData;
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

  const newOrdersCount = pendingOrders?.total ?? 0;
  const inProgressCount = inProgressOrders?.total ?? 0;
  const readyCount = readyOrders?.total ?? 0;
  const overdueCount = overdue.length;
  const todayCount = tasks.length;
  const pendingAppCount = applications?.total ?? 0;

  return (
    <div className="crm-dashboard-saas crm-spreadsheet-desk">
      {/* Compact Operational Header + KPI Strip */}
      <header className="crm-dash-compact-bar">
        <div className="crm-dash-compact-bar__left">
          <span className="crm-dash-header__eyebrow">
            <SquaresFour size={13} weight="bold" aria-hidden="true" />
            BẢNG TÍNH VẬN HÀNH COHAMY
          </span>
          <h1>Bàn làm việc</h1>
        </div>

        <div className="crm-dash-compact-kpis" aria-label="Dải số liệu hàng đợi">
          <Link href="/crm/orders?status=PENDING_REVIEW" className="crm-mini-kpi-pill">
            <span>Yêu cầu mới:</span>
            <strong>{newOrdersCount}</strong>
            <small>(Đang xử lý: {inProgressCount} · Chốt: {readyCount})</small>
          </Link>
          <Link
            href="/crm/tasks?overdue=true"
            className={`crm-mini-kpi-pill ${overdueCount > 0 ? "is-danger" : ""}`}
          >
            <span>Việc quá hạn:</span>
            <strong>{overdueCount}</strong>
          </Link>
          <Link href="/crm/tasks?today=true" className="crm-mini-kpi-pill">
            <span>Hạn hôm nay:</span>
            <strong>{todayCount}</strong>
          </Link>
          {user.role === "ADMIN" && (
            <Link href="/crm/applications" className="crm-mini-kpi-pill">
              <span>Chờ duyệt đại lý:</span>
              <strong>{pendingAppCount}</strong>
            </Link>
          )}
        </div>
      </header>

      {/* Main Excel-Style Multi-Sheet Operational Workbench */}
      <DashboardWorkbench
        reconciliation={reconciliationData}
        inventoryMatrix={matrixData}
        pendingOrders={pendingOrders?.items ?? []}
        tasks={tasks}
        overdueTasks={overdue}
      />
    </div>
  );
}
