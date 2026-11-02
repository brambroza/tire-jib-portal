"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

type SiteRow = {
  id: string;
  name: string;
};

type ConditionType = "min_item_qty" | "min_subtotal";

type ExtraFeeConfigRow = {
  id: string;
  site_id: string;
  condition_type: ConditionType;
  threshold_value: number;
  extra_fee: number;
  note: string | null;
  active: boolean;
  updated_at: string;
};

const CONDITION_OPTIONS: { value: ConditionType; label: string; thresholdLabel: string; thresholdHint: string }[] = [
  {
    value: "min_item_qty",
    label: "สินค้าไม่ครบจำนวนขั้นต่ำ",
    thresholdLabel: "จำนวนสินค้าขั้นต่ำ (เส้น)",
    thresholdHint: "เช่น 4"
  },
  {
    value: "min_subtotal",
    label: "ยอดรวมสินค้าไม่ครบขั้นต่ำ",
    thresholdLabel: "ยอดรวมขั้นต่ำ (บาท)",
    thresholdHint: "เช่น 1500"
  }
];

const CONDITION_LABEL: Record<ConditionType, string> = {
  min_item_qty: "สินค้าไม่ครบจำนวนขั้นต่ำ",
  min_subtotal: "ยอดรวมสินค้าไม่ครบขั้นต่ำ"
};

const EMPTY_FORM = {
  id: "",
  condition_type: "min_item_qty" as ConditionType,
  threshold_value: "",
  extra_fee: "",
  note: "",
  active: true
};

