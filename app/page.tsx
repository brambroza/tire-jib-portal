"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/admin/Sidebar";
import Topbar from "../components/admin/Topbar";
import DashboardPage from "../components/admin/DashboardPage";
import SitesPage from "../components/admin/SitesPage";
import ShippingRatesPage from "../components/admin/ShippingRatesPage";
import ExtraFeeConfigsPage from "../components/admin/ExtraFeeConfigsPage";
import HeroContentPage from "../components/admin/HeroContentPage";
import CustomerNotificationsPage from "../components/admin/CustomerNotificationsPage";
import StockPage from "../components/admin/StockPage";
import StockAdjustPage from "../components/admin/StockAdjustPage";
import SalesSummaryPage from "../components/admin/SalesSummaryPage";
import OrdersPage from "../components/admin/OrdersPage";
import InstallPage from "../components/admin/InstallPage";
import InstallChecklistPage from "../components/admin/InstallChecklistPage";
import FieldInstallPage from "../components/admin/FieldInstallPage";
import TechniciansPage from "../components/admin/TechniciansPage";
import PromotionsPage from "../components/admin/PromotionsPage";
import TaxInvoiceRequestsPage from "../components/admin/TaxInvoiceRequestsPage";
import MembersPage from "../components/admin/MembersPage";
import LineChatPage from "../components/admin/LineChatPage";
import LineSearchTestPage from "../components/admin/LineSearchTestPage";
import LineReplySettingsPage from "../components/admin/LineReplySettingsPage";
import UsersPage from "../components/admin/UsersPage";
import TireCatalogPage from "../components/admin/TireCatalogPage";
import CarCatalogPage from "../components/admin/CarCatalogPage";
import type { PageId } from "../components/admin/types";
import AuthGuard from "../components/AuthGuard";
import { supabase } from "../lib/supabaseClient";

type ProfilePermissionRow = {
  role: string | null;
  is_active: boolean | null;
  menu_permissions: string[] | null;
};

const PAGE_PRIORITY: PageId[] = [
  "dashboard",
  "orders",
  "install",
  "field-install",
  "install-checklist",
  "sales-summary",
  "stock",
  "pricing",
  "technicians",
  "members",
  "line-chat",
  "line-search-test",
  "line-reply-settings",
  "tax-invoice-requests",
  "users",
  "sites",
  "shipping-rates",
  "extra-fee-configs",
  "hero-content",
  "customer-notifications",
  "tire-catalog",
  "car-catalog",
  "promotions"
];

export default function AdminPortal() {
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const [allowedPages, setAllowedPages] = useState<Set<PageId> | null>(null);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [activeKpiTab, setActiveKpiTab] = useState("วันนี้");
  const [activeOrderFilter, setActiveOrderFilter] = useState("ทั้งหมด (142)");
  const [confirmedOrders, setConfirmedOrders] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  function buildAllowedPages(profile: ProfilePermissionRow | null) {
    const allPages = new Set<PageId>(PAGE_PRIORITY);
    if (!profile || profile.is_active === false) return new Set<PageId>();
    if (profile.role === "admin") return allPages;
    const fromProfile = Array.isArray(profile.menu_permissions)
      ? profile.menu_permissions
      : [];
    const next = new Set<PageId>();
    fromProfile.forEach((pageId) => {
      if (PAGE_PRIORITY.includes(pageId as PageId)) {
        next.add(pageId as PageId);
      }
    });
    return next;
  }

  function findFirstAllowedPage(pages: Set<PageId>) {
    return PAGE_PRIORITY.find((page) => pages.has(page)) ?? null;
  }

  function confirmOrder(id: string) {
    setConfirmedOrders((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1100px)");
    const apply = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadPermissions() {
      if (!supabase) {
        if (!mounted) return;
        setAllowedPages(new Set<PageId>());
        setPermissionsReady(true);
        return;
      }
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;
      if (!mounted) return;
      if (!userId) {
        setAllowedPages(new Set<PageId>());
        setPermissionsReady(true);
        return;
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role,is_active,menu_permissions")
        .eq("id", userId)
        .maybeSingle();
      if (!mounted) return;
      const nextAllowed = buildAllowedPages((profileData ?? null) as ProfilePermissionRow | null);
      setAllowedPages(nextAllowed);
      const firstPage = findFirstAllowedPage(nextAllowed);
      setActivePage(firstPage ?? "dashboard");
      setPermissionsReady(true);
    }
    void loadPermissions();
    return () => {
      mounted = false;
    };
  }, []);

  function handleNavigate(page: PageId) {
    if (permissionsReady && allowedPages && !allowedPages.has(page)) {
      const firstPage = findFirstAllowedPage(allowedPages);
      if (firstPage) setActivePage(firstPage);
      return;
    }
    setActivePage(page);
    if (isMobile) setSidebarOpen(false);
  }

  return (
    <AuthGuard>
      <Sidebar activePage={activePage} onNavigate={handleNavigate} isOpen={sidebarOpen} />
      {isMobile && sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <main className="main">
        <Topbar
          activePage={activePage}
          onNavigate={handleNavigate}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />
        <div className="content scrollbar-thin">
          {!permissionsReady ? (
            <div className="card">
              <div className="card-body" style={{ color: "var(--text3)" }}>
                กำลังโหลดสิทธิ์การเข้าถึง...
              </div>
            </div>
          ) : allowedPages && allowedPages.size === 0 ? (
            <div className="card">
              <div className="card-body" style={{ color: "var(--red)" }}>
                บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งานเมนู
              </div>
            </div>
          ) : (
            <>
          {activePage === "dashboard" && (
            <DashboardPage
              activeTab={activeKpiTab}
              onTabChange={setActiveKpiTab}
              onConfirmOrder={confirmOrder}
              confirmedOrders={confirmedOrders}
            />
          )}
          {activePage === "sites" && <SitesPage />}
          {activePage === "shipping-rates" && <ShippingRatesPage />}
          {activePage === "extra-fee-configs" && <ExtraFeeConfigsPage />}
          {activePage === "hero-content" && <HeroContentPage />}
          {activePage === "customer-notifications" && <CustomerNotificationsPage />}
          {activePage === "tire-catalog" && <TireCatalogPage />}
          {activePage === "car-catalog" && <CarCatalogPage />}
          {activePage === "stock" && <StockPage />}
          {activePage === "pricing" && <StockAdjustPage />}
          {activePage === "sales-summary" && <SalesSummaryPage />}
          {activePage === "orders" && (
            <OrdersPage
              activeFilter={activeOrderFilter}
              onFilterChange={setActiveOrderFilter}
              onConfirmOrder={confirmOrder}
              confirmedOrders={confirmedOrders}
            />
          )}
          {activePage === "install" && <InstallPage />}
          {activePage === "install-checklist" && <InstallChecklistPage />}
          {activePage === "field-install" && <FieldInstallPage />}
          {activePage === "technicians" && <TechniciansPage />}
          {activePage === "promotions" && <PromotionsPage />}
          {activePage === "tax-invoice-requests" && <TaxInvoiceRequestsPage />}
          {activePage === "members" && <MembersPage />}
          {activePage === "line-chat" && <LineChatPage />}
          {activePage === "line-search-test" && <LineSearchTestPage />}
          {activePage === "line-reply-settings" && <LineReplySettingsPage />}
          {activePage === "users" && <UsersPage />}
            </>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}
