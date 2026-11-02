"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

type TaxInvoiceRequestRow = {
  id: string;
  order_id: string;
  customer_id: string;
  request_type: "personal" | "company";
  tax_payer_name: string;
  tax_id: string;
  branch_no: string | null;
  address: string;
  email: string | null;
  phone: string | null;
  status: "pending" | "processing" | "approved" | "rejected" | "cancelled";
  note: string | null;
  created_at: string;
  updated_at: string;
  orders?: { order_no: string | null } | null;
};

type OrderBrief = {
  id: string;
  order_no: string;
  customer_id: string;
};

type CustomerBrief = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type FormState = {
  id: string;
  order_id: string;
  customer_id: string;
  request_type: "personal" | "company";
  tax_payer_name: string;
  tax_id: string;
  branch_no: string;
  address: string;
  email: string;
  phone: string;
  status: "pending" | "processing" | "approved" | "rejected" | "cancelled";
  note: string;
};

const EMPTY_FORM: FormState = {
  id: "",
  order_id: "",
  customer_id: "",
  request_type: "personal",
  tax_payer_name: "",
  tax_id: "",
  branch_no: "",
  address: "",
  email: "",
  phone: "",
  status: "pending",
  note: ""
};

const STATUS_LABEL: Record<FormState["status"], string> = {
  pending: "รอดำเนินการ",
  processing: "กำลังดำเนินการ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
  cancelled: "ยกเลิก"
};

const STATUS_BADGE: Record<FormState["status"], string> = {
  pending: "badge pending",
  processing: "badge process",
  approved: "badge paid",
  rejected: "badge cancel",
  cancelled: "badge cancel"
};
const PAGE_SIZE_OPTIONS = [10, 20, 25];

