"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";
import { THAI_PROVINCES } from "./thaiProvinces";

type SiteRow = {
  id: string;
  code: "car_retail" | "truck_dealer" | "moto_dealer";
  name: string;
};

type ShippingRateRow = {
  id: string;
  site_id: string;
  province: string;
  shipping_fee: number;
  active: boolean;
  updated_at: string;
};

const EMPTY_FORM = {
  id: "",
  province: "",
  shipping_fee: "",
  active: true
};

export default function ShippingRatesPage() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [siteId, setSiteId] = useState("");
  const [rows, setRows] = useState<ShippingRateRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasSupabase = useMemo(() => Boolean(supabase), []);

  const selectedSite = useMemo(() => {
    return sites.find((site) => site.id === siteId) ?? null;
  }, [siteId, sites]);

  const usedProvinces = useMemo(() => {
    return new Set(rows.map((row) => row.province));
  }, [rows]);

  const provinceOptions = useMemo(() => {
    if (form.id) {
      return THAI_PROVINCES.filter((province) => province === form.province || !usedProvinces.has(province));
    }
    return THAI_PROVINCES.filter((province) => !usedProvinces.has(province));
  }, [form.id, form.province, usedProvinces]);
  const pagination = useTablePagination(rows, 10);

  const loadSites = useCallback(async () => {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("sites")
      .select("id,code,name")
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

  const loadRates = useCallback(async (targetSiteId: string) => {
    if (!supabase || !targetSiteId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const { data, error: fetchError } = await supabase
      .from("site_shipping_provinces")
      .select("id,site_id,province,shipping_fee,active,updated_at")
      .eq("site_id", targetSiteId)
      .order("province", { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setRows((data ?? []) as ShippingRateRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  useEffect(() => {
    if (!siteId) return;
    setForm(EMPTY_FORM);
    void loadRates(siteId);
  }, [siteId, loadRates]);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function editRow(row: ShippingRateRow) {
    setForm({
      id: row.id,
      province: row.province,
      shipping_fee: row.shipping_fee.toString(),
      active: row.active
    });
    setSuccess(null);
    setError(null);
  }

  async function saveRate() {
    if (!supabase || !siteId) return;
    if (!form.province) {
      setError("กรุณาเลือกจังหวัด");
      return;
    }
    if (!THAI_PROVINCES.includes(form.province as (typeof THAI_PROVINCES)[number])) {
      setError("จังหวัดไม่ถูกต้อง กรุณาเลือกจากรายการ");
      return;
    }
    const fee = Number(form.shipping_fee);
    if (!Number.isFinite(fee) || fee < 0) {
      setError("กรุณากรอกค่าจัดส่งเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    if (form.id) {
      const { error: updateError } = await supabase
        .from("site_shipping_provinces")
        .update({
          shipping_fee: fee,
          active: form.active,
          updated_at: new Date().toISOString()
        })
        .eq("id", form.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(`อัปเดตค่าจัดส่งจังหวัด ${form.province} เรียบร้อย`);
        resetForm();
        await loadRates(siteId);
      }
    } else {
      const { error: upsertError } = await supabase.from("site_shipping_provinces").upsert(
        {
          site_id: siteId,
          province: form.province,
          shipping_fee: fee,
          active: form.active,
          updated_at: new Date().toISOString()
        },
        { onConflict: "site_id,province" }
      );
      if (upsertError) {
        setError(upsertError.message);
      } else {
        setSuccess(`บันทึกค่าจัดส่งจังหวัด ${form.province} เรียบร้อย`);
        resetForm();
        await loadRates(siteId);
      }
    }
    setSaving(false);
  }

  async function deleteRate(row: ShippingRateRow) {
    if (!supabase || !siteId) return;
    if (!confirm(`ลบค่าจัดส่งจังหวัด ${row.province} ใช่หรือไม่`)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error: deleteError } = await supabase
      .from("site_shipping_provinces")
      .delete()
      .eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess(`ลบจังหวัด ${row.province} เรียบร้อย`);
      if (form.id === row.id) resetForm();
      await loadRates(siteId);
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
        <button className="btn btn-ghost" onClick={() => siteId && void loadRates(siteId)} disabled={!siteId || loading}>
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
              <span className="card-title">
                ตั้งค่าค่าจัดส่งรายจังหวัด {selectedSite ? `(${selectedSite.name})` : ""}
              </span>
            </div>
            <div className="card-body">
              <div className="modal-grid">
                <label>
                  <span className="auth-label">จังหวัด</span>
                  <input
                    className="auth-input"
                    list="thai-provinces"
                    value={form.province}
                    onChange={(event) => setForm((prev) => ({ ...prev, province: event.target.value }))}
                    disabled={!siteId || Boolean(form.id)}
                    placeholder="พิมพ์ค้นหาจังหวัด เช่น กรุงเทพ"
                  />
                  <datalist id="thai-provinces">
                    {provinceOptions.map((province) => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </datalist>
                </label>
                <label>
                  <span className="auth-label">ค่าจัดส่ง (บาท)</span>
                  <input
                    className="auth-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.shipping_fee}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, shipping_fee: event.target.value }))
                    }
                    placeholder="เช่น 120"
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
                  <span className="auth-label" style={{ margin: 0 }}>เปิดใช้งานจังหวัดนี้</span>
                </label>
              </div>
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-ghost" onClick={resetForm} disabled={saving}>
                  ล้างฟอร์ม
                </button>
                <button className="btn btn-primary" onClick={() => void saveRate()} disabled={!siteId || saving}>
                  {saving ? "กำลังบันทึก..." : form.id ? "อัปเดตค่าจัดส่ง" : "เพิ่มค่าจัดส่ง"}
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>จังหวัด</th>
                    <th>ค่าจัดส่ง</th>
                    <th>สถานะ</th>
                    <th>แก้ไขล่าสุด</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.paginatedRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.province}</td>
                      <td className="mono">฿{Number(row.shipping_fee).toLocaleString("th-TH")}</td>
                      <td>
                        <span className={`badge ${row.active ? "paid" : "pending"}`}>
                          {row.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                        </span>
                      </td>
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
                          onClick={() => void deleteRate(row)}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && !loading && (
                    <tr>
                      <td colSpan={5} style={{ color: "var(--text3)", padding: 16 }}>
                        ยังไม่ได้ตั้งค่าจังหวัดสำหรับจัดส่ง
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
