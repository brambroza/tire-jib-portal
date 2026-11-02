"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

type ChecklistRow = {
  id: string;
  title: string;
  section_name: string | null;
  response_mode: "pass_fail" | "low_normal_high" | "normal_leak_damaged" | "custom" | "text_only";
  response_options: string[];
  unit_label: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

type FormState = {
  id: string;
  section_name: string;
  title: string;
  response_mode: ChecklistRow["response_mode"];
  custom_options_text: string;
  unit_label: string;
  sort_order: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  id: "",
  section_name: "",
  title: "",
  response_mode: "pass_fail",
  custom_options_text: "",
  unit_label: "",
  sort_order: "0",
  active: true
};

function presetOptions(mode: ChecklistRow["response_mode"]) {
  if (mode === "pass_fail") return ["ปกติ", "ไม่ปกติ"];
  if (mode === "low_normal_high") return ["ต่ำ", "ปกติ", "เกิน"];
  if (mode === "normal_leak_damaged") return ["ปกติ", "รั่ว", "ฉีกขาด"];
  if (mode === "text_only") return [];
  return [];
}

function parseCustomOptions(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function InstallChecklistPage() {
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const hasSupabase = useMemo(() => Boolean(supabase), []);

  useEffect(() => {
    void loadChecklist();
  }, []);

  async function loadChecklist() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    const query = supabase
      .from("install_checklist_items")
      .select("id,title,active,sort_order,created_at,section_name,response_mode,response_options,unit_label")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const { data, error: fetchError } = await query;

    if (fetchError) {
      const fallback = await supabase
        .from("install_checklist_items")
        .select("id,title,active,sort_order,created_at")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (fallback.error) {
        setError(fallback.error.message);
      } else {
        const mapped = (fallback.data ?? []).map((row: any) => ({
          ...row,
          section_name: null,
          response_mode: "pass_fail" as const,
          response_options: ["ปกติ", "ไม่ปกติ"],
          unit_label: null
        }));
        setRows(mapped as ChecklistRow[]);
      }
    } else {
      const mapped = (data ?? []).map((row: any) => ({
        ...row,
        response_mode: (row.response_mode ?? "pass_fail") as ChecklistRow["response_mode"],
        response_options: Array.isArray(row.response_options)
          ? row.response_options.filter((v: unknown) => typeof v === "string")
          : presetOptions((row.response_mode ?? "pass_fail") as ChecklistRow["response_mode"])
      }));
      setRows(mapped as ChecklistRow[]);
    }
    setLoading(false);
  }

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      const hay = [row.title, row.section_name ?? "", ...(row.response_options ?? [])].join(" ").toLowerCase();
      return hay.includes(keyword);
    });
  }, [rows, search]);
  const pagination = useTablePagination(filteredRows, 10);

  function openModal(row?: ChecklistRow) {
    if (row) {
      setForm({
        id: row.id,
        section_name: row.section_name ?? "",
        title: row.title,
        response_mode: row.response_mode,
        custom_options_text:
          row.response_mode === "custom" ? (row.response_options ?? []).join("\n") : "",
        unit_label: row.unit_label ?? "",
        sort_order: String(row.sort_order ?? 0),
        active: row.active
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setModalOpen(true);
  }

  async function handleSave() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!form.title.trim()) {
      setError("กรุณากรอกชื่อรายการ checklist");
      return;
    }
    const nextSortOrder = Number(form.sort_order);
    if (!Number.isFinite(nextSortOrder)) {
      setError("ลำดับไม่ถูกต้อง");
      return;
    }

    const responseOptions =
      form.response_mode === "custom"
        ? parseCustomOptions(form.custom_options_text)
        : presetOptions(form.response_mode);

    if (form.response_mode === "custom" && responseOptions.length < 2) {
      setError("โหมดกำหนดเองต้องมีตัวเลือกอย่างน้อย 2 รายการ");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload = {
      section_name: form.section_name.trim() || null,
      title: form.title.trim(),
      response_mode: form.response_mode,
      response_options: responseOptions,
      unit_label: form.unit_label.trim() || null,
      sort_order: nextSortOrder,
      active: form.active,
      updated_at: new Date().toISOString()
    };

    if (form.id) {
      const { error: updateError } = await supabase
        .from("install_checklist_items")
        .update(payload)
        .eq("id", form.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess("อัปเดตรายการ checklist เรียบร้อย");
        setModalOpen(false);
        await loadChecklist();
      }
    } else {
      const { error: insertError } = await supabase
        .from("install_checklist_items")
        .insert(payload);
      if (insertError) {
        setError(insertError.message);
      } else {
        setSuccess("เพิ่มรายการ checklist เรียบร้อย");
        setModalOpen(false);
        await loadChecklist();
      }
    }
    setLoading(false);
  }

  async function handleDelete(row: ChecklistRow) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!confirm(`ลบ checklist: ${row.title} ใช่หรือไม่`)) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const { error: deleteError } = await supabase
      .from("install_checklist_items")
      .delete()
      .eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("ลบรายการ checklist เรียบร้อย");
      await loadChecklist();
    }
    setLoading(false);
  }

  return (
    <div className="page active">
      <div className="toolbar" style={{ marginBottom: 18 }}>
        <div className="search-bar" style={{ width: 300 }}>
          <input
            placeholder="ค้นหา checklist/หมวด/..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => openModal()}>
          เพิ่ม Checklist
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
                <th>หมวด</th>
                <th>รายการ</th>
                <th>รูปแบบคำตอบ</th>
                <th>ตัวเลือก</th>
                <th>ลำดับ</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedRows.map((row) => (
                <tr key={row.id}>
                  <td style={{ color: "var(--text2)", fontSize: 12 }}>{row.section_name || "-"}</td>
                  <td>{row.title}</td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{row.response_mode}</td>
                  <td style={{ fontSize: 12, color: "var(--text3)" }}>
                    {row.response_options?.length ? row.response_options.join(" / ") : "กรอกค่าอิสระ"}
                  </td>
                  <td className="mono">{row.sort_order}</td>
                  <td>
                    <span className={`badge ${row.active ? "paid" : "pending"}`}>
                      {row.active ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => openModal(row)}
                    >
                      แก้ไข
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                      onClick={() => handleDelete(row)}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredRows.length && !loading && (
                <tr>
                  <td colSpan={7} style={{ color: "var(--text3)", padding: 16 }}>
                    ยังไม่มีรายการ checklist
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

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 760 }}>
            <div className="modal-head">
              <div>
                <div className="modal-title">{form.id ? "แก้ไข Checklist" : "เพิ่ม Checklist"}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                  กำหนดแม่แบบตรวจเช็คให้รองรับงานหน้างานแบบฟอร์มจริง
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 14,
                  background: "var(--bg3)"
                }}
              >
                <div className="modal-grid">
                  <label>
                    <span className="auth-label">หมวด</span>
                    <input
                      className="auth-input"
                      value={form.section_name}
                      onChange={(event) => setForm((prev) => ({ ...prev, section_name: event.target.value }))}
                      placeholder="เช่น ระดับสารหล่อลื่น, ไฟสัญญาณ, ช่วงล่าง/โช๊ค"
                    />
                  </label>
                  <label>
                    <span className="auth-label">รายการ checklist</span>
                    <input
                      className="auth-input"
                      value={form.title}
                      onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="เช่น น้ำมันเครื่อง, ไฟเลี้ยวหน้าซ้าย"
                    />
                  </label>
                  <label>
                    <span className="auth-label">รูปแบบคำตอบ</span>
                    <select
                      className="filter-select"
                      value={form.response_mode}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, response_mode: event.target.value as FormState["response_mode"] }))
                      }
                    >
                      <option value="pass_fail">ปกติ / ไม่ปกติ</option>
                      <option value="low_normal_high">ต่ำ / ปกติ / เกิน</option>
                      <option value="normal_leak_damaged">ปกติ / รั่ว / ฉีกขาด</option>
                      <option value="custom">กำหนดตัวเลือกเอง</option>
                      <option value="text_only">กรอกค่าอิสระ</option>
                    </select>
                  </label>
                  <label>
                    <span className="auth-label">หน่วย (ถ้ามี)</span>
                    <input
                      className="auth-input"
                      value={form.unit_label}
                      onChange={(event) => setForm((prev) => ({ ...prev, unit_label: event.target.value }))}
                      placeholder="เช่น PSI, Volt, mm"
                    />
                  </label>
                  <label>
                    <span className="auth-label">ลำดับแสดงผล</span>
                    <input
                      className="auth-input"
                      type="number"
                      min={0}
                      step={1}
                      value={form.sort_order}
                      onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
                      placeholder="เช่น 10"
                    />
                  </label>
                </div>

                {form.response_mode === "custom" && (
                  <label style={{ display: "block", marginTop: 12 }}>
                    <span className="auth-label">ตัวเลือกกำหนดเอง (1 บรรทัดต่อ 1 ตัวเลือก)</span>
                    <textarea
                      className="auth-input"
                      rows={4}
                      value={form.custom_options_text}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, custom_options_text: event.target.value }))
                      }
                      placeholder={"เช่น\nปกติ\nต้องเติม\nวิกฤต"}
                    />
                  </label>
                )}

                <label
                  style={{
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "var(--bg2)"
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--text2)" }}>เปิดใช้งานรายการนี้</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className={`badge ${form.active ? "paid" : "pending"}`}>
                      {form.active ? "ใช้งาน" : "ปิด"}
                    </span>
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                      style={{ width: 16 }}
                    />
                  </div>
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ยกเลิก
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!hasSupabase || loading}>
                {loading ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
