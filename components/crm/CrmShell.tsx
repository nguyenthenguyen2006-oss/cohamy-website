"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CaretRight,
  House,
  List,
  MagnifyingGlass,
  ShieldCheck,
  SignOut,
  SquaresFour,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import { getVisibleHubs, visibleModules } from "@/lib/crm/modules";
import { roleLabels, type Principal } from "@/lib/crm/types";
import { CrmModuleIcon } from "./ModuleIcon";
import { PwaRegistrar } from "./PwaRegistrar";
import { QuickCreate } from "./QuickCreate";

const subLabels: Record<string, string> = {
  new: "Tạo mới",
  profile: "Hồ sơ & bảo mật",
};

export function CrmShell({
  user,
  children,
}: {
  user: Principal;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const root = `/${user.area}`;
  const isPortal = user.area === "portal";
  const modules = visibleModules(user);
  const connected = modules.filter((item) => item.status === "CONNECTED");
  const planned = modules.filter((item) => item.status === "PENDING");
  const visibleHubs = getVisibleHubs(user);

  const [loggingOut, setLoggingOut] = useState(false);
  const [openMenuPath, setOpenMenuPath] = useState<string | null>(null);
  const [navFilter, setNavFilter] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("cohamy_crm_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const mobileMenuOpen = openMenuPath === pathname;
  function setMobileMenuOpen(next: boolean | ((prev: boolean) => boolean)) {
    const resolved = typeof next === "function" ? next(mobileMenuOpen) : next;
    setOpenMenuPath(resolved ? pathname : null);
  }

  const parts = pathname.split("/").filter(Boolean);
  const activeSlug = parts[1] ?? "";
  const activeSub = parts[2] ?? "";
  const isHubRoute = activeSlug === "hub" && Boolean(activeSub);
  const activeModule = modules.find((item) => item.id === activeSlug);
  const activeHubEntry = isHubRoute
    ? visibleHubs.find((entry) => entry.hub.id === activeSub)
    : activeModule
      ? visibleHubs.find((entry) => entry.modules.some((m) => m.id === activeModule.id))
      : undefined;

  const normalizedFilter = navFilter.trim().toLowerCase();
  const connectedHubs = visibleHubs
    .map((entry) => ({
      hub: entry.hub,
      modules: entry.modules.filter((m) => m.status === "CONNECTED"),
    }))
    .filter((entry) => entry.modules.length > 0);

  const filteredHubs = !normalizedFilter
    ? connectedHubs
    : connectedHubs
        .map((entry) => ({
          hub: entry.hub,
          modules: entry.modules.filter(
            (item) =>
              item.label.toLowerCase().includes(normalizedFilter) ||
              entry.hub.label.toLowerCase().includes(normalizedFilter) ||
              item.id.toLowerCase().includes(normalizedFilter)
          ),
        }))
        .filter((entry) => entry.modules.length > 0);

  const filteredPlanned = !normalizedFilter
    ? planned
    : planned.filter(
        (item) =>
          item.label.toLowerCase().includes(normalizedFilter) ||
          item.id.toLowerCase().includes(normalizedFilter)
      );

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuPath(null);
        menuToggleRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/crm/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ area: user.area }),
      });
      router.replace(`${root}/login`);
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  // Keep Dealer Portal (/portal) 100% untouched
  if (isPortal) {
    return (
      <div className="work-shell">
        <PwaRegistrar />
        <a className="skip-link" href="#portal-content">
          Đến nội dung chính
        </a>
        <header className="work-topbar">
          <button
            ref={menuToggleRef}
            className="work-menu-toggle"
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="work-navigation"
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            {mobileMenuOpen ? (
              <X size={24} aria-hidden="true" />
            ) : (
              <List size={24} aria-hidden="true" />
            )}
          </button>
          <Link className="work-brand" href={root}>
            <Image
              src="/images/logo/cohamy-brand-logo.png"
              width={925}
              height={267}
              alt="Cohamy"
              style={{ width: "auto" }}
              preload
            />
            <span>Cổng đại lý</span>
          </Link>
          <QuickCreate user={user} />
          <Link
            className="work-user"
            href={`${root}/profile`}
            aria-label={`Hồ sơ và bảo mật của ${user.displayName}`}
          >
            <UserCircle size={28} aria-hidden="true" />
            <span>
              <strong>{user.displayName}</strong>
              <small>{roleLabels[user.role]}</small>
            </span>
          </Link>
        </header>
        <aside
          id="work-navigation"
          className={`work-sidebar${mobileMenuOpen ? " is-open" : ""}`}
        >
          <nav aria-label="Điều hướng chính">
            <Link
              href={root}
              className={pathname === root ? "active" : ""}
              aria-current={pathname === root ? "page" : undefined}
              onClick={() => setMobileMenuOpen(false)}
            >
              <House size={21} aria-hidden="true" />
              <span>Bàn làm việc</span>
            </Link>
            <p className="work-nav-label">Công việc hằng ngày</p>
            {connected.map((m) => (
              <Link
                key={m.id}
                href={`${root}/${m.id}`}
                className={activeModule?.id === m.id ? "active" : ""}
                aria-current={activeModule?.id === m.id ? "page" : undefined}
                onClick={() => setMobileMenuOpen(false)}
              >
                <CrmModuleIcon name={m.icon} size={21} />
                <span>{m.label}</span>
              </Link>
            ))}
            {planned.length > 0 && (
              <details className="work-nav-pending">
                <summary>Chưa mở giao dịch</summary>
                {planned.map((m) => (
                  <Link
                    href={`${root}/${m.id}`}
                    key={m.id}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <CrmModuleIcon name={m.icon} size={19} />
                    <span>{m.label}</span>
                  </Link>
                ))}
              </details>
            )}
          </nav>
          <div className="work-sidebar-footer">
            <Link href={`${root}/profile`}>Hồ sơ và bảo mật</Link>
            <button type="button" disabled={loggingOut} onClick={logout}>
              <SignOut size={20} aria-hidden="true" />
              {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
            </button>
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
              {activeModule?.label ??
                (pathname.endsWith("/profile") ? "Hồ sơ cá nhân" : "Bàn làm việc")}
            </span>
          </nav>
          <main id="portal-content">{children}</main>
          <footer className="work-footer">Cohamy · {user.organizationName}</footer>
        </div>
      </div>
    );
  }

  // UI/UX Pro Max — Golden-Amber & Warm Cacao Enterprise SaaS Shell for /crm
  const userInitial = (user.displayName || user.email || "C").trim().charAt(0).toUpperCase();

  return (
    <div className={`crm-golden-saas-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <PwaRegistrar />
      <a className="skip-link" href="#crm-main">
        Chuyển đến nội dung chính
      </a>

      <header className="crm-topbar">
        <div className="crm-topbar__left">
          <button
            ref={menuToggleRef}
            type="button"
            className="crm-mobile-toggle"
            aria-expanded={mobileMenuOpen}
            aria-controls="work-navigation"
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
            onClick={() => setMobileMenuOpen((value) => !value)}
          >
            {mobileMenuOpen ? (
              <X size={20} weight="bold" aria-hidden="true" />
            ) : (
              <List size={20} weight="bold" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className="crm-desktop-sidebar-toggle"
            aria-label={sidebarCollapsed ? "Mở rộng menu điều hướng" : "Thu gọn menu điều hướng"}
            title={sidebarCollapsed ? "Mở rộng menu bên trái" : "Thu gọn menu bên trái để mở rộng vùng bảng tính"}
            onClick={toggleSidebarCollapsed}
          >
            <List size={18} weight="bold" aria-hidden="true" />
          </button>

          <Link href={root} className="crm-brand" aria-label="CRM Cohamy — Bàn làm việc điều hành">
            <span className="crm-brand__logo-wrap">
              <Image
                alt="Cohamy"
                src="/images/logo/cohamy-brand-logo.png"
                width={108}
                height={31}
                style={{ width: "auto", height: "26px" }}
              />
            </span>
            <span className="crm-brand__badge">CRM COHAMY</span>
          </Link>

          <nav className="crm-breadcrumb" aria-label="Vị trí hiện tại">
            <Link href={root} className="crm-breadcrumb__root">
              Bàn làm việc
            </Link>
            {isHubRoute && activeHubEntry && (
              <>
                <CaretRight size={12} aria-hidden="true" className="crm-breadcrumb__sep" />
                <span className="crm-breadcrumb__current">{activeHubEntry.hub.label}</span>
              </>
            )}
            {activeModule && (
              <>
                {activeHubEntry && (
                  <>
                    <CaretRight size={12} aria-hidden="true" className="crm-breadcrumb__sep" />
                    <Link
                      href={`${root}/hub/${activeHubEntry.hub.id}`}
                      className="crm-breadcrumb__link"
                    >
                      {activeHubEntry.hub.label}
                    </Link>
                  </>
                )}
                <CaretRight size={12} aria-hidden="true" className="crm-breadcrumb__sep" />
                <Link
                  href={`${root}/${activeModule.id}`}
                  className={activeSub ? "crm-breadcrumb__link" : "crm-breadcrumb__current"}
                >
                  {activeModule.label}
                </Link>
              </>
            )}
            {!isHubRoute && activeSub && (
              <>
                <CaretRight size={12} aria-hidden="true" className="crm-breadcrumb__sep" />
                <span className="crm-breadcrumb__current">
                  {subLabels[activeSub] ?? "Chi tiết chứng từ"}
                </span>
              </>
            )}
          </nav>
        </div>

        <div className="crm-topbar__actions">
          {user.role !== "ACCOUNTANT" && (
            <Link
              href="/crm/search"
              className="crm-topbar__search-pill"
              aria-label="Tìm kiếm toàn hệ thống CRM"
            >
              <MagnifyingGlass size={16} weight="bold" aria-hidden="true" />
              <span>Tìm chứng từ, đối tác, SKU…</span>
              <kbd aria-hidden="true">Ctrl K</kbd>
            </Link>
          )}

          <Link
            href="/crm/notifications"
            className="crm-topbar__icon-btn"
            aria-label="Thông báo hóa đơn & hệ thống"
            title="Thông báo hóa đơn & hệ thống"
          >
            <Bell size={18} weight="bold" aria-hidden="true" />
          </Link>

          {user.role !== "ACCOUNTANT" && (
            <div className="crm-topbar__quick-create">
              <QuickCreate user={user} />
            </div>
          )}

          <Link
            href={`${root}/profile`}
            className="crm-user-pill"
            aria-label={`Hồ sơ ${user.displayName} (${roleLabels[user.role]})`}
          >
            <span className="crm-user-avatar" aria-hidden="true">
              {userInitial}
            </span>
            <span className="crm-user-meta">
              <strong>{user.displayName}</strong>
              <small>
                {roleLabels[user.role]} · {user.organizationName}
              </small>
            </span>
          </Link>

          <button
            type="button"
            className="button button--secondary crm-logout-btn"
            onClick={logout}
            disabled={loggingOut}
          >
            <SignOut size={16} weight="bold" aria-hidden="true" />
            <span>{loggingOut ? "Đang thoát…" : "Đăng xuất"}</span>
          </button>
        </div>
      </header>

      <div className="crm-workspace-body">
        {mobileMenuOpen && (
          <div
            className="crm-sidebar-backdrop"
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <aside
          id="work-navigation"
          className={`crm-sidebar${mobileMenuOpen ? " is-open" : ""}`}
          aria-label="Điều hướng nghiệp vụ"
        >
          {user.role !== "ACCOUNTANT" && (
            <div className="crm-sidebar__search">
              <label htmlFor="crm-nav-filter" className="sr-only">
                Lọc nhanh phân hệ
              </label>
              <MagnifyingGlass size={15} weight="bold" aria-hidden="true" />
              <input
                id="crm-nav-filter"
                type="search"
                value={navFilter}
                onChange={(event) => setNavFilter(event.target.value)}
                placeholder="Lọc nhanh 33 phân hệ…"
                autoComplete="off"
              />
              {navFilter && (
                <button
                  type="button"
                  className="crm-sidebar__search-clear"
                  aria-label="Xóa từ khóa lọc phân hệ"
                  onClick={() => setNavFilter("")}
                >
                  <X size={14} weight="bold" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          <nav className="crm-nav" aria-label="Danh mục phân hệ CRM">
            <Link
              href={root}
              className={`crm-nav__item crm-nav__item--overview${pathname === root ? " is-active" : ""}`}
              aria-current={pathname === root ? "page" : undefined}
            >
              <span className="crm-nav__icon-box" aria-hidden="true">
                <SquaresFour size={16} weight="bold" aria-hidden="true" />
              </span>
              <span>Bàn làm việc</span>
            </Link>

            {filteredHubs.map(({ hub, modules: hubItems }) => (
              <div className="crm-nav__group" key={hub.id}>
                <div className="crm-nav__group-header">
                  <Link href={`${root}/hub/${hub.id}`} className="crm-nav__heading">
                    {hub.label}
                  </Link>
                </div>
                <div className="crm-nav__items">
                  {hubItems.map((item) => {
                    const href = `${root}/${item.id}`;
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <Link
                        key={item.id}
                        href={href}
                        title={item.label}
                        className={`crm-nav__item${active ? " is-active" : ""}`}
                        aria-current={active ? "page" : undefined}
                      >
                        <CrmModuleIcon name={item.icon} size={16} />
                        <span className="crm-nav__label">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredPlanned.length > 0 && (
              <details className="crm-nav__planned" open={Boolean(normalizedFilter)}>
                <summary>Chưa mở giao dịch ({filteredPlanned.length})</summary>
                <div className="crm-nav__items">
                  {filteredPlanned.map((item) => {
                    const href = `${root}/${item.id}`;
                    const active = pathname === href;
                    return (
                      <Link
                        key={item.id}
                        href={href}
                        className={`crm-nav__item crm-nav__item--planned${active ? " is-active" : ""}`}
                      >
                        <CrmModuleIcon name={item.icon} size={15} />
                        <span className="crm-nav__label">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </details>
            )}
          </nav>

          <footer className="crm-sidebar__footer" aria-label="Thông tin phiên bảo mật">
            <div className="crm-sidebar__footer-row">
              <ShieldCheck size={16} weight="bold" aria-hidden="true" />
              <div>
                <strong>{roleLabels[user.role]}</strong>
                <span>{user.organizationName} · Phiên nội bộ</span>
              </div>
            </div>
          </footer>
        </aside>

        <div className="crm-main-column">
          <main id="crm-main" className="crm-main">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
