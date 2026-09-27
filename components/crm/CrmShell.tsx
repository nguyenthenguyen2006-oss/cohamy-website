'use client';
import { QuickCreate } from './QuickCreate';
import {
  House,
  SignOut,
  List,
  X,
  UserCircle,
  Gear,
  ShoppingCart,
  Users,
  Warehouse,
  ChartBar,
  RocketLaunch,
  CaretDown,
} from '@phosphor-icons/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { roleLabels, type Principal } from '@/lib/crm/types';
import { visibleModules } from '@/lib/crm/modules';
import { can } from '@/lib/crm/permissions';
import { CrmModuleIcon } from './ModuleIcon';

const DESIGN_CONTRACT =
  'THESIS: HumanBank-inspired dark CRM shell with topbar, launcher tiles, and floating bottom dock. OWN-WORLD: Cohamy navy (#070B14-#0B111E), orange actions (#f97316), Be Vietnam Pro, Phosphor icons. FIRST VIEWPORT: Centered hero, 11 colored module hub tiles in 5 columns, dock in first viewport. FINISH: verified via browser visual QA and automated test suite.';

function getInitials(name: string): string {
  if (!name) return 'CH';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CrmShell({ children, user }: { children: ReactNode; user: Principal }) {
  const pathname = usePathname();
  const router = useRouter();
  const root = '/' + user.area;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const userMenuRef = useRef<HTMLDetailsElement>(null);

  const modules = visibleModules(user);
  const active = modules.find(
    (m) => pathname === root + '/' + m.id || pathname.startsWith(root + '/' + m.id + '/')
  );

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/crm/auth/logout', { method: 'POST' });
      if (!r.ok) throw new Error();
      router.replace(root + '/login');
      router.refresh();
    } catch {
      setError('Chưa đăng xuất được. Thử lại khi có kết nối.');
      setBusy(false);
    }
  }

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        userMenuRef.current.removeAttribute('open');
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // For portal area, preserve the existing portal shell layout to respect Rule 5
  if (user.area === 'portal') {
    return (
      <div className="work-shell" data-design-contract={DESIGN_CONTRACT}>
        <a className="skip-link" href="#portal-content">
          Đến nội dung chính
        </a>
        <header className="work-topbar">
          <button
            className="work-menu-toggle"
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="work-navigation"
            aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <List size={24} />}
          </button>
          <Link className="work-brand" href={root}>
            <Image
              src="/images/logo/cohamy-brand-logo.png"
              width={153}
              height={32}
              alt="Cohamy"
              style={{ height: 'auto' }}
              preload
            />
            <span>Cổng đại lý</span>
          </Link>
          <QuickCreate user={user} />
          <Link
            className="work-user"
            href={root + '/profile'}
            aria-label={'Hồ sơ và bảo mật của ' + user.displayName}
          >
            <UserCircle size={28} aria-hidden />
            <span>
              <strong>{user.displayName}</strong>
              <small>{roleLabels[user.role]}</small>
            </span>
          </Link>
        </header>
        <aside
          id="work-navigation"
          className={'work-sidebar' + (mobileMenuOpen ? ' is-open' : '')}
        >
          <nav aria-label="Điều hướng chính">
            <Link
              href={root}
              className={pathname === root ? 'active' : ''}
              aria-current={pathname === root ? 'page' : undefined}
              onClick={() => setMobileMenuOpen(false)}
            >
              <House size={21} aria-hidden />
              <span>Bàn làm việc</span>
            </Link>
            <p className="work-nav-label">Công việc hằng ngày</p>
            {modules
              .filter((m) => m.status === 'CONNECTED')
              .map((m) => (
                <Link
                  key={m.id}
                  href={root + '/' + m.id}
                  className={active?.id === m.id ? 'active' : ''}
                  aria-current={active?.id === m.id ? 'page' : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <CrmModuleIcon name={m.icon} size={21} aria-hidden />
                  <span>{m.label}</span>
                </Link>
              ))}
            <details className="work-nav-pending">
              <summary>Chưa mở giao dịch</summary>
              {modules
                .filter((m) => m.status === 'PENDING')
                .map((m) => (
                  <Link
                    href={root + '/' + m.id}
                    key={m.id}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <CrmModuleIcon name={m.icon} size={19} aria-hidden />
                    <span>{m.label}</span>
                  </Link>
                ))}
            </details>
          </nav>
          <div className="work-sidebar-footer">
            <Link href={root + '/profile'}>Hồ sơ và bảo mật</Link>
            <button type="button" disabled={busy} onClick={logout}>
              <SignOut size={20} aria-hidden />
              {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
            </button>
            {error && <p role="alert">{error}</p>}
          </div>
        </aside>
        {mobileMenuOpen && (
          <button
            className="work-menu-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Đóng menu điều hướng"
          />
        )}
        <div className="work-main">
          <nav className="work-breadcrumb" aria-label="Đường dẫn">
            <Link href={root}>Cohamy</Link>
            <span>/</span>
            <span>
              {active?.label ??
                (pathname.endsWith('/profile') ? 'Hồ sơ cá nhân' : 'Bàn làm việc')}
            </span>
          </nav>
          <main id="portal-content">{children}</main>
          <footer className="work-footer">Cohamy · {user.organizationName}</footer>
        </div>
      </div>
    );
  }

  // CRM Area: Redesigned HumanBank-style shell
  const isDashboard = pathname === root;

  return (
    <div
      className={`portal-shell crm-humanbank-shell ${isDashboard ? 'portal-shell--dashboard' : ''}`}
      data-design-contract={DESIGN_CONTRACT}
    >
      <a className="skip-link" href="#portal-content">
        Đến nội dung chính
      </a>

      {/* Top Header matching HumanBank */}
      <header className="portal-topbar">
        <div className="portal-masthead-brand">
          <button
            className="crm-mobile-menu-btn work-menu-toggle"
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="work-navigation"
            aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={22} /> : <List size={22} />}
          </button>
          <Link className="portal-brand-link" href={root} aria-label="CRM Cohamy">
            <Image
              src="/images/logo/cohamy-brand-logo.png"
              width={140}
              height={30}
              alt="Cohamy"
              className="portal-brand-logo"
              style={{ width: 'auto' }}
              priority
            />
            <span className="portal-system-title">CRM Cohamy</span>
          </Link>
        </div>

        <div className="portal-topbar__actions">
          <QuickCreate user={user} />

          {/* User Account Menu Dropdown */}
          <details className="portal-user-menu" ref={userMenuRef}>
            <summary aria-label="Mở menu người dùng" role="button">
              <div className="portal-user-avatar" aria-hidden>
                {getInitials(user.displayName)}
              </div>
              <div className="portal-user-summary">
                <strong>{user.displayName}</strong>
                <span>{roleLabels[user.role]}</span>
              </div>
              <CaretDown size={14} aria-hidden />
            </summary>
            <div className="portal-user-menu__content">
              <Link
                href={root + '/profile'}
                onClick={() => userMenuRef.current?.removeAttribute('open')}
              >
                <UserCircle size={16} aria-hidden />
                <span>Hồ sơ và phiên đăng nhập</span>
              </Link>
              <Link
                href={root + '/workspace'}
                onClick={() => userMenuRef.current?.removeAttribute('open')}
              >
                <Gear size={16} aria-hidden />
                <span>Không gian cá nhân</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                disabled={busy}
                className="crm-logout-action"
              >
                <SignOut size={16} aria-hidden />
                <span>Đăng xuất</span>
              </button>
              {error && <p role="alert">{error}</p>}
            </div>
          </details>
        </div>
      </header>

      {/* Mobile Navigation Drawer for accessibility and responsive testing */}
      <aside
        id="work-navigation"
        className={`work-sidebar crm-mobile-drawer ${mobileMenuOpen ? 'is-open' : ''}`}
        aria-label="Điều hướng di động"
      >
        <div className="crm-mobile-drawer-header">
          <span>Danh mục CRM</span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Điều hướng di động">
          <Link
            href={root}
            className={pathname === root ? 'active' : ''}
            onClick={() => setMobileMenuOpen(false)}
          >
            <House size={18} aria-hidden />
            <span>Bàn làm việc</span>
          </Link>
          <div className="crm-drawer-section-title">Phân hệ nghiệp vụ</div>
          {modules
            .filter((m) => m.status === 'CONNECTED')
            .map((m) => (
              <Link
                key={m.id}
                href={root + '/' + m.id}
                className={active?.id === m.id ? 'active' : ''}
                onClick={() => setMobileMenuOpen(false)}
              >
                <CrmModuleIcon name={m.icon} size={18} aria-hidden />
                <span>{m.label}</span>
              </Link>
            ))}
        </nav>
        <div className="crm-drawer-footer">
          <Link href={root + '/profile'} onClick={() => setMobileMenuOpen(false)}>
            Hồ sơ và bảo mật
          </Link>
          <button type="button" onClick={logout} disabled={busy}>
            <SignOut size={18} aria-hidden />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          className="work-menu-backdrop crm-drawer-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Đóng menu điều hướng"
        />
      )}

      {/* Main Workspace Content */}
      <div
        className={`portal-workspace ${isDashboard ? 'portal-workspace--dashboard' : 'crm-business-workspace'}`}
      >
        <main
          id="portal-content"
          className={`portal-content ${isDashboard ? 'portal-content--dashboard' : 'crm-business-content'}`}
        >
          {!isDashboard && (
            <nav className="crm-breadcrumb work-breadcrumb" aria-label="Đường dẫn">
              <Link href={root}>CRM Cohamy</Link>
              <span>/</span>
              <span>
                {active?.label ??
                  (pathname.includes('/hub/')
                    ? 'Nhóm phân hệ'
                    : pathname.endsWith('/profile')
                    ? 'Hồ sơ và bảo mật'
                    : 'Bàn làm việc')}
              </span>
            </nav>
          )}
          {children}
        </main>
      </div>

      {/* Bottom Floating Navigation Dock matching HumanBank */}
      <nav className="portal-bottom-navigation" aria-label="Truy cập nhanh">
        <div className="portal-bottom-navigation__inner">
          <Link
            href={root}
            className={pathname === root ? 'is-active' : ''}
            aria-current={pathname === root ? 'page' : undefined}
          >
            <RocketLaunch size={24} weight="fill" />
            <small>Home</small>
          </Link>

          {can(user, 'orders.read') && (
            <Link
              href={`${root}/orders`}
              className={
                pathname.startsWith(`${root}/orders`) ||
                pathname.startsWith(`${root}/requests`) ||
                pathname.startsWith(`${root}/sales`) ||
                pathname.startsWith(`${root}/quotations`) ||
                pathname === `${root}/hub/orders`
                  ? 'is-active'
                  : ''
              }
            >
              <ShoppingCart size={24} weight="fill" />
              <small>Đơn hàng</small>
            </Link>
          )}

          {can(user, 'partners.read') && (
            <Link
              href={`${root}/customers`}
              className={
                pathname.startsWith(`${root}/customers`) ||
                pathname.startsWith(`${root}/dealers`) ||
                pathname.startsWith(`${root}/care`) ||
                pathname.startsWith(`${root}/visits`) ||
                pathname === `${root}/hub/customers` ||
                pathname === `${root}/hub/dealers`
                  ? 'is-active'
                  : ''
              }
            >
              <Users size={24} weight="fill" />
              <small>Khách hàng</small>
            </Link>
          )}

          {(can(user, 'warehouses.read') || can(user, 'catalog.read')) && (
            <Link
              href={`${root}/inventory`}
              className={
                pathname.startsWith(`${root}/inventory`) ||
                pathname.startsWith(`${root}/goods`) ||
                pathname.startsWith(`${root}/samples`) ||
                pathname === `${root}/hub/goods`
                  ? 'is-active'
                  : ''
              }
            >
              <Warehouse size={24} weight="fill" />
              <small>Kho</small>
            </Link>
          )}

          {can(user, 'reports.read') && (
            <Link
              href={`${root}/reports`}
              className={
                pathname.startsWith(`${root}/reports`) ||
                pathname.startsWith(`${root}/data`) ||
                pathname.startsWith(`${root}/search`) ||
                pathname === `${root}/hub/reports`
                  ? 'is-active'
                  : ''
              }
            >
              <ChartBar size={24} weight="fill" />
              <small>Báo cáo</small>
            </Link>
          )}

          <button
            type="button"
            onClick={logout}
            disabled={busy}
            title="Đăng xuất khỏi CRM"
            aria-label="Thoát"
          >
            <SignOut size={24} weight="bold" />
            <small>Thoát</small>
          </button>
        </div>
      </nav>
    </div>
  );
}
