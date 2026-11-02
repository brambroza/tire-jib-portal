"use client";

import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

type SiteRow = {
  id: string;
  name: string;
};

type HeroSectionRow = {
  id: string;
  site_id: string;
  eyebrow: string | null;
  title_line_1: string | null;
  title_line_2: string | null;
  title_line_3: string | null;
  subtitle: string | null;
  subtitle_highlight: string | null;
  left_bg_image_url: string | null;
  right_bg_image_url: string | null;
  badges: unknown;
  ctas: unknown;
  active: boolean;
};

type HeroAdRow = {
  id: string;
  site_id: string;
  title: string;
  title_2: string | null;
  title_3: string | null;
  title_4: string | null;
  title_5: string | null;
  message: string | null;
  tag: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  sort_order: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

const EMPTY_SECTION_FORM = {
  id: "",
  eyebrow: "",
  title_line_1: "",
  title_line_2: "",
  title_line_3: "",
  subtitle: "",
  subtitle_highlight: "",
  left_bg_image_url: "",
  right_bg_image_url: "",
  badges_json: "[]",
  ctas_json: "[]",
  active: true,
};

const EMPTY_AD_FORM = {
  id: "",
  title: "",
  title_2: "",
  title_3: "",
  title_4: "",
  title_5: "",
  message: "",
  tag: "",
  image_url: "",
  cta_label: "",
  cta_href: "",
  sort_order: "100",
  starts_at: "",
  ends_at: "",
  active: true,
};

const ACCEPTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function stringifyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? [], null, 2);
  } catch {
    return "[]";
  }
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseDateTimeLocal(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeNullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function HeroContentPage() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [siteId, setSiteId] = useState("");
  const [sectionForm, setSectionForm] = useState(EMPTY_SECTION_FORM);
  const [ads, setAds] = useState<HeroAdRow[]>([]);
  const [adForm, setAdForm] = useState(EMPTY_AD_FORM);
  const [loading, setLoading] = useState(false);
  const [savingSection, setSavingSection] = useState(false);
  const [savingAd, setSavingAd] = useState(false);
  const [uploadingLeftBg, setUploadingLeftBg] = useState(false);
  const [uploadingRightBg, setUploadingRightBg] = useState(false);
  const [uploadingAdImage, setUploadingAdImage] = useState(false);
  const [draggingZone, setDraggingZone] = useState<"left" | "right" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adImagePreviewError, setAdImagePreviewError] = useState(false);

  const leftFileInputRef = useRef<HTMLInputElement | null>(null);
  const rightFileInputRef = useRef<HTMLInputElement | null>(null);
  const adFileInputRef = useRef<HTMLInputElement | null>(null);

  const hasSupabase = useMemo(() => Boolean(supabase), []);
  const adPagination = useTablePagination(ads, 10);

  function toHeroPublicUrl(value: string | null | undefined) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (!supabase) return raw;
    const { data } = supabase.storage.from("hero").getPublicUrl(raw.replace(/^\/+/, ""));
    return data.publicUrl || raw;
  }

  function getHeroStoragePath(url: string) {
    if (!supabase) return null;
    const probe = supabase.storage.from("hero").getPublicUrl("__probe__").data.publicUrl;
    const base = probe.replace("__probe__", "");
    if (url.startsWith(base)) return url.slice(base.length);
    return null;
  }

  function validateHeroImage(file: File) {
    if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type)) {
      return "รองรับเฉพาะไฟล์ PNG, JPG, WEBP, AVIF";
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return "ขนาดไฟล์ต้องไม่เกิน 10MB";
    }
    return null;
  }

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
    if (nextSites.length && !siteId) setSiteId(nextSites[0].id);
  }, [siteId]);

  const loadHeroContent = useCallback(async (targetSiteId: string) => {
    if (!supabase || !targetSiteId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const [{ data: sectionData, error: sectionError }, { data: adData, error: adError }] = await Promise.all([
      supabase
        .from("site_hero_sections")
        .select(
          "id,site_id,eyebrow,title_line_1,title_line_2,title_line_3,subtitle,subtitle_highlight,left_bg_image_url,right_bg_image_url,badges,ctas,active"
        )
        .eq("site_id", targetSiteId)
        .maybeSingle(),
      supabase
        .from("site_hero_ads")
        .select("id,site_id,title,title_2,title_3,title_4,title_5,message,tag,image_url,cta_label,cta_href,sort_order,active,starts_at,ends_at,created_at,updated_at")
        .eq("site_id", targetSiteId)
        .order("sort_order", { ascending: true }),
    ]);

    if (sectionError) {
      setError(sectionError.message);
      setLoading(false);
      return;
    }
    if (adError) {
      setError(adError.message);
      setLoading(false);
      return;
    }

    const section = (sectionData ?? null) as HeroSectionRow | null;
    setSectionForm({
      id: section?.id ?? "",
      eyebrow: section?.eyebrow ?? "",
      title_line_1: section?.title_line_1 ?? "",
      title_line_2: section?.title_line_2 ?? "",
      title_line_3: section?.title_line_3 ?? "",
      subtitle: section?.subtitle ?? "",
      subtitle_highlight: section?.subtitle_highlight ?? "",
      left_bg_image_url: toHeroPublicUrl(section?.left_bg_image_url),
      right_bg_image_url: toHeroPublicUrl(section?.right_bg_image_url),
      badges_json: stringifyJson(section?.badges ?? []),
      ctas_json: stringifyJson(section?.ctas ?? []),
      active: section?.active ?? true,
    });

    setAds(
      ((adData ?? []) as HeroAdRow[]).map((row) => ({
        ...row,
        image_url: toHeroPublicUrl(row.image_url),
      }))
    );
    setAdForm(EMPTY_AD_FORM);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  useEffect(() => {
    if (!siteId) return;
    void loadHeroContent(siteId);
  }, [siteId, loadHeroContent]);

  useEffect(() => {
    setAdImagePreviewError(false);
  }, [adForm.image_url]);

  async function uploadToHero(file: File) {
    if (!siteId) throw new Error("missing site_id");
    const payload = new FormData();
    payload.append("site_id", siteId);
    payload.append("image", file);
    const response = await fetch("/api/sites/hero-image/upload", { method: "POST", body: payload });
    const result = (await response.json()) as { image_url?: string; path?: string; error?: string };
    if (!response.ok || !result.image_url) throw new Error(result.error || "อัปโหลดรูปไม่สำเร็จ");
    return { publicUrl: result.image_url, path: result.path ?? "" };
  }

  async function removeStoragePath(path: string | null) {
    if (!path) return;
    await fetch("/api/sites/hero-image/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: [path] }),
    });
  }

  async function uploadHeroBackground(position: "left" | "right", file: File) {
    if (!supabase || !siteId) return;
    const validationError = validateHeroImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (position === "left") setUploadingLeftBg(true);
    if (position === "right") setUploadingRightBg(true);
    setError(null);
    setSuccess(null);

    try {
      const uploaded = await uploadToHero(file);
      const currentUrl = position === "left" ? sectionForm.left_bg_image_url : sectionForm.right_bg_image_url;
      const oldPath = currentUrl ? getHeroStoragePath(currentUrl) : null;
      if (oldPath && oldPath !== uploaded.path) await removeStoragePath(oldPath);

      setSectionForm((prev) => ({
        ...prev,
        left_bg_image_url: position === "left" ? uploaded.publicUrl : prev.left_bg_image_url,
        right_bg_image_url: position === "right" ? uploaded.publicUrl : prev.right_bg_image_url,
      }));
      setSuccess(`อัปโหลดรูปพื้นหลัง${position === "left" ? "ฝั่งซ้าย" : "ฝั่งขวา"}เรียบร้อย (อย่าลืมกดบันทึก)`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "อัปโหลดรูปพื้นหลังไม่สำเร็จ");
    } finally {
      if (position === "left") setUploadingLeftBg(false);
      if (position === "right") setUploadingRightBg(false);
    }
  }

  async function removeHeroBackground(position: "left" | "right") {
    const currentUrl = position === "left" ? sectionForm.left_bg_image_url : sectionForm.right_bg_image_url;
    if (!currentUrl) return;
    await removeStoragePath(getHeroStoragePath(currentUrl));
    setSectionForm((prev) => ({
      ...prev,
      left_bg_image_url: position === "left" ? "" : prev.left_bg_image_url,
      right_bg_image_url: position === "right" ? "" : prev.right_bg_image_url,
    }));
  }

  async function uploadAdImage(file: File) {
    if (!supabase || !siteId) return;
    const validationError = validateHeroImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setUploadingAdImage(true);
    setError(null);
    setSuccess(null);

    try {
      const uploaded = await uploadToHero(file);
      const oldPath = adForm.image_url ? getHeroStoragePath(adForm.image_url) : null;
      if (oldPath && oldPath !== uploaded.path) await removeStoragePath(oldPath);

      setAdForm((prev) => ({ ...prev, image_url: uploaded.publicUrl }));
      setAdImagePreviewError(false);

      if (adForm.id) {
        const { error: patchError } = await supabase
          .from("site_hero_ads")
          .update({ image_url: uploaded.publicUrl, updated_at: new Date().toISOString() })
          .eq("id", adForm.id);
        if (patchError) throw patchError;
      }

      setSuccess(adForm.id ? "อัปโหลดรูปและบันทึกลงตารางแล้ว" : "อัปโหลดรูปแล้ว");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "อัปโหลดรูป Ads ไม่สำเร็จ");
    } finally {
      setUploadingAdImage(false);
    }
  }

  async function removeAdImage() {
    const currentUrl = adForm.image_url.trim();
    if (!currentUrl) return;
    await removeStoragePath(getHeroStoragePath(currentUrl));
    setAdForm((prev) => ({ ...prev, image_url: "" }));
    setAdImagePreviewError(false);

    if (supabase && adForm.id) {
      await supabase
        .from("site_hero_ads")
        .update({ image_url: null, updated_at: new Date().toISOString() })
        .eq("id", adForm.id);
    }
  }

  function handleDropUpload(position: "left" | "right", event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (savingSection || uploadingLeftBg || uploadingRightBg) return;
    setDraggingZone(null);
    const file = event.dataTransfer.files?.[0] ?? null;
    if (file) void uploadHeroBackground(position, file);
  }

  function handleDragLeave(position: "left" | "right", event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    if (draggingZone === position) setDraggingZone(null);
  }

  async function saveSection() {
    if (!supabase || !siteId) return;

    let badgesParsed: unknown;
    let ctasParsed: unknown;

    try {
      badgesParsed = JSON.parse(sectionForm.badges_json || "[]");
      if (!Array.isArray(badgesParsed)) throw new Error();
    } catch {
      setError("รูปแบบ JSON ของ badges ไม่ถูกต้อง (ต้องเป็น array)");
      return;
    }

    try {
      ctasParsed = JSON.parse(sectionForm.ctas_json || "[]");
      if (!Array.isArray(ctasParsed)) throw new Error();
    } catch {
      setError("รูปแบบ JSON ของ ctas ไม่ถูกต้อง (ต้องเป็น array)");
      return;
    }

    setSavingSection(true);
    setError(null);
    setSuccess(null);

    const { error: upsertError } = await supabase.from("site_hero_sections").upsert(
      {
        site_id: siteId,
        eyebrow: normalizeNullableText(sectionForm.eyebrow),
        title_line_1: normalizeNullableText(sectionForm.title_line_1),
        title_line_2: normalizeNullableText(sectionForm.title_line_2),
        title_line_3: normalizeNullableText(sectionForm.title_line_3),
        subtitle: normalizeNullableText(sectionForm.subtitle),
        subtitle_highlight: normalizeNullableText(sectionForm.subtitle_highlight),
        left_bg_image_url: normalizeNullableText(sectionForm.left_bg_image_url),
        right_bg_image_url: normalizeNullableText(sectionForm.right_bg_image_url),
        badges: badgesParsed,
        ctas: ctasParsed,
        active: sectionForm.active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "site_id" }
    );

    if (upsertError) setError(upsertError.message);
    else {
      setSuccess("บันทึก Hero Section เรียบร้อย");
      await loadHeroContent(siteId);
    }

    setSavingSection(false);
  }

  function editAd(row: HeroAdRow) {
    setAdForm({
      id: row.id,
      title: row.title,
      title_2: row.title_2 ?? "",
      title_3: row.title_3 ?? "",
      title_4: row.title_4 ?? "",
      title_5: row.title_5 ?? "",
      message: row.message ?? "",
      tag: row.tag ?? "",
      image_url: row.image_url ?? "",
      cta_label: row.cta_label ?? "",
      cta_href: row.cta_href ?? "",
      sort_order: String(row.sort_order),
      starts_at: toDateTimeLocal(row.starts_at),
      ends_at: toDateTimeLocal(row.ends_at),
      active: row.active,
    });
    setAdImagePreviewError(false);
    setError(null);
    setSuccess(null);
  }

  function resetAdForm() {
    setAdForm(EMPTY_AD_FORM);
    setAdImagePreviewError(false);
  }

  async function saveAd() {
    if (!supabase || !siteId) return;

    if (!adForm.title.trim()) {
      setError("กรุณากรอกหัวข้อโฆษณา");
      return;
    }

    const sortOrder = Number(adForm.sort_order);
    if (!Number.isFinite(sortOrder)) {
      setError("ลำดับไม่ถูกต้อง");
      return;
    }

    const startsAt = parseDateTimeLocal(adForm.starts_at);
    const endsAt = parseDateTimeLocal(adForm.ends_at);
    if (adForm.starts_at && !startsAt) {
      setError("เวลาเริ่มต้นไม่ถูกต้อง");
      return;
    }
    if (adForm.ends_at && !endsAt) {
      setError("เวลาสิ้นสุดไม่ถูกต้อง");
      return;
    }
    if (startsAt && endsAt && new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
      setError("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น");
      return;
    }

    setSavingAd(true);
    setError(null);
    setSuccess(null);

  

    const payload = {
      title: adForm.title.trim(),
      title_2: normalizeNullableText(adForm.title_2),
      title_3: normalizeNullableText(adForm.title_3),
      title_4: normalizeNullableText(adForm.title_4),
      title_5: normalizeNullableText(adForm.title_5),
      message: normalizeNullableText(adForm.message),
      tag: normalizeNullableText(adForm.tag),
      image_url: normalizeNullableText(adForm.image_url),
      cta_label: normalizeNullableText(adForm.cta_label),
      cta_href: normalizeNullableText(adForm.cta_href),
      sort_order: sortOrder,
      starts_at: startsAt,
      ends_at: endsAt,
      active: adForm.active,
      updated_at: new Date().toISOString(),
    };

    if (adForm.id) {
      /*  const { error: updateError } = await supabase.from("site_hero_ads").update(payload).eq("id", adForm.id);
       if (updateError) setError(updateError.message);
       else {
         setSuccess("อัปเดต Hero Ads เรียบร้อย");
         resetAdForm();
         await loadHeroContent(siteId);
       } */

      const { data, error: updateError } = await supabase
        .from("site_hero_ads")
        .update(payload)
        .eq("id", adForm.id)
        .select("id,title,message,tag,image_url,cta_label,cta_href,sort_order,active,starts_at,ends_at,updated_at")
        .single();

      console.log("updated data", data);
      console.log("update error", updateError);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (!data) {
        setError("ไม่พบรายการที่อัปเดต หรือไม่มีสิทธิ์แก้ไขข้อมูล");
        return;
      }

      setSuccess("อัปเดต Hero Ads เรียบร้อย");
      resetAdForm();
      
      await loadHeroContent(siteId);

    } else {
      const { error: insertError } = await supabase.from("site_hero_ads").insert({ site_id: siteId, ...payload });
      if (insertError) setError(insertError.message);
      else {
        setSuccess("เพิ่ม Hero Ads เรียบร้อย");
        resetAdForm();
        await loadHeroContent(siteId);
      }
    }

    setSavingAd(false);
  }

  async function deleteAd(row: HeroAdRow) {
    if (!supabase || !siteId) return;
    if (!confirm(`ลบโฆษณา "${row.title}" ใช่หรือไม่`)) return;

    setSavingAd(true);
    setError(null);
    setSuccess(null);

    const imagePath = row.image_url ? getHeroStoragePath(row.image_url) : null;
    const { error: deleteError } = await supabase.from("site_hero_ads").delete().eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      await removeStoragePath(imagePath);
      setSuccess("ลบ Hero Ads เรียบร้อย");
      if (adForm.id === row.id) resetAdForm();
      await loadHeroContent(siteId);
    }

    setSavingAd(false);
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
        <button className="btn btn-ghost" onClick={() => siteId && void loadHeroContent(siteId)} disabled={!siteId || loading}>
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
         {/*  <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">
              <span className="card-title">Hero Section</span>
            </div>
            <div className="card-body">
              <div className="modal-grid">
                <label>
                  <span className="auth-label">Eyebrow</span>
                  <input className="auth-input" value={sectionForm.eyebrow} onChange={(e) => setSectionForm((p) => ({ ...p, eyebrow: e.target.value }))} />
                </label>
                <label>
                  <span className="auth-label">Title Line 1</span>
                  <input className="auth-input" value={sectionForm.title_line_1} onChange={(e) => setSectionForm((p) => ({ ...p, title_line_1: e.target.value }))} />
                </label>
                <label>
                  <span className="auth-label">Title Line 2</span>
                  <input className="auth-input" value={sectionForm.title_line_2} onChange={(e) => setSectionForm((p) => ({ ...p, title_line_2: e.target.value }))} />
                </label>
                <label>
                  <span className="auth-label">Title Line 3</span>
                  <input className="auth-input" value={sectionForm.title_line_3} onChange={(e) => setSectionForm((p) => ({ ...p, title_line_3: e.target.value }))} />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span className="auth-label">Subtitle</span>
                  <input className="auth-input" value={sectionForm.subtitle} onChange={(e) => setSectionForm((p) => ({ ...p, subtitle: e.target.value }))} />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span className="auth-label">Subtitle Highlight</span>
                  <input className="auth-input" value={sectionForm.subtitle_highlight} onChange={(e) => setSectionForm((p) => ({ ...p, subtitle_highlight: e.target.value }))} />
                </label>

              <label>
                  <span className="auth-label">Left BG</span>
                  <input ref={leftFileInputRef} type="file" accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")} style={{ display: "none" }} onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file) void uploadHeroBackground("left", file);
                    e.currentTarget.value = "";
                  }} disabled={uploadingLeftBg || savingSection} />
                  <div
                    className={`dropzone ${draggingZone === "left" ? "active" : ""} ${savingSection || uploadingLeftBg || uploadingRightBg ? "disabled" : ""}`}
                    role="button"
                    tabIndex={0}
                    onDragEnter={(event) => {
                      if (savingSection || uploadingLeftBg || uploadingRightBg) return;
                      event.preventDefault();
                      event.stopPropagation();
                      if (draggingZone !== "left") setDraggingZone("left");
                    }}
                    onDragOver={(event) => {
                      if (savingSection || uploadingLeftBg || uploadingRightBg) return;
                      event.preventDefault();
                      event.stopPropagation();
                      event.dataTransfer.dropEffect = "copy";
                      if (draggingZone !== "left") setDraggingZone("left");
                    }}
                    onDragLeave={(event) => handleDragLeave("left", event)}
                    onDrop={(event) => handleDropUpload("left", event)}
                    onClick={() => leftFileInputRef.current?.click()}
                  >
                    <div style={{ fontSize: 12, color: "var(--text2)" }}>ลากรูปหรือคลิกเพื่ออัปโหลด</div>
                    {uploadingLeftBg && <div style={{ fontSize: 11, marginTop: 4 }}>กำลังอัปโหลด...</div>}
                  </div>
                  {sectionForm.left_bg_image_url && (
                    <div style={{ marginTop: 8, position: "relative" }}>
                      <img src={sectionForm.left_bg_image_url} alt="left bg" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                      <button className="btn btn-ghost" type="button" style={{ position: "absolute", top: 6, right: 6, color: "var(--red)", background: "rgba(255,255,255,.8)" }} onClick={() => void removeHeroBackground("left")}>
                        ×
                      </button>
                    </div>
                  )}
                </label>

                <label>
                  <span className="auth-label">Right BG</span>
                  <input ref={rightFileInputRef} type="file" accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")} style={{ display: "none" }} onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file) void uploadHeroBackground("right", file);
                    e.currentTarget.value = "";
                  }} disabled={uploadingRightBg || savingSection} />
                  <div
                    className={`dropzone ${draggingZone === "right" ? "active" : ""} ${savingSection || uploadingLeftBg || uploadingRightBg ? "disabled" : ""}`}
                    role="button"
                    tabIndex={0}
                    onDragEnter={(event) => {
                      if (savingSection || uploadingLeftBg || uploadingRightBg) return;
                      event.preventDefault();
                      event.stopPropagation();
                      if (draggingZone !== "right") setDraggingZone("right");
                    }}
                    onDragOver={(event) => {
                      if (savingSection || uploadingLeftBg || uploadingRightBg) return;
                      event.preventDefault();
                      event.stopPropagation();
                      event.dataTransfer.dropEffect = "copy";
                      if (draggingZone !== "right") setDraggingZone("right");
                    }}
                    onDragLeave={(event) => handleDragLeave("right", event)}
                    onDrop={(event) => handleDropUpload("right", event)}
                    onClick={() => rightFileInputRef.current?.click()}
                  >
                    <div style={{ fontSize: 12, color: "var(--text2)" }}>ลากรูปหรือคลิกเพื่ออัปโหลด</div>
                    {uploadingRightBg && <div style={{ fontSize: 11, marginTop: 4 }}>กำลังอัปโหลด...</div>}
                  </div>
                  {sectionForm.right_bg_image_url && (
                    <div style={{ marginTop: 8, position: "relative" }}>
                      <img src={sectionForm.right_bg_image_url} alt="right bg" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                      <button className="btn btn-ghost" type="button" style={{ position: "absolute", top: 6, right: 6, color: "var(--red)", background: "rgba(255,255,255,.8)" }} onClick={() => void removeHeroBackground("right")}>
                        ×
                      </button>
                    </div>
                  )}
                </label>  
 
                <label style={{ gridColumn: "1 / -1" }}>
                  <span className="auth-label">Badges JSON</span>
                  <textarea className="auth-input mono" rows={4} value={sectionForm.badges_json} onChange={(e) => setSectionForm((p) => ({ ...p, badges_json: e.target.value }))} />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span className="auth-label">CTAs JSON</span>
                  <textarea className="auth-input mono" rows={4} value={sectionForm.ctas_json} onChange={(e) => setSectionForm((p) => ({ ...p, ctas_json: e.target.value }))} />
                </label > 

                <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 22 }}>
                  <input type="checkbox" checked={sectionForm.active} onChange={(e) => setSectionForm((p) => ({ ...p, active: e.target.checked }))} style={{ width: 16 }} />
                  <span className="auth-label" style={{ margin: 0 }}>เปิดใช้งาน Hero Section</span>
                </label>
              </div>

              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={() => void saveSection()} disabled={savingSection || loading || uploadingLeftBg || uploadingRightBg}>
                  {savingSection ? "กำลังบันทึก..." : "บันทึก Hero Section"}
                </button>
              </div>
            </div>
          </div> */}

          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-head">
              <span className="card-title">Hero </span>
            </div>
            <div className="card-body">
              <div className="modal-grid">
                <label>
                  <span className="auth-label">Title *</span>
                  <input className="auth-input" value={adForm.title} onChange={(e) => setAdForm((p) => ({ ...p, title: e.target.value }))} />
                </label>
                <label>
                  <span className="auth-label">Tag</span>
                  <input className="auth-input" value={adForm.tag} onChange={(e) => setAdForm((p) => ({ ...p, tag: e.target.value }))} />
                </label>
                <label>
                  <span className="auth-label">Title 2</span>
                  <input className="auth-input" value={adForm.title_2} onChange={(e) => setAdForm((p) => ({ ...p, title_2: e.target.value }))} />
                </label>
                <label>
                  <span className="auth-label">Title 3</span>
                  <input className="auth-input" value={adForm.title_3} onChange={(e) => setAdForm((p) => ({ ...p, title_3: e.target.value }))} />
                </label>
                <label>
                  <span className="auth-label">Title 4</span>
                  <input className="auth-input" value={adForm.title_4} onChange={(e) => setAdForm((p) => ({ ...p, title_4: e.target.value }))} />
                </label>
                <label>
                  <span className="auth-label">Title 5</span>
                  <input className="auth-input" value={adForm.title_5} onChange={(e) => setAdForm((p) => ({ ...p, title_5: e.target.value }))} />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span className="auth-label">Message</span>
                  <input className="auth-input" value={adForm.message} onChange={(e) => setAdForm((p) => ({ ...p, message: e.target.value }))} />
                </label>

                <label style={{ gridColumn: "1 / -1" }}>
                  <span className="auth-label">รูปภาพ Ads (bucket/hero)</span>
                  <input ref={adFileInputRef} type="file" accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")} style={{ display: "none" }} onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file) void uploadAdImage(file);
                    e.currentTarget.value = "";
                  }} disabled={uploadingAdImage || savingAd} />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button className="btn btn-ghost" type="button" onClick={() => adFileInputRef.current?.click()} disabled={uploadingAdImage || savingAd}>
                      {uploadingAdImage ? "กำลังอัปโหลด..." : adForm.image_url ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
                    </button>
                    {adForm.image_url && (
                      <button className="btn btn-ghost" type="button" style={{ color: "var(--red)" }} onClick={() => void removeAdImage()}>
                        ลบรูป
                      </button>
                    )}
                  </div>
                  {adForm.image_url && !adImagePreviewError ? (
                    <div style={{ marginTop: 8 }}>
                      <img src={adForm.image_url} alt="ads preview" onError={() => setAdImagePreviewError(true)} style={{ width: "100%", maxWidth: 320, height: 140, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                    </div>
                  ) : null}
                  <input className="auth-input mono" value={adForm.image_url} readOnly />
                </label>

                <label>
                  <span className="auth-label">Sort Order</span>
                  <input className="auth-input" type="number" value={adForm.sort_order} onChange={(e) => setAdForm((p) => ({ ...p, sort_order: e.target.value }))} />
                </label>
                <label>
                  <span className="auth-label">CTA Label</span>
                  <input className="auth-input" value={adForm.cta_label} onChange={(e) => setAdForm((p) => ({ ...p, cta_label: e.target.value }))} />
                </label>
                <label>
                  <span className="auth-label">CTA Href</span>
                  <input className="auth-input" value={adForm.cta_href} onChange={(e) => setAdForm((p) => ({ ...p, cta_href: e.target.value }))} />
                </label>
                <label>
                  <span className="auth-label">Starts At</span>
                  <input className="auth-input" type="datetime-local" value={adForm.starts_at} onChange={(e) => setAdForm((p) => ({ ...p, starts_at: e.target.value }))} />
                </label>
                <label>
                  <span className="auth-label">Ends At</span>
                  <input className="auth-input" type="datetime-local" value={adForm.ends_at} onChange={(e) => setAdForm((p) => ({ ...p, ends_at: e.target.value }))} />
                </label>
                <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 22 }}>
                  <input type="checkbox" checked={adForm.active} onChange={(e) => setAdForm((p) => ({ ...p, active: e.target.checked }))} style={{ width: 16 }} />
                  <span className="auth-label" style={{ margin: 0 }}>เปิดใช้งาน Ads นี้</span>
                </label>
              </div>

              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className="btn btn-ghost" onClick={resetAdForm} disabled={savingAd}>ล้างฟอร์ม</button>
                <button className="btn btn-primary" onClick={() => void saveAd()} disabled={savingAd || loading}>
                  {savingAd ? "กำลังบันทึก..." : adForm.id ? "อัปเดต Ads" : "เพิ่ม Ads"}
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>รูป</th>
                    <th>Title</th>
                    <th>Title 2-5</th>
                    <th>Tag</th>
                    <th>ลำดับ</th>
                    <th>ช่วงเวลา</th>
                    <th>สถานะ</th>
                    <th>แก้ไขล่าสุด</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {adPagination.paginatedRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.image_url ? (
                          <img src={row.image_url} alt={row.title} style={{ width: 88, height: 52, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text3)" }}>ไม่มีรูป</span>
                        )}
                      </td>
                      <td>{row.title}</td>
                      <td style={{ color: "var(--text2)", fontSize: 12 }}>
                        {[row.title_2, row.title_3, row.title_4, row.title_5].filter(Boolean).join(" / ") || "-"}
                      </td>
                      <td>{row.tag || "-"}</td>
                      <td className="mono">{row.sort_order}</td>
                      <td style={{ color: "var(--text2)" }}>
                        {row.starts_at ? new Date(row.starts_at).toLocaleString("th-TH") : "-"} → {row.ends_at ? new Date(row.ends_at).toLocaleString("th-TH") : "-"}
                      </td>
                      <td>
                        <span className={`badge ${row.active ? "paid" : "pending"}`}>{row.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span>
                      </td>
                      <td style={{ color: "var(--text3)" }}>
                        {new Date(row.updated_at).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => editAd(row)}>แก้ไข</button>
                        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }} onClick={() => void deleteAd(row)}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                  {!ads.length && !loading && (
                    <tr>
                      <td colSpan={9} style={{ color: "var(--text3)", padding: 16 }}>ยังไม่มี Hero Ads</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <TablePaginationControls
              page={adPagination.page}
              totalPages={adPagination.totalPages}
              pageSize={adPagination.pageSize}
              totalItems={adPagination.totalItems}
              onPageChange={adPagination.setPage}
              onPageSizeChange={adPagination.setPageSize}
            />
          </div>
        </>
      )}
    </div>
  );
}
