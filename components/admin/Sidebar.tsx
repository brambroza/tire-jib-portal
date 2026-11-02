import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PageId } from "./types";
import { supabase } from "../../lib/supabaseClient";

const navItems: { id: PageId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "tire-catalog", label: "ยี่ห้อ & ลายยาง" },
  { id: "car-catalog", label: "ยี่ห้อ & รุ่นรถ" },
  { id: "sites", label: "จัดการเว็บไซต์" },
  { id: "shipping-rates", label: "ค่าจัดส่งรายจังหวัด" },
  { id: "extra-fee-configs", label: "ตั้งค่า ค่าบริการเพิ่ม" },
  { id: "promotions", label: "โปรโมชัน" },
  { id: "tax-invoice-requests", label: "รายการขอใบกำกับภาษี" },
  { id: "hero-content", label: "จัดการ Hero Section/Ads" },
  { id: "customer-notifications", label: "แจ้งเตือนลูกค้า" },
  { id: "stock", label: "จัดการยาง" },
  { id: "pricing", label: "ปรับปรุงยอดคงคลัง" },
  { id: "sales-summary", label: "สรุปยอดขาย" },
  { id: "orders", label: "คำสั่งซื้อ" },
  { id: "install", label: "นัดติดตั้ง" },
  { id: "install-checklist", label: "จัดการ Checklist" },
  { id: "field-install", label: "งานติดตั้ง" },
  { id: "technicians", label: "ทีมช่าง" },
  { id: "members", label: "สมาชิก & ดีลเลอร์" },
  { id: "line-chat", label: "แชทลูกค้า LINE" },
  { id: "line-search-test", label: "ทดสอบค้นหา LINE" },
  { id: "line-reply-settings", label: "ตั้งค่าปุ่มข้อความ LINE" },
  { id: "users", label: "จัดการผู้ใช้งาน" }
];

type SidebarProps = {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  isOpen: boolean;
};

type ProfilePermissionRow = {
  role: string | null;
  is_active: boolean | null;
  menu_permissions: string[] | null;
  full_name?: string | null;
};