export default function TaxInvoiceRequestsPage() {
  const [rows, setRows] = useState<TaxInvoiceRequestRow[]>([]);
  const [orders, setOrders] = useState<OrderBrief[]>([]);
  const [customers, setCustomers] = useState<CustomerBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const statusOk = statusFilter === "all" || row.status === statusFilter;
      const customer = customerMap.get(row.customer_id);
      const searchOk =
        search.trim().length === 0 ||
        [
          row.orders?.order_no ?? "",
          row.tax_payer_name,
          row.tax_id,
          row.email ?? "",
          row.phone ?? "",
          customer?.display_name ?? "",
          customer?.full_name ?? ""
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
      return statusOk && searchOk;
    });
  }, [rows, search, statusFilter, customerMap]);

  const pagination = useTablePagination(filteredRows, 10);

  const loadData = useCallback(async () => {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: requestData, error: requestError } = await supabase
        .from("tax_invoice_requests")
        .select(
          "id,order_id,customer_id,request_type,tax_payer_name,tax_id,branch_no,address,email,phone,status,note,created_at,updated_at"
        )
        .order("created_at", { ascending: false });
      if (requestError) throw requestError;

      const baseRows = (requestData ?? []) as Omit<TaxInvoiceRequestRow, "orders">[];
      // แสดงรายการหลักก่อนเสมอ แม้ query ตารางเสริมจะติดสิทธิ์/RLS
      setRows(baseRows.map((row) => ({ ...row, orders: { order_no: null } })));

      const orderIds = Array.from(new Set(baseRows.map((row) => row.order_id)));

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("id,order_no,customer_id")
        .in("id", orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"]);
      if (orderError) {
        setOrders([]);
        setError(`โหลดเลขออเดอร์ไม่สำเร็จ: ${orderError.message}`);
        return;
      }

      const mappedOrders = (orderData ?? []) as OrderBrief[];
      const orderMap = new Map(mappedOrders.map((order) => [order.id, order]));
      const customerIds = Array.from(new Set(baseRows.map((row) => row.customer_id)));
      const { data: customerData, error: customerError } = await supabase
        .from("customes")
        .select("id,display_name,full_name,email,phone")
        .in("id", customerIds.length ? customerIds : ["00000000-0000-0000-0000-000000000000"]);
      if (customerError) {
        setCustomers([]);
        setError((prev) =>
          prev
            ? `${prev} | โหลดข้อมูลลูกค้าไม่สำเร็จ: ${customerError.message}`
            : `โหลดข้อมูลลูกค้าไม่สำเร็จ: ${customerError.message}`
        );
      } else {
        setCustomers((customerData ?? []) as CustomerBrief[]);
      }

      setRows(
        baseRows.map((row) => ({
          ...row,
          orders: { order_no: orderMap.get(row.order_id)?.order_no ?? null }
        }))
      );
      setOrders(mappedOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(row: TaxInvoiceRequestRow) {
    setForm({
      id: row.id,
      order_id: row.order_id,
      customer_id: row.customer_id,
      request_type: row.request_type,
      tax_payer_name: row.tax_payer_name,
      tax_id: row.tax_id,
      branch_no: row.branch_no ?? "",
      address: row.address,
      email: row.email ?? "",
      phone: row.phone ?? "",
      status: row.status,
      note: row.note ?? ""
    });
    setModalOpen(true);
  }

  function handleOrderChange(orderId: string) {
    const matched = orders.find((order) => order.id === orderId);
    setForm((prev) => ({
      ...prev,
      order_id: orderId,
      customer_id: matched?.customer_id ?? prev.customer_id
    }));
  }

  async function handleSave() {
    if (!supabase) return;
    if (!form.order_id || !form.customer_id || !form.tax_payer_name.trim() || !form.tax_id.trim() || !form.address.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบ (ออเดอร์, ผู้เสียภาษี, เลขผู้เสียภาษี, ที่อยู่)");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const payload = {
      order_id: form.order_id,
      customer_id: form.customer_id,
      request_type: form.request_type,
      tax_payer_name: form.tax_payer_name.trim(),
      tax_id: form.tax_id.trim(),
      branch_no: form.branch_no.trim() || null,
      address: form.address.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      status: form.status,
      note: form.note.trim() || null,
      updated_at: new Date().toISOString()
    };
    try {
      if (form.id) {
        const { error: updateError } = await supabase
          .from("tax_invoice_requests")
          .update(payload)
          .eq("id", form.id);
        if (updateError) throw updateError;
        setSuccess("อัปเดตรายการขอใบกำกับภาษีเรียบร้อย");
      } else {
        const { error: insertError } = await supabase
          .from("tax_invoice_requests")
          .insert(payload);
        if (insertError) throw insertError;
        setSuccess("เพิ่มรายการขอใบกำกับภาษีเรียบร้อย");
      }
      setModalOpen(false);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: TaxInvoiceRequestRow) {
    if (!supabase) return;
    if (!confirm(`ลบคำขอใบกำกับภาษี ${row.orders?.order_no ?? row.id} ใช่หรือไม่`)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error: deleteError } = await supabase
      .from("tax_invoice_requests")
      .delete()
      .eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("ลบรายการเรียบร้อย");
      await loadData();
    }
    setSaving(false);
  }

  async function handleQuickStatusChange(
    row: TaxInvoiceRequestRow,
    status: FormState["status"]
  ) {
    if (!supabase || row.status === status) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error: updateError } = await supabase
      .from("tax_invoice_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("อัปเดตสถานะเรียบร้อย");
      await loadData();
    }
    setSaving(false);
  }

  return (
    <div className="page active">
      <div className="toolbar" style={{ marginBottom: 18, gap: 10 }}>
        <div className="search-bar" style={{ width: 280 }}>
          <input
            placeholder="ค้นหาเลขออร์เดอร์/ชื่อผู้เสียภาษี/Tax ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">ทุกสถานะ</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={loadData} disabled={loading || saving}>
          รีเฟรช
        </button>
        <button className="btn btn-primary" onClick={openCreate}>
          เพิ่มรายการขอใบกำกับภาษี
        </button>
      </div>

      <ActionFeedback
        error={error}
        success={success}
        onClearError={() => setError(null)}
        onClearSuccess={() => setSuccess(null)}
      />

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>ผู้เสียภาษี</th>
                <th>Tax ID</th>
                <th>ประเภท</th>
                <th>สถานะ</th>
                <th>อัปเดตสถานะ</th>
                <th>อัปเดตล่าสุด</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedRows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.orders?.order_no ?? "-"}</td>
                  <td>{row.tax_payer_name}</td>
                  <td className="mono">{row.tax_id}</td>
                  <td>{row.request_type === "company" ? "นิติบุคคล" : "บุคคลธรรมดา"}</td>
                  <td>
                    <span className={STATUS_BADGE[row.status]}>{STATUS_LABEL[row.status]}</span>
                  </td>
                  <td>
                    <select
                      className="filter-select"
                      value={row.status}
                      onChange={(event) =>
                        void handleQuickStatusChange(row, event.target.value as FormState["status"])
                      }
                      disabled={saving}
                      style={{ minWidth: 140 }}
                    >
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ color: "var(--text3)", fontSize: 12 }}>
                    {new Date(row.updated_at).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric"
                    })}
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => openEdit(row)}
                    >
                      แก้ไข
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                      onClick={() => void handleDelete(row)}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredRows.length && !loading && (
                <tr>
                  <td colSpan={8} style={{ color: "var(--text3)", padding: 16 }}>
                    ยังไม่มีรายการขอใบกำกับภาษี
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePaginationControls
          page={pagination.page}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 840 }}>
            <div className="modal-head">
              <div className="modal-title">{form.id ? "แก้ไขรายการขอใบกำกับภาษี" : "เพิ่มรายการขอใบกำกับภาษี"}</div>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-grid">
                <label>
                  ออร์เดอร์
                  <select value={form.order_id} onChange={(e) => handleOrderChange(e.target.value)}>
                    <option value="">เลือกออร์เดอร์</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.order_no}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ประเภทผู้ขอ
                  <select
                    value={form.request_type}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, request_type: e.target.value as FormState["request_type"] }))
                    }
                  >
                    <option value="personal">บุคคลธรรมดา</option>
                    <option value="company">นิติบุคคล</option>
                  </select>
                </label>
                <label>
                  ชื่อผู้เสียภาษี
                  <input value={form.tax_payer_name} onChange={(e) => setForm((prev) => ({ ...prev, tax_payer_name: e.target.value }))} />
                </label>
                <label>
                  เลขผู้เสียภาษี
                  <input value={form.tax_id} onChange={(e) => setForm((prev) => ({ ...prev, tax_id: e.target.value }))} />
                </label>
                <label>
                  สาขา
                  <input value={form.branch_no} onChange={(e) => setForm((prev) => ({ ...prev, branch_no: e.target.value }))} />
                </label>
                <label>
                  สถานะ
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, status: e.target.value as FormState["status"] }))
                    }
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  ที่อยู่
                  <textarea
                    className="auth-input"
                    rows={3}
                    value={form.address}
                    onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                    style={{ resize: "vertical", marginBottom: 0 }}
                  />
                </label>
                <label>
                  อีเมล
                  <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                </label>
                <label>
                  โทรศัพท์
                  <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  หมายเหตุ
                  <textarea
                    className="auth-input"
                    rows={2}
                    value={form.note}
                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                    style={{ resize: "vertical", marginBottom: 0 }}
                  />
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ยกเลิก
              </button>
              <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
