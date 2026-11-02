"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

type SiteRow = { id: string; code: string; name: string };

type PromotionImageRow = {
  id: string;
  image_url: string;
  sort_order: number | null;
};

type PromotionRow = {
  id: string;
  title: string;
  message: string;
  site_id: string | null;
  start_at: string | null;
  end_at: string | null;
  active: boolean;
  is_banner: boolean;
  priority: number;
  created_at: string;
  updated_at: string | null;
  sites?: { name: string | null } | null;
  promotion_images?: PromotionImageRow[] | null;
};

type PromotionFormErrors = Partial<
  Record<"title" | "message" | "priority" | "start_at" | "end_at", string>
>;

const EMPTY_FORM = {
  id: "" as string,
  title: "",
  message: "",
  site_id: "",
  start_at: "",
  end_at: "",
  active: true,
  is_banner: false,
  priority: "0"
};

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formImages, setFormImages] = useState<PromotionImageRow[]>([]);
  const [pendingImages, setPendingImages] = useState<{ key: string; file: File; preview: string }[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [deletedImageUrls, setDeletedImageUrls] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [formErrors, setFormErrors] = useState<PromotionFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasSupabase = useMemo(() => Boolean(supabase), []);

  function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "object" && error !== null && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
    return fallback;
  }

  useEffect(() => {
    void loadSites();
    void loadPromotions();
  }, []);

  useEffect(() => {
    return () => {
      pendingImages.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, [pendingImages]);

  async function loadSites() {
    if (!supabase) return;
    const { data } = await supabase.from("sites").select("id,code,name").order("name");
    if (data) setSites(data as SiteRow[]);
  }

  async function loadPromotions() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    const { data, error: fetchError } = await supabase
      .from("promotions")
      .select(
        "id,title,message,site_id,start_at,end_at,active,is_banner,priority,created_at,updated_at,sites(name),promotion_images(id,image_url,sort_order)"
      )
      .order("priority", { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      const rows = (data ?? []) as unknown as PromotionRow[];
      const normalized = rows.map((row) => ({
        ...row,
        promotion_images: [...(row.promotion_images ?? [])].sort(
          (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
        )
      }));
      setPromotions(normalized);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return promotions;
    const keyword = search.toLowerCase();
    return promotions.filter((promo) =>
      [promo.title, promo.message, promo.sites?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [promotions, search]);
  const pagination = useTablePagination(filtered, 10);

  function openModal(row?: PromotionRow) {
    pendingImages.forEach((item) => URL.revokeObjectURL(item.preview));
    setPendingImages([]);
    setDeletedImageIds([]);
    setDeletedImageUrls([]);
    setFormErrors({});
    if (row) {
      setForm({
        id: row.id,
        title: row.title,
        message: row.message,
        site_id: row.site_id ?? "",
        start_at: row.start_at ? row.start_at.slice(0, 16) : "",
        end_at: row.end_at ? row.end_at.slice(0, 16) : "",
        active: row.active,
        is_banner: row.is_banner,
        priority: String(row.priority ?? 0)
      });
      setFormImages([...(row.promotion_images ?? [])]);
    } else {
      setForm(EMPTY_FORM);
      setFormImages([]);
    }
    setModalOpen(true);
  }

  function clearFieldError(field: keyof PromotionFormErrors) {
    setFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validateForm() {
    const nextErrors: PromotionFormErrors = {};
    if (!form.title.trim()) nextErrors.title = "กรุณากรอกหัวข้อโปรโมชัน";
    if (!form.message.trim()) nextErrors.message = "กรุณากรอกรายละเอียด/ราคา";

    const priorityValue = Number(form.priority);
    if (!form.priority.trim()) nextErrors.priority = "กรุณากรอกลำดับความสำคัญ";
    else if (!Number.isFinite(priorityValue) || priorityValue < 0) {
      nextErrors.priority = "ลำดับความสำคัญต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป";
    }

    if (form.start_at && form.end_at) {
      const startDate = new Date(form.start_at);
      const endDate = new Date(form.end_at);
      if (startDate.getTime() > endDate.getTime()) {
        nextErrors.end_at = "เวลาจบต้องมากกว่าหรือเท่ากับเวลาเริ่ม";
      }
    }

    return nextErrors;
  }

  function getPromotionStoragePath(url: string) {
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/promotions/`;
    if (url.startsWith(base)) return url.slice(base.length);
    return null;
  }

  async function removePromotionStorageFiles(paths: string[]) {
    if (paths.length === 0) return;
    const response = await fetch("/api/promotions/storage/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths })
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error || "ลบไฟล์รูปโปรโมชันไม่สำเร็จ");
    }
  }

  function appendModalImages(files: File[]) {
    if (!files.length) return;
    setPendingImages((prev) => {
      const existing = new Set(prev.map((item) => item.key));
      const next = [...prev];
      files.forEach((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (existing.has(key)) return;
        next.push({ key, file, preview: URL.createObjectURL(file) });
        existing.add(key);
      });
      return next;
    });
  }

  function removePendingImage(key: string) {
    setPendingImages((prev) => {
      const target = prev.find((item) => item.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((item) => item.key !== key);
    });
  }

  function removeExistingImage(image: PromotionImageRow) {
    setFormImages((prev) => prev.filter((item) => item.id !== image.id));
    setDeletedImageIds((prev) => [...prev, image.id]);
    setDeletedImageUrls((prev) => [...prev, image.image_url]);
  }

  async function uploadPromotionImages(promotionId: string, files: File[], startOrder: number) {
    if (!supabase || files.length === 0) return [] as { image_url: string; sort_order: number }[];
    setUploadingImages(true);
    const rows: { image_url: string; sort_order: number }[] = [];
    try {
      for (let idx = 0; idx < files.length; idx += 1) {
        const file = files[idx];
        const formData = new FormData();
        formData.append("promotion_id", promotionId);
        formData.append("image", file);
        const response = await fetch("/api/promotions/storage/upload", {
          method: "POST",
          body: formData
        });
        const payload = (await response.json()) as { error?: string; image_url?: string };
        if (!response.ok) {
          throw new Error(payload.error || "อัปโหลดรูปโปรโมชันไม่สำเร็จ");
        }
        if (payload.image_url) rows.push({ image_url: payload.image_url, sort_order: startOrder + idx });
      }
    } finally {
      setUploadingImages(false);
    }
    return rows;
  }

  async function handleSave() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      setError(null);
      return;
    }
    setFormErrors({});
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        site_id: form.site_id || null,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        active: form.active,
        is_banner: form.is_banner,
        priority: Number(form.priority || 0),
        updated_at: new Date().toISOString()
      };

      if (form.id) {
        const { error: updateError } = await supabase
          .from("promotions")
          .update(payload)
          .eq("id", form.id);
        if (updateError) throw new Error(updateError.message);

        if (deletedImageIds.length > 0) {
          const { error: deleteImageError } = await supabase
            .from("promotion_images")
            .delete()
            .in("id", deletedImageIds);
          if (deleteImageError) throw new Error(deleteImageError.message);
          const storagePaths = deletedImageUrls
            .map((url) => getPromotionStoragePath(url))
            .filter((path): path is string => Boolean(path));
          if (storagePaths.length) {
            await removePromotionStorageFiles(storagePaths);
          }
        }
        if (pendingImages.length > 0) {
          const nextRows = await uploadPromotionImages(
            form.id,
            pendingImages.map((item) => item.file),
            formImages.length
          );
          if (nextRows.length) {
            const { error: insertImageError } = await supabase
              .from("promotion_images")
              .insert(nextRows.map((item) => ({ promotion_id: form.id, ...item })));
            if (insertImageError) throw new Error(insertImageError.message);
          }
        }
        setSuccess("อัปเดตโปรโมชันเรียบร้อย");
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("promotions")
          .insert(payload)
          .select("id")
          .single();
        if (insertError || !inserted?.id) {
          throw new Error(insertError?.message ?? "เพิ่มโปรโมชันไม่สำเร็จ");
        }
        if (pendingImages.length > 0) {
          const nextRows = await uploadPromotionImages(
            inserted.id,
            pendingImages.map((item) => item.file),
            0
          );
          if (nextRows.length) {
            const { error: insertImageError } = await supabase
              .from("promotion_images")
              .insert(nextRows.map((item) => ({ promotion_id: inserted.id, ...item })));
            if (insertImageError) throw new Error(insertImageError.message);
          }
        }
        setSuccess("เพิ่มโปรโมชันเรียบร้อย");
      }

      setModalOpen(false);
      await loadPromotions();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "บันทึกโปรโมชันไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(row: PromotionRow) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!confirm(`ลบโปรโมชัน ${row.title} ใช่หรือไม่`)) return;
    setLoading(true);
    setError(null);
    const storagePaths = (row.promotion_images ?? [])
      .map((image) => getPromotionStoragePath(image.image_url))
      .filter((path): path is string => Boolean(path));
    const { error: deleteError } = await supabase.from("promotions").delete().eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      if (storagePaths.length) {
        try {
          await removePromotionStorageFiles(storagePaths);
        } catch (removeError) {
          setError(getErrorMessage(removeError, "ลบไฟล์รูปโปรโมชันไม่สำเร็จ"));
          setLoading(false);
          return;
        }
      }
      setSuccess("ลบโปรโมชันเรียบร้อย");
      await loadPromotions();
    }
    setLoading(false);
  }

  return (
    <div className="page active">
      <div className="toolbar" style={{ marginBottom: 18 }}>
        <div className="search-bar" style={{ width: 260 }}>
          <input
            placeholder="ค้นหาโปรโมชัน..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => openModal()}>
          เพิ่มโปรโมชัน
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
                <th>หัวข้อ</th>
                <th>รายละเอียด</th>
                <th>รูป</th>
                <th>ไซต์</th>
                <th>ช่วงเวลา</th>
                <th>ลำดับ</th>
                <th>header</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedRows.map((promo) => (
                <tr key={promo.id}>
                  <td>{promo.title}</td>
                  <td style={{ color: "var(--text2)" }}>{promo.message}</td>
                  <td>
                    {promo.promotion_images?.[0]?.image_url ? (
                      <img
                        src={promo.promotion_images[0].image_url}
                        alt={promo.title}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 8,
                          objectFit: "cover",
                          border: "1px solid var(--border)"
                        }}
                      />
                    ) : (
                      <span style={{ color: "var(--text3)", fontSize: 12 }}>ไม่มีรูป</span>
                    )}
                  </td>
                  <td>{promo.sites?.name ?? "ทุกไซต์"}</td>
                  <td style={{ color: "var(--text3)", fontSize: 12 }}>
                    {(promo.start_at
                      ? new Date(promo.start_at).toLocaleDateString("th-TH")
                      : "เริ่มทันที") +
                      " - " +
                      (promo.end_at ? new Date(promo.end_at).toLocaleDateString("th-TH") : "ไม่สิ้นสุด")}
                  </td>
                  <td className="mono">{promo.priority}</td>
                  <td>
                    <span className={`badge ${promo.is_banner ? "paid" : "pending"}`}>
                      {promo.is_banner ? "ใช่" : "ไม่"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${promo.active ? "paid" : "pending"}`}>
                      {promo.active ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td style={{ gap: 6 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => openModal(promo)}
                    >
                      แก้ไข
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                      onClick={() => handleDelete(promo)}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && !loading && (
                <tr>
                  <td colSpan={9} style={{ color: "var(--text3)", padding: 16 }}>
                    ยังไม่มีโปรโมชัน
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
          <div className="modal-card" style={{ maxWidth: 880 }}>
            <div className="modal-head">
              <div>
                <div className="modal-title">{form.id ? "แก้ไขโปรโมชัน" : "เพิ่มโปรโมชัน"}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                  จัดการรายละเอียดและรูปภาพแบนเนอร์โปรโมชัน
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
                  background: "var(--bg3)",
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 12
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 10 }}>ข้อมูลโปรโมชัน</div>
                <div className="modal-grid">
                  <label>
                    <span className="auth-label">หัวข้อโปรโมชัน</span>
                    <input
                      className="auth-input"
                      value={form.title}
                      onChange={(event) => {
                        clearFieldError("title");
                        setForm((prev) => ({ ...prev, title: event.target.value }));
                      }}
                      placeholder="เช่น Dunlop LM705 195/55R15"
                    />
                    {formErrors.title && (
                      <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                        {formErrors.title}
                      </div>
                    )}
                  </label>
                  <label>
                    <span className="auth-label">รายละเอียด/ราคา</span>
                    <input
                      className="auth-input"
                      value={form.message}
                      onChange={(event) => {
                        clearFieldError("message");
                        setForm((prev) => ({ ...prev, message: event.target.value }));
                      }}
                      placeholder="เช่น ฿1,400/เส้น"
                    />
                    {formErrors.message && (
                      <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                        {formErrors.message}
                      </div>
                    )}
                  </label>
                  <label>
                    <span className="auth-label">ไซต์</span>
                    <select
                      className="filter-select"
                      value={form.site_id}
                      onChange={(event) => setForm((prev) => ({ ...prev, site_id: event.target.value }))}
                    >
                      <option value="">ทุกไซต์</option>
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="auth-label">เวลาเริ่ม</span>
                    <input
                      className="auth-input"
                      type="datetime-local"
                      value={form.start_at}
                      onChange={(event) => {
                        clearFieldError("start_at");
                        clearFieldError("end_at");
                        setForm((prev) => ({ ...prev, start_at: event.target.value }));
                      }}
                    />
                    {formErrors.start_at && (
                      <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                        {formErrors.start_at}
                      </div>
                    )}
                  </label>
                  <label>
                    <span className="auth-label">เวลาจบ</span>
                    <input
                      className="auth-input"
                      type="datetime-local"
                      value={form.end_at}
                      onChange={(event) => {
                        clearFieldError("end_at");
                        setForm((prev) => ({ ...prev, end_at: event.target.value }));
                      }}
                    />
                    {formErrors.end_at && (
                      <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                        {formErrors.end_at}
                      </div>
                    )}
                  </label>
                  <label>
                    <span className="auth-label">ลำดับความสำคัญ</span>
                    <input
                      className="auth-input"
                      type="number"
                      min={0}
                      value={form.priority}
                      onChange={(event) => {
                        clearFieldError("priority");
                        setForm((prev) => ({ ...prev, priority: event.target.value }));
                      }}
                    />
                    {formErrors.priority && (
                      <div style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
                        {formErrors.priority}
                      </div>
                    )}
                  </label>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 24 }}>
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                      style={{ width: 16 }}
                    />
                    <span className="auth-label" style={{ margin: 0 }}>เปิดใช้งาน</span>
                  </label>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 24 }}>
                    <input
                      type="checkbox"
                      checked={form.is_banner}
                      onChange={(event) => setForm((prev) => ({ ...prev, is_banner: event.target.checked }))}
                      style={{ width: 16 }}
                    />
                    <span className="auth-label" style={{ margin: 0 }}>แสดงเป็น header</span>
                  </label>
                </div>
              </div>

              <div
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--bg3)",
                  borderRadius: 10,
                  padding: 14
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8
                  }}
                >
                  <div style={{ fontWeight: 600 }}>สื่อโปรโมชัน</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>
                    ทั้งหมด {formImages.length + pendingImages.length} รูป
                  </div>
                </div>
                <label className="auth-label">รูปโปรโมชัน (อัปโหลดได้หลายรูป)</label>
                <div className="dropzone" style={{ marginTop: 6 }}>
                  <div>ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                      appendModalImages(Array.from(event.target.files ?? []));
                      event.currentTarget.value = "";
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8, marginTop: 10 }}>
                  รูปปัจจุบัน
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                    gap: 10
                  }}
                >
                  {formImages.map((image) => (
                    <div key={image.id} style={{ position: "relative" }}>
                      <img
                        src={image.image_url}
                        alt={`promotion-${image.id}`}
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid var(--border)"
                        }}
                      />
                      <button
                        className="btn btn-ghost"
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          padding: "2px 6px",
                          fontSize: 11,
                          background: "rgba(0,0,0,0.45)",
                          color: "#fff"
                        }}
                        onClick={() => removeExistingImage(image)}
                      >
                        ลบ
                      </button>
                    </div>
                  ))}
                  {pendingImages.map((item) => (
                    <div key={item.key} style={{ position: "relative" }}>
                      <img
                        src={item.preview}
                        alt={item.file.name}
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid var(--border)"
                        }}
                      />
                      <button
                        className="btn btn-ghost"
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          padding: "2px 6px",
                          fontSize: 11,
                          background: "rgba(0,0,0,0.45)",
                          color: "#fff"
                        }}
                        onClick={() => removePendingImage(item.key)}
                      >
                        ลบ
                      </button>
                    </div>
                  ))}
                  {formImages.length === 0 && pendingImages.length === 0 && (
                    <span style={{ color: "var(--text3)", fontSize: 12 }}>ยังไม่มีรูปโปรโมชัน</span>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ยกเลิก
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!hasSupabase || loading || uploadingImages}
              >
                {uploadingImages ? "กำลังอัปโหลดรูป..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
