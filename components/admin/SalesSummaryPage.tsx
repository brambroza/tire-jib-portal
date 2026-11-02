"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import AppDatePicker from "../ui/AppDatePicker";

type OrderSummaryRow = {
  id: string;
  status: "pending" | "processing" | "shipping" | "completed" | "cancelled";
  payment_status: "unpaid" | "pending" | "paid" | "failed" | "refunded";
  total_amount: number | null;
  created_at: string;
};

type InstallSummaryRow = {
  id: string;
  status: "waiting" | "in_progress" | "done" | "missed" | "cancelled";
  scheduled_at: string;
};

function toDateInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function startOfDay(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  return date.toISOString();
}

function endOfDay(dateText: string) {
  const date = new Date(`${dateText}T23:59:59.999`);
  return date.toISOString();
}

export default function SalesSummaryPage() {
  const today = useMemo(() => new Date(), []);
  const firstDayOfMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today]
  );

  const [dateFrom, setDateFrom] = useState(toDateInputValue(firstDayOfMonth));
  const [dateTo, setDateTo] = useState(toDateInputValue(today));
  const [orders, setOrders] = useState<OrderSummaryRow[]>([]);
  const [appointments, setAppointments] = useState<InstallSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSummary();
  }, []);

  async function loadSummary() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!dateFrom || !dateTo) {
      setError("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด");
      return;
    }
    if (dateFrom > dateTo) {
      setError("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
      return;
    }

    setLoading(true);
    setError(null);

    const fromIso = startOfDay(dateFrom);
    const toIso = endOfDay(dateTo);

    const [{ data: orderData, error: orderError }, { data: installData, error: installError }] =
      await Promise.all([
        supabase
          .from("orders")
          .select("id,status,payment_status,total_amount,created_at")
          .gte("created_at", fromIso)
          .lte("created_at", toIso),
        supabase
          .from("install_appointments")
          .select("id,status,scheduled_at")
          .gte("scheduled_at", fromIso)
          .lte("scheduled_at", toIso)
      ]);

    if (orderError || installError) {
      setError(orderError?.message ?? installError?.message ?? "โหลดข้อมูลไม่สำเร็จ");
      setLoading(false);
      return;
    }

    setOrders((orderData ?? []) as OrderSummaryRow[]);
    setAppointments((installData ?? []) as InstallSummaryRow[]);
    setLoading(false);
  }

  const totalOrders = orders.length;
  const processingOrders = orders.filter(
    (order) => order.status === "processing" || order.status === "shipping"
  ).length;
  const paidAmount = orders
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
  const waitingInstall = appointments.filter((row) => row.status === "waiting").length;
  const doneInstall = appointments.filter((row) => row.status === "done").length;

  return (
    <div className="page active">
      <div className="toolbar" style={{ marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>จากวันที่</span>
          <AppDatePicker className="filter-select" value={dateFrom} onChange={setDateFrom} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>ถึงวันที่</span>
          <AppDatePicker className="filter-select" value={dateTo} onChange={setDateTo} />
        </label>
        <button className="btn btn-primary" onClick={loadSummary} disabled={loading}>
          {loading ? "กำลังโหลด..." : "ค้นหา"}
        </button>
      </div>

      <ActionFeedback error={error} onClearError={() => setError(null)} />

      <div className="kpi-grid">
        <div className="kpi-card k1">
          <div className="kpi-label">รายการทั้งหมด</div>
          <div className="kpi-value mono">{totalOrders.toLocaleString("th-TH")}</div>
          <div className="kpi-sub">
            <span className="kpi-tag up">{dateFrom}</span> ถึง {dateTo}
          </div>
        </div>

        <div className="kpi-card k2">
          <div className="kpi-label">กำลังดำเนินการ</div>
          <div className="kpi-value mono">{processingOrders.toLocaleString("th-TH")}</div>
          <div className="kpi-sub">
            <span className="kpi-tag up">processing/shipping</span> ออร์เดอร์
          </div>
        </div>

        <div className="kpi-card k3">
          <div className="kpi-label">ชำระเงินแล้ว</div>
          <div className="kpi-value mono">฿{paidAmount.toLocaleString("th-TH")}</div>
          <div className="kpi-sub">
            <span className="kpi-tag up">paid</span> ยอดรวม
          </div>
        </div>

        <div className="kpi-card k4">
          <div className="kpi-label">รอติดตั้ง</div>
          <div className="kpi-value mono">{waitingInstall.toLocaleString("th-TH")}</div>
          <div className="kpi-sub">
            <span className="kpi-tag down">waiting</span> งานติดตั้ง
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-head">
          <span className="card-title">สรุปสถานะงานติดตั้ง</span>
        </div>
        <div className="card-body" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13 }}>
            งานรอติดตั้ง: <span className="mono" style={{ color: "var(--accent)" }}>{waitingInstall}</span>
          </div>
          <div style={{ fontSize: 13 }}>
            งานติดตั้งเสร็จ: <span className="mono" style={{ color: "var(--green)" }}>{doneInstall}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