export default function ExtraFeeConfigsPage() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [siteId, setSiteId] = useState("");
  const [rows, setRows] = useState<ExtraFeeConfigRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasSupabase = useMemo(() => Boolean(supabase), []);

  const selectedConditionMeta = useMemo(() => {
    return CONDITION_OPTIONS.find((item) => item.value === form.condition_type) ?? CONDITION_OPTIONS[0];
  }, [form.condition_type]);
  const pagination = useTablePagination(rows, 10);

  const loadSites = useCallback(async () => {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("sites")
      .select("id,name")
      .eq("active", true)
      .order("created_at", { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    const nextSites = (data ?? []) as SiteRow[];
    setSites(nextSites);
    if (nextSites.length && !siteId) {
      setSiteId(nextSites[0].id);
    }
  }, [siteId]);

  const loadConfigs = useCallback(async (targetSiteId: string) => {
    if (!supabase || !targetSiteId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const { data, error: fetchError } = await supabase
      .from("site_extra_fee_configs")
      .select("id,site_id,condition_type,threshold_value,extra_fee,note,active,updated_at")
      .eq("site_id", targetSiteId)
      .order("condition_type", { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setRows((data ?? []) as ExtraFeeConfigRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  useEffect(() => {
    if (!siteId) return;
    setForm(EMPTY_FORM);
    void loadConfigs(siteId);
  }, [siteId, loadConfigs]);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function editRow(row: ExtraFeeConfigRow) {
    setForm({
      id: row.id,
      condition_type: row.condition_type,
      threshold_value: row.threshold_value.toString(),
      extra_fee: row.extra_fee.toString(),
      note: row.note ?? "",
      active: row.active
    });
    setError(null);
    setSuccess(null);
  }

  async function saveConfig() {
    if (!supabase || !siteId) return;

    const threshold = Number(form.threshold_value);
    const fee = Number(form.extra_fee);

    if (!Number.isFinite(threshold) || threshold < 0) {
      setError("กรุณากรอกค่าเกณฑ์ขั้นต่ำให้ถูกต้อง");
      return;
    }
    if (form.condition_type === "min_item_qty" && !Number.isInteger(threshold)) {
      setError("จำนวนสินค้าขั้นต่ำต้องเป็นจำนวนเต็ม");
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      setError("กรุณากรอกค่าเพิ่มให้ถูกต้อง");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    if (form.id) {
      const { error: updateError } = await supabase
        .from("site_extra_fee_configs")
        .update({
          threshold_value: threshold,
          extra_fee: fee,
          note: form.note.trim() || null,
          active: form.active,
          updated_at: new Date().toISOString()
        })
        .eq("id", form.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(`อัปเดต config: ${CONDITION_LABEL[form.condition_type]} เรียบร้อย`);
        resetForm();
        await loadConfigs(siteId);
      }
    } else {
      const { error: upsertError } = await supabase.from("site_extra_fee_configs").upsert(
        {
          site_id: siteId,
          condition_type: form.condition_type,
          threshold_value: threshold,
          extra_fee: fee,
          note: form.note.trim() || null,
          active: form.active,
          updated_at: new Date().toISOString()
        },
        { onConflict: "site_id,condition_type" }
      );
      if (upsertError) {
        setError(upsertError.message);
      } else {
        setSuccess(`บันทึก config: ${CONDITION_LABEL[form.condition_type]} เรียบร้อย`);
        resetForm();
        await loadConfigs(siteId);
      }
    }

    setSaving(false);
  }

  async function deleteConfig(row: ExtraFeeConfigRow) {
    if (!supabase || !siteId) return;
    if (!confirm(`ลบ config "${CONDITION_LABEL[row.condition_type]}" ใช่หรือไม่`)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error: deleteError } = await supabase
      .from("site_extra_fee_configs")
      .delete()
      .eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess(`ลบ config: ${CONDITION_LABEL[row.condition_type]} เรียบร้อย`);
      if (form.id === row.id) resetForm();
      await loadConfigs(siteId);
    }
    setSaving(false);
  }

  return (
    <div className="page active">
      <div className="toolbar" style={{ marginBottom: 18 }}>
        <label style={{ minWidth: 260 }}>
          <span className="auth-label">เว็บไซต์</span>
          <select
            className="filter-select"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            disabled={!sites.length}
            style={{ width: "100%" }}
          >
            {!sites.length && <option value="">ไม่มีเว็บไซต์</option>}
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={() => siteId && void loadConfigs(siteId)} disabled={!siteId || loading}>
          รีเฟรช
        </button>
      </div>

      <ActionFeedback
        error={error}
        success={success}
        onClearError={() => setError(null)}
        onClearSuccess={() => setSuccess(null)}
      />

      {!hasSupabase ? (
        <div className="card">
          <div className="card-body" style={{ color: "var(--red)" }}>
            ยังไม่ได้ตั้งค่า Supabase env
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-head">
              <span className="card-title">ตั้งค่าเงื่อนไขค่าเพิ่ม</span>
            </div>
            <div className="card-body">
              <div className="modal-grid">
                <label>
                  <span className="auth-label">เงื่อนไข</span>
                  <select
                    className="filter-select"
                    value={form.condition_type}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, condition_type: event.target.value as ConditionType }))
                    }
                    disabled={!siteId || Boolean(form.id)}
                    style={{ width: "100%" }}
                  >
                    {CONDITION_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="auth-label">{selectedConditionMeta.thresholdLabel}</span>
                  <input
                    className="auth-input"
                    type="number"
                    min={0}
                    step={form.condition_type === "min_item_qty" ? 1 : 0.01}
                    value={form.threshold_value}
                    onChange={(event) => setForm((prev) => ({ ...prev, threshold_value: event.target.value }))}
                    placeholder={selectedConditionMeta.thresholdHint}
                    disabled={!siteId}
                  />
                </label>
                <label>
                  <span className="auth-label">ค่าเพิ่ม (บาท)</span>
                  <input
                    className="auth-input"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.extra_fee}
                    onChange={(event) => setForm((prev) => ({ ...prev, extra_fee: event.target.value }))}
                    placeholder="เช่น 100"
                    disabled={!siteId}
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span className="auth-label">หมายเหตุ</span>
                  <input
                    className="auth-input"
                    value={form.note}
                    onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="เช่น ใช้กับโปรส่งฟรีเฉพาะกรุงเทพ"
                    disabled={!siteId}
                  />
                </label>
                <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 22 }}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                    disabled={!siteId}
                    style={{ width: 16 }}
                  />
                  <span className="auth-label" style={{ margin: 0 }}>เปิดใช้งาน config นี้</span>
                </label>
              </div>
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-ghost" onClick={resetForm} disabled={saving}>
                  ล้างฟอร์ม
                </button>
                <button className="btn btn-primary" onClick={() => void saveConfig()} disabled={!siteId || saving}>
                  {saving ? "กำลังบันทึก..." : form.id ? "อัปเดต config" : "เพิ่ม config"}
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>เงื่อนไข</th>
                    <th>เกณฑ์ขั้นต่ำ</th>
                    <th>ค่าเพิ่ม</th>
                    <th>สถานะ</th>
                    <th>หมายเหตุ</th>
                    <th>แก้ไขล่าสุด</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.paginatedRows.map((row) => (
                    <tr key={row.id}>
                      <td>{CONDITION_LABEL[row.condition_type]}</td>
                      <td className="mono">
                        {row.condition_type === "min_item_qty"
                          ? `${Number(row.threshold_value).toLocaleString("th-TH")} เส้น`
                          : `฿${Number(row.threshold_value).toLocaleString("th-TH")}`}
                      </td>
                      <td className="mono">฿{Number(row.extra_fee).toLocaleString("th-TH")}</td>
                      <td>
                        <span className={`badge ${row.active ? "paid" : "pending"}`}>
                          {row.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                        </span>
                      </td>
                      <td style={{ color: "var(--text2)" }}>{row.note || "-"}</td>
                      <td style={{ color: "var(--text3)" }}>
                        {new Date(row.updated_at).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric"
                        })}
                      </td>
                      <td style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => editRow(row)}
                        >
                          แก้ไข
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                          onClick={() => void deleteConfig(row)}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && !loading && (
                    <tr>
                      <td colSpan={7} style={{ color: "var(--text3)", padding: 16 }}>
                        ยังไม่มี config ค่าเพิ่ม
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
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          </div>
        </>
      )}
    </div>
  );
}
