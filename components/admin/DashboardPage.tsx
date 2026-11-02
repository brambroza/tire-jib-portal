"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";

type DashboardPageProps = {
  activeTab: string;
  onTabChange: (label: string) => void;
  onConfirmOrder: (id: string) => void;
  confirmedOrders: Set<string>;
};

type SiteRow = {
  id: string;
  code: string | null;
  name: string | null;
};

type OrderRow = {
  id: string;
  order_no: string;
  site_id: string | null;
  customer_id?: string | null;
  status: "pending" | "processing" | "shipping" | "completed" | "cancelled";
  payment_status: "unpaid" | "pending" | "paid" | "failed" | "refunded";
  total_amount: number;
  created_at: string;
  sites?: SiteRow | null;
  customer_name?: string | null;
  items: string;
  itemCount: number;
};

type CustomerRow = {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  email?: string | null;
};

type OrderItemRow = {
  order_id: string;
  quantity: number;
  skus?: {
    size_label: string | null;
    products?: { brand: string | null; name: string | null } | null;
  } | null;
};

type InventoryRow = {
  qty_on_hand: number;
  min_stock: number;
  skus?: { size_label: string | null; products?: { brand: string | null; name: string | null } | null } | null;
};

type PromotionRow = {
  id: string;
  title: string;
  message: string;
  active: boolean;
  priority: number;
  start_at: string | null;
  end_at: string | null;
  site_id: string | null;
};

const SITE_COLOR: Record<string, string> = {
  car_retail: "var(--blue)",
  truck_dealer: "var(--green)",
  moto_dealer: "var(--purple)"
};