export default function Sidebar({ activePage, onNavigate, isOpen }: SidebarProps) {
  const router = useRouter();
  const [orderBadge, setOrderBadge] = useState(0);
  const [installBadge, setInstallBadge] = useState(0);
  const [taxInvoiceBadge, setTaxInvoiceBadge] = useState(0);
  const [siteNames, setSiteNames] = useState<string[]>([]);
  const [allowedMenus, setAllowedMenus] = useState<Set<PageId> | null>(null);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [userName, setUserName] = useState("User");
  const [userRole, setUserRole] = useState("-");
  const [loggingOut, setLoggingOut] = useState(false);

  function buildAllowedMenus(profile: ProfilePermissionRow | null) {
    const allPages = new Set<PageId>(navItems.map((item) => item.id));
    if (!profile || profile.is_active === false) {
      return new Set<PageId>();
    }
    if (profile.role === "admin") {
      return allPages;
    }
    const fromProfile = Array.isArray(profile.menu_permissions)
      ? profile.menu_permissions
      : [];
    const next = new Set<PageId>();
    fromProfile.forEach((menuId) => {
      if (navItems.some((item) => item.id === menuId)) {
        next.add(menuId as PageId);
      }
    });
    return next;
  }

  function getFirstAllowedPage(menus: Set<PageId>) {
    return navItems.find((item) => menus.has(item.id))?.id ?? null;
  }

  useEffect(() => {
    let alive = true;

    async function loadMeta() {
      if (!supabase) return;
      const authRes = await supabase.auth.getUser();
      if (!alive) return;

      const authUserId = authRes.data.user?.id ?? null;
      if (!authUserId) {
        setAllowedMenus(new Set<PageId>());
        setPermissionsReady(true);
      } else {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("role,is_active,menu_permissions,full_name")
          .eq("id", authUserId)
          .maybeSingle();
        if (!alive) return;
        const profile = (profileData ?? null) as ProfilePermissionRow | null;
        setAllowedMenus(buildAllowedMenus(profile));
        setUserName(profile?.full_name?.trim() || authRes.data.user?.email || "User");
        setUserRole(profile?.role || "-");
        setPermissionsReady(true);
      }

      const [{ count: orderCount }, { count: installCount }, { count: taxInvoiceCount }, { data: siteData }] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("install_appointments")
          .select("id", { count: "exact", head: true })
          .eq("status", "waiting"),
        supabase
          .from("tax_invoice_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "processing"]),
        supabase.from("sites").select("name").order("name")
      ]);
      if (!alive) return;
      setOrderBadge(orderCount ?? 0);
      setInstallBadge(installCount ?? 0);
      setTaxInvoiceBadge(taxInvoiceCount ?? 0);
      setSiteNames((siteData ?? []).map((row) => row.name).filter(Boolean));
    }

    void loadMeta();
    return () => {
      alive = false;
    };
  }, []);

  async function handleLogout() {
    if (!supabase || loggingOut) return;
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  useEffect(() => {
    if (!allowedMenus) return;
    if (!allowedMenus.has(activePage)) {
      const firstAllowed = getFirstAllowedPage(allowedMenus);
      if (firstAllowed) onNavigate(firstAllowed);
    }
  }, [allowedMenus, activePage, onNavigate]);

  const visibleNavItems = permissionsReady
    ? navItems.filter(
        (item) => item.id !== "dashboard" && (allowedMenus ? allowedMenus.has(item.id) : false)
      )
    : [];

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      <div className="logo">
        <div className="logo-mark">
          <div className="logo-icon">
            <img src="/assets/Logo.avif" alt="Dreammaker logo" />
          </div>
          <div>
            <div className="logo-name"> <span>Dreammaker</span></div>
            <div className="logo-sub">ADMIN PANEL</div>
          </div>
        </div>
      </div>

      <nav className="nav scrollbar-thin">
        {permissionsReady && allowedMenus?.has("dashboard") ? (
          <div className="nav-section">
            <div className="nav-label">Overview</div>
            <div
              className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}
              onClick={() => onNavigate("dashboard")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Dashboard
            </div>
          </div>
        ) : null}

        <div className="nav-section">
          <div className="nav-label">จัดการ</div>
          {!permissionsReady ? (
            <div className="nav-item" style={{ pointerEvents: "none", opacity: 0.7 }}>
              กำลังโหลดสิทธิ์เมนู...
            </div>
          ) : (
            visibleNavItems.map((item) => (
              <div
                key={item.id}
                className={`nav-item ${activePage === item.id ? "active" : ""}`}
                onClick={() => onNavigate(item.id)}
              >
                {item.id === "stock" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 8V21H3V8" />
                    <path d="M23 3H1v5h22V3z" />
                    <path d="M10 12h4" />
                  </svg>
                )}
                {item.id === "pricing" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 1v22" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                )}
                {item.id === "sales-summary" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 19h16" />
                    <rect x="6" y="11" width="2.8" height="6" rx="0.8" />
                    <rect x="10.6" y="8" width="2.8" height="9" rx="0.8" />
                    <rect x="15.2" y="5" width="2.8" height="12" rx="0.8" />
                  </svg>
                )}
                {item.id === "orders" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                )}
                {item.id === "install" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                )}
                {item.id === "field-install" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 20h16" />
                    <path d="M12 4v10" />
                    <path d="M8 8l4-4 4 4" />
                    <path d="M6 14h12" />
                  </svg>
                )}
                {item.id === "install-checklist" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9 11l2 2 4-4" />
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="7" y1="8" x2="7" y2="8" />
                    <line x1="7" y1="14" x2="7" y2="14" />
                    <line x1="11" y1="8" x2="17" y2="8" />
                    <line x1="11" y1="14" x2="17" y2="14" />
                  </svg>
                )}
                {item.id === "members" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                )}
                {item.id === "line-chat" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3V11.5A8.5 8.5 0 0 1 11.5 3h1A8.5 8.5 0 0 1 21 11.5z" />
                    <path d="M8 11h8" />
                    <path d="M8 15h5" />
                  </svg>
                )}
                {item.id === "sites" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="3" width="18" height="7" rx="2" />
                    <rect x="3" y="14" width="18" height="7" rx="2" />
                    <line x1="7" y1="6.5" x2="7" y2="6.5" />
                    <line x1="7" y1="17.5" x2="7" y2="17.5" />
                  </svg>
                )}
                {item.id === "shipping-rates" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z" />
                    <circle cx="12" cy="10" r="2.2" />
                  </svg>
                )}
                {item.id === "extra-fee-configs" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                    <circle cx="9" cy="6" r="2" />
                    <circle cx="15" cy="12" r="2" />
                    <circle cx="11" cy="18" r="2" />
                  </svg>
                )}
                {item.id === "hero-content" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M7 15l3.2-3.2a1 1 0 0 1 1.4 0L14 14l2.7-2.7a1 1 0 0 1 1.4 0L20 13" />
                    <circle cx="8" cy="9" r="1.2" />
                  </svg>
                )}
                {item.id === "customer-notifications" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V10a6 6 0 1 0-12 0v4.2c0 .53-.21 1.04-.59 1.41L4 17h5" />
                    <path d="M10 17a2 2 0 0 0 4 0" />
                  </svg>
                )}
                {item.id === "tire-catalog" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="3" />
                    <line x1="12" y1="3" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="21" />
                    <line x1="3" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="21" y2="12" />
                  </svg>
                )}
                {item.id === "car-catalog" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="8" width="18" height="7" rx="2" />
                    <circle cx="7.5" cy="17" r="2" />
                    <circle cx="16.5" cy="17" r="2" />
                    <path d="M6 8l2-3h8l2 3" />
                  </svg>
                )}
                {item.id === "technicians" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="8" cy="7" r="3.5" />
                    <circle cx="17" cy="7" r="3.5" />
                    <path d="M2.5 20a5.5 5.5 0 0 1 11 0" />
                    <path d="M10.5 20a5.5 5.5 0 0 1 11 0" />
                  </svg>
                )}
                {item.id === "promotions" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 7h12l6 5-6 5H3z" />
                    <circle cx="7.5" cy="12" r="1.5" />
                  </svg>
                )}
                {item.id === "tax-invoice-requests" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="13" y2="17" />
                  </svg>
                )}
                {item.id === "users" && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="9" cy="7" r="4" />
                    <path d="M17 11a4 4 0 1 0-4-4" />
                    <path d="M21 21v-2a4 4 0 0 0-4-4h-2" />
                    <path d="M13 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  </svg>
                )}
                {item.label}
                {item.id === "orders" && orderBadge > 0 && (
                  <span className="nav-badge">{orderBadge}</span>
                )}
                {item.id === "install" && installBadge > 0 && (
                  <span className="nav-badge yellow">{installBadge}</span>
                )}
                {item.id === "tax-invoice-requests" && taxInvoiceBadge > 0 && (
                  <span className="nav-badge">{taxInvoiceBadge}</span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="nav-section">
          <div className="nav-label">Sites</div>
          {siteNames.length === 0 ? (
            <div className="nav-item">-</div>
          ) : (
            siteNames.map((name, idx) => (
              <div className="nav-item" key={name}>
                <span className={`site-dot ${idx === 0 ? "s1" : idx === 1 ? "s2" : "s3"}`} /> {name}
              </div>
            ))
          )}
        </div>
      </nav>

      <div className="sidebar-footer">
        <Link href="/profile" className="user-card">
          <div className="avatar">A</div>
          <div className="user-info">
            <div className="user-name">{userName}</div>
            <div className="user-role">{userRole}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </Link>
        <button
          className="btn btn-ghost"
          style={{ width: "100%", marginTop: 8, justifyContent: "center" }}
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "กำลังออกจากระบบ..." : "Logout"}
        </button>
      </div>
    </aside>
  );
}