const SITE_DOT: Record<string, string> = {
  car_retail: "s1",
  truck_dealer: "s2",
  moto_dealer: "s3"
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getRangeStart(label: string) {
  const now = new Date();
  if (label.includes("วันนี้")) return startOfDay(now);
  if (label.includes("7 วัน")) {
    const d = startOfDay(now);
    d.setDate(d.getDate() - 6);
    return d;
  }
  if (label.includes("เดือน")) {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (label.includes("ปี")) {
    return new Date(now.getFullYear(), 0, 1);
  }
  return startOfDay(now);
}

function displayStatus(order: OrderRow) {
  if (order.payment_status === "paid") return "paid";
  if (order.status === "cancelled") return "cancel";
  if (order.status === "processing" || order.status === "shipping") return "process";
  return "pending";
}

function statusLabel(status: string) {
  if (status === "paid") return "ชำระแล้ว";
  if (status === "process") return "กำลังดำเนินการ";
  if (status === "cancel") return "ยกเลิก";
  return "รอยืนยัน";
}

function statusClass(status: string) {
  if (status === "paid") return "badge paid";
  if (status === "process") return "badge process";
  if (status === "cancel") return "badge cancel";
  return "badge pending";
}

export default function DashboardPage({
  activeTab,
  onTabChange,
  onConfirmOrder,
  confirmedOrders
}: DashboardPageProps) {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [ordersRange, setOrdersRange] = useState<OrderRow[]>([]);
  const [orders7d, setOrders7d] = useState<OrderRow[]>([]);
  const [latestOrders, setLatestOrders] = useState<OrderRow[]>([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [lowStock, setLowStock] = useState<InventoryRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const rangeStart = useMemo(() => getRangeStart(activeTab), [activeTab]);

  useEffect(() => {
    void loadDashboard();
  }, [rangeStart]);

  async function loadDashboard() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setLoading(true);
    setError(null);

    const nowIso = new Date().toISOString();
    const rangeStartIso = rangeStart.toISOString();
    const sevenStart = startOfDay(new Date());
    sevenStart.setDate(sevenStart.getDate() - 6);
    const sevenStartIso = sevenStart.toISOString();

    const [
      { data: siteData },
      { data: rangeData, error: rangeError },
      { data: sevenData, error: sevenError },
      { data: promoData, error: promoError },
      { data: customerData, error: customerError }
    ] =
      await Promise.all([
        supabase.from("sites").select("id,code,name").order("name"),
        supabase
          .from("orders")
          .select("id,order_no,site_id,customer_id,status,payment_status,total_amount,created_at,sites(id,code,name)")
          .gte("created_at", rangeStartIso)
          .lte("created_at", nowIso)
          .order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("id,site_id,total_amount,payment_status,created_at,sites(id,code,name)")
          .gte("created_at", sevenStartIso)
          .lte("created_at", nowIso),
        supabase
          .from("promotions")
          .select("id,title,message,active,priority,start_at,end_at,site_id")
          .eq("active", true)
          .order("priority", { ascending: false }),
        supabase
          .from("customes")
          .select("id,display_name,email")
      ]);

    if (rangeError || sevenError || promoError || customerError) {
      setError(
        rangeError?.message ||
        sevenError?.message ||
        promoError?.message ||
        customerError?.message ||
        "โหลดข้อมูลไม่สำเร็จ"
      );
      setLoading(false);
      return;
    }

    if (siteData) setSites(siteData as SiteRow[]);
    if (promoData) {
      const now = new Date();
      const filtered = (promoData as PromotionRow[]).filter((promo) => {
        if (!promo.active) return false;
        if (promo.start_at && new Date(promo.start_at) > now) return false;
        if (promo.end_at && new Date(promo.end_at) < now) return false;
        return true;
      });
      setPromotions(filtered);
    }

    const latest = (rangeData ?? []).slice(0, 5);
    const latestIds = latest.map((row) => row.id);
    let items: OrderItemRow[] = [];
    if (latestIds.length) {
      const { data: itemData } = await supabase
        .from("order_items")
        .select("order_id,quantity,skus(size_label,products(brand,name))")
        .in("order_id", latestIds);
      if (itemData) items = itemData as unknown as OrderItemRow[];
    }

    const itemMap = new Map<string, { count: number; label: string }>();
    items.forEach((item) => {
      const existing = itemMap.get(item.order_id) ?? { count: 0, label: "" };
      const product = item.skus?.products;
      const labelParts = [];
      if (product?.brand) labelParts.push(product.brand);
      if (product?.name) labelParts.push(product.name);
      if (item.skus?.size_label) labelParts.push(item.skus.size_label);
      const label = labelParts.join(" ");
      itemMap.set(item.order_id, {
        count: existing.count + (item.quantity ?? 0),
        label: existing.label || label
      });
    });

    const customerMap = new Map<string, CustomerRow>();
    (customerData ?? []).forEach((row) => {
      customerMap.set(row.id, row as CustomerRow);
    });

    const mappedRange = (rangeData ?? []).map((row) => {
      const itemInfo = itemMap.get(row.id);
      const customer = row.customer_id ? customerMap.get(row.customer_id) : null;
      return {
        ...row,
        total_amount: Number(row.total_amount ?? 0),
        customer_name: customer?.display_name ?? customer?.email ?? null,
        items: itemInfo?.label || "-",
        itemCount: itemInfo?.count ?? 0
      } as unknown as OrderRow;
    });

    const mappedSeven = (sevenData ?? []).map((row) => ({
      ...row,
      total_amount: Number(row.total_amount ?? 0),
      items: "",
      itemCount: 0
    })) as unknown as OrderRow[];

    setOrdersRange(mappedRange);
    setOrders7d(mappedSeven);
    setLatestOrders(mappedRange.slice(0, 5));

    const { data: invData } = await supabase
      .from("inventory")
      .select("qty_on_hand,min_stock,skus(size_label,products(brand,name))");

    if (invData) {
      const inventoryRows = invData as unknown as InventoryRow[];
      const total = inventoryRows.reduce((sum, row) => sum + (row.qty_on_hand ?? 0), 0);
      setInventoryTotal(total);
      const low = inventoryRows
        .filter((row) => row.qty_on_hand <= row.min_stock)
        .sort((a, b) => a.qty_on_hand - b.qty_on_hand)
        .slice(0, 3);
      setLowStock(low);
    }

    setLoading(false);
  }

  const totalSales = ordersRange
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + order.total_amount, 0);

  const orderCount = ordersRange.length;
  const pendingCount = ordersRange.filter(
    (order) => order.payment_status === "pending" || order.payment_status === "unpaid"
  ).length;

  const salesBySite = useMemo(() => {
    const map = new Map<string, number>();
    ordersRange.forEach((order) => {
      if (order.payment_status !== "paid") return;
      const code = order.sites?.code ?? "unknown";
      map.set(code, (map.get(code) ?? 0) + order.total_amount);
    });
    return map;
  }, [ordersRange]);

  const siteTotals = sites.map((site) => {
    const value = salesBySite.get(site.code ?? "") ?? 0;
    return { ...site, value };
  });
  const salesSum = siteTotals.reduce((sum, item) => sum + item.value, 0);

  const chartDays = useMemo(() => {
    const days: { label: string; date: Date }[] = [];
    const start = startOfDay(new Date());
    start.setDate(start.getDate() - 6);
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const label = day.toLocaleDateString("th-TH", { weekday: "short" });
      days.push({ label, date: day });
    }
    return days;
  }, []);

  const chartSeries = chartDays.map((day) => {
    const dayOrders = orders7d.filter((order) => {
      const date = new Date(order.created_at);
      return (
        date.getFullYear() === day.date.getFullYear() &&
        date.getMonth() === day.date.getMonth() &&
        date.getDate() === day.date.getDate()
      );
    });
    const totals: Record<string, number> = {};
    dayOrders.forEach((order) => {
      if (order.payment_status !== "paid") return;
      const code = order.sites?.code ?? "unknown";
      totals[code] = (totals[code] ?? 0) + order.total_amount;
    });
    return { label: day.label, totals };
  });

  const maxDaily = chartSeries.reduce((max, day) => {
    const total = Object.values(day.totals).reduce((sum, value) => sum + value, 0);
    return Math.max(max, total);
  }, 0);

  async function handleConfirm(orderId: string) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    await supabase.from("orders").update({ payment_status: "paid" }).eq("id", orderId);
    onConfirmOrder(orderId);
    await loadDashboard();
  }

  return (
    <div className="page active">
      {promotions.length > 0 && (
        <div
          style={{
            background: "linear-gradient(90deg, #2b2b2b, #111)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "10px 14px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            overflowX: "auto",
            whiteSpace: "nowrap"
          }}
        >
          <span
            style={{
              background: "#e74c3c",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600
            }}
          >
            โปรวันนี้
          </span>
          {promotions.map((promo, idx) => (
            <span key={promo.id} style={{ color: "#f2c94c", fontSize: 13, fontWeight: 600 }}>
              {promo.title} {promo.message}
              {idx < promotions.length - 1 && <span style={{ color: "var(--text3)", margin: "0 10px" }}>•</span>}
            </span>
          ))}
        </div>
      )}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {["วันนี้", "7 วัน", "เดือนนี้", "ปีนี้"].map((label) => (
          <div
            key={label}
            className={`tab ${activeTab === label ? "active" : ""}`}
            onClick={() => onTabChange(label)}
          >
            {label}
          </div>
        ))}
      </div>

      <ActionFeedback error={error} onClearError={() => setError(null)} />

      <div className="kpi-grid">
        <div className="kpi-card k1">
          <div className="kpi-label">ยอดขายรวม</div>
          <div className="kpi-value mono">฿{totalSales.toLocaleString("th-TH")}</div>
          <div className="kpi-sub">
            <span className="kpi-tag up">{activeTab}</span> รวม
          </div>
        </div>
        <div className="kpi-card k2">
          <div className="kpi-label">คำสั่งซื้อ</div>
          <div className="kpi-value mono">{orderCount.toLocaleString("th-TH")}</div>
          <div className="kpi-sub">
            <span className="kpi-tag up">{orderCount}</span> ออร์เดอร์
          </div>
        </div>
        <div className="kpi-card k3">
          <div className="kpi-label">Stock เหลือ</div>
          <div className="kpi-value mono">{inventoryTotal.toLocaleString("th-TH")}</div>
          <div className="kpi-sub">
            <span className="kpi-tag down">{lowStock.length} SKU</span> ต่ำกว่าขั้นต่ำ
          </div>
        </div>
        <div className="kpi-card k4">
          <div className="kpi-label">รอยืนยัน</div>
          <div className="kpi-value mono">{pendingCount.toLocaleString("th-TH")}</div>
          <div className="kpi-sub">
            <span className="kpi-tag down">ต้องยืนยัน</span> {activeTab}
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-head">
            <span className="card-title">ยอดขายรายวัน (7 วัน)</span>
            <span className="card-action">ดูรายละเอียด</span>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
              {sites.map((site) => (
                <div
                  key={site.id}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)" }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 3,
                      background: SITE_COLOR[site.code ?? ""] || "var(--accent)",
                      display: "inline-block"
                    }}
                  />
                  {site.name ?? site.code}
                </div>
              ))}
            </div>
            <div className="chart-area">
              {chartSeries.map((day, idx) => {
                const isAccent = idx === chartSeries.length - 2;
                const total = Object.values(day.totals).reduce((sum, value) => sum + value, 0);
                const scale = maxDaily > 0 ? (total / maxDaily) * 100 : 0;
                return (
                  <div className="bar-wrap" key={day.label}>
                    {sites.map((site) => {
                      const value = day.totals[site.code ?? ""] ?? 0;
                      const height = maxDaily > 0 ? (value / maxDaily) * 100 : 0;
                      return (
                        <div
                          key={`${day.label}-${site.id}`}
                          className="bar"
                          style={{
                            height: `${height}%`,
                            background: isAccent ? "var(--accent)" : SITE_COLOR[site.code ?? ""] || "var(--accent)",
                            opacity: isAccent ? 1 : 0.7
                          }}
                        />
                      );
                    })}
                    <div className="bar-label" style={{ color: isAccent ? "var(--accent)" : "var(--text3)" }}>
                      {day.label}
                    </div>
                  </div>
                );
              })}
            </div>
            {maxDaily === 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--text3)" }}>
                ยังไม่มีข้อมูลยอดขายใน 7 วันล่าสุด
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">สัดส่วนยอดขายตาม Site</span>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              {siteTotals.map((item, idx) => {
                const width = salesSum > 0 ? Math.round((item.value / salesSum) * 100) : 0;
                return (
                  <div key={item.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                        <span className={`site-dot ${SITE_DOT[item.code ?? ""] || `s${idx + 1}`}`} />
                        {item.name ?? item.code}
                      </span>
                      <span className="mono" style={{ fontSize: 13, color: SITE_COLOR[item.code ?? ""] }}>
                        ฿{item.value.toLocaleString("th-TH")}
                      </span>
                    </div>
                    <div className="tire-stock-bar">
                      <div
                        className="tire-stock-fill"
                        style={{ width: `${width}%`, background: SITE_COLOR[item.code ?? ""] || "var(--accent)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8 }}>Stock ต่ำกว่าขั้นต่ำ</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {lowStock.map((row, idx) => (
                  <div key={`${row.skus?.size_label}-${idx}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--text2)" }}>
                      {row.skus?.products?.brand ?? ""} {row.skus?.products?.name ?? ""} {row.skus?.size_label ?? ""}
                    </span>
                    <span style={{ color: row.qty_on_hand <= 2 ? "var(--red)" : "var(--accent)" }} className="mono">
                      เหลือ {row.qty_on_hand}
                    </span>
                  </div>
                ))}
                {!lowStock.length && (
                  <div style={{ color: "var(--text3)", fontSize: 12 }}>ไม่มีสินค้าใกล้หมด</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">ออร์เดอร์ล่าสุด</span>
          <span className="card-action">ดูทั้งหมด</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ออร์เดอร์ #</th>
                <th>ลูกค้า</th>
                <th>Site</th>
                <th>สินค้า</th>
                <th>ยอดรวม</th>
                <th>สถานะ</th>
                <th>วันที่</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {latestOrders.map((order) => {
                const isConfirmed = confirmedOrders.has(order.id);
                const status = isConfirmed ? "paid" : displayStatus(order);
                return (
                  <tr key={order.id}>
                    <td className="mono" style={{ color: "var(--accent)" }}>{order.order_no}</td>
                    <td>{order.customer_name ?? "-"}</td>
                    <td>
                      <span className={`site-dot ${SITE_DOT[order.sites?.code ?? ""] || "s1"}`} />
                      {order.sites?.name ?? "-"}
                    </td>
                    <td style={{ color: "var(--text2)" }}>
                      {order.items} {order.itemCount ? `×${order.itemCount}` : ""}
                    </td>
                    <td className="mono">฿{order.total_amount.toLocaleString("th-TH")}</td>
                    <td><span className={statusClass(status)}>{isConfirmed ? "ยืนยันแล้ว" : statusLabel(status)}</span></td>
                    <td style={{ color: "var(--text3)" }}>
                      {new Date(order.created_at).toLocaleDateString("th-TH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </td>
                    <td>
                      {order.payment_status !== "paid" && !isConfirmed ? (
                        <button
                          className="btn btn-primary"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => handleConfirm(order.id)}
                        >
                          ยืนยัน
                        </button>
                      ) : (
                        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}>
                          ดูรายละเอียด
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!latestOrders.length && !loading && (
                <tr>
                  <td colSpan={8} style={{ color: "var(--text3)", padding: 16 }}>
                    ยังไม่มีออร์เดอร์
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
