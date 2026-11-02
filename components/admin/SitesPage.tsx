"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

type SiteRow = {
  id: string;
  code: "car_retail" | "truck_dealer" | "moto_dealer";
  name: string;
  domain: string | null;
  active: boolean;
  created_at: string;
  updated_at: string | null;
};

type CompanyProfileRow = {
  id: string;
  site_id: string;
  company_name: string | null;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  line_id: string | null;
  address: string | null;
  about: string | null;
  logo_url: string | null;
  cover_url: string | null;
};

type SitePaymentAccountRow = {
  id: string;
  site_id: string;
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  qr_code_url: string | null;
};

type SiteServiceRow = {
  id: string;
  site_id: string;
  title: string;
  summary: string | null;
  detail: string | null;
  image_url: string | null;
  active: boolean;
  sort_order: number;
};

type SiteProductRow = {
  id: string;
  site_id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  price_from: number | null;
  cta_label: string | null;
  cta_url: string | null;
  active: boolean;
  sort_order: number;
};

const CODE_LABEL: Record<SiteRow["code"], string> = {
  car_retail: "Retail",
  truck_dealer: "Dealer",
  moto_dealer: "Dealer"
};

const CODE_TIER: Record<SiteRow["code"], string> = {
  car_retail: "t-member",
  truck_dealer: "t-small",
  moto_dealer: "t-mid"
};

const CODE_NAME: Record<SiteRow["code"], string> = {
  car_retail: "ยางรถยนต์ (ปลีก)",
  truck_dealer: "ยางรถบรรทุก",
  moto_dealer: "ยางมอเตอร์ไซค์"
};

const CODE_OPTIONS: SiteRow["code"][] = ["car_retail", "truck_dealer", "moto_dealer"];

const EMPTY_FORM = {
  id: "" as string,
  code: "car_retail" as SiteRow["code"],
  name: "",
  domain: "",
  active: true
};

const EMPTY_COMPANY_FORM = {
  company_name: "",
  tax_id: "",
  phone: "",
  email: "",
  line_id: "",
  address: "",
  about: "",
  logo_url: "",
  cover_url: ""
};

const EMPTY_SERVICE_FORM = {
  id: "",
  title: "",
  summary: "",
  detail: "",
  image_url: "",
  sort_order: "0",
  active: true
};

const EMPTY_PAYMENT_FORM = {
  account_name: "",
  account_number: "",
  bank_name: "",
  qr_code_url: ""
};

const EMPTY_PRODUCT_FORM = {
  id: "",
  title: "",
  subtitle: "",
  description: "",
  image_url: "",
  price_from: "",
  cta_label: "",
  cta_url: "",
  sort_order: "0",
  active: true
};

export default function SitesPage() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY_FORM);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM);
  const [services, setServices] = useState<SiteServiceRow[]>([]);
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE_FORM);
  const [products, setProducts] = useState<SiteProductRow[]>([]);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [contentLoading, setContentLoading] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [uploadingPaymentQr, setUploadingPaymentQr] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  const hasSupabase = useMemo(() => Boolean(supabase), []);
  const {
    page,
    pageSize,
    totalPages,
    totalItems,
    paginatedRows,
    setPage,
    setPageSize
  } = useTablePagination(sites, 10);
  let paymentSubmitLabel = "บันทึกข้อมูลการชำระเงิน";
  if (uploadingPaymentQr) paymentSubmitLabel = "กำลังอัปโหลด QR...";
  if (savingPayment) paymentSubmitLabel = "กำลังบันทึก...";

  async function loadSites() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    const { data, error: fetchError } = await supabase
      .from("sites")
      .select("id,code,name,domain,active,created_at,updated_at")
      .order("created_at", { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setSites((data ?? []) as SiteRow[]);
    }
    setLoading(false);
  }

  async function loadSiteContent(siteId: string) {
    if (!supabase || !siteId) return;
    setContentLoading(true);
    const [{ data: companyData }, { data: paymentData }, { data: serviceData }, { data: productData }] =
      await Promise.all([
      supabase
        .from("site_company_profiles")
        .select("id,site_id,company_name,tax_id,phone,email,line_id,address,about,logo_url,cover_url")
        .eq("site_id", siteId)
        .maybeSingle(),
      supabase
        .from("site_payment_accounts")
        .select("id,site_id,account_name,account_number,bank_name,qr_code_url")
        .eq("site_id", siteId)
        .maybeSingle(),
      supabase
        .from("site_services")
        .select("id,site_id,title,summary,detail,image_url,active,sort_order")
        .eq("site_id", siteId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("site_showcase_products")
        .select("id,site_id,title,subtitle,description,image_url,price_from,cta_label,cta_url,active,sort_order")
        .eq("site_id", siteId)
        .order("sort_order", { ascending: true })
      ]);

    const company = (companyData ?? null) as CompanyProfileRow | null;
    const payment = (paymentData ?? null) as SitePaymentAccountRow | null;
    setCompanyForm({
      company_name: company?.company_name ?? "",
      tax_id: company?.tax_id ?? "",
      phone: company?.phone ?? "",
      email: company?.email ?? "",
      line_id: company?.line_id ?? "",
      address: company?.address ?? "",
      about: company?.about ?? "",
      logo_url: company?.logo_url ?? "",
      cover_url: company?.cover_url ?? ""
    });
    setPaymentForm({
      account_name: payment?.account_name ?? "",
      account_number: payment?.account_number ?? "",
      bank_name: payment?.bank_name ?? "",
      qr_code_url: payment?.qr_code_url ?? ""
    });
    setServices((serviceData ?? []) as SiteServiceRow[]);
    setProducts((productData ?? []) as SiteProductRow[]);
    setServiceForm(EMPTY_SERVICE_FORM);
    setProductForm(EMPTY_PRODUCT_FORM);
    setContentLoading(false);
  }

  useEffect(() => {
    void loadSites();
  }, []);

  function openModal(site?: SiteRow) {
    if (site) {
      setForm({
        id: site.id,
        code: site.code,
        name: site.name,
        domain: site.domain ?? "",
        active: site.active
      });
      void loadSiteContent(site.id);
    } else {
      setForm(EMPTY_FORM);
      setCompanyForm(EMPTY_COMPANY_FORM);
      setPaymentForm(EMPTY_PAYMENT_FORM);
      setServices([]);
      setProducts([]);
      setServiceForm(EMPTY_SERVICE_FORM);
      setProductForm(EMPTY_PRODUCT_FORM);
    }
    setModalOpen(true);
  }

  async function handleSave() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!form.name.trim()) {
      setError("กรุณากรอกชื่อเว็บไซต์");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    if (form.id) {
      const { error: updateError } = await supabase
        .from("sites")
        .update({
          name: form.name.trim(),
          domain: form.domain.trim() || null,
          active: form.active,
          updated_at: new Date().toISOString()
        })
        .eq("id", form.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess("อัปเดตเว็บไซต์เรียบร้อย");
        await loadSites();
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("sites")
        .insert({
          code: form.code,
          name: form.name.trim(),
          domain: form.domain.trim() || null,
          active: form.active,
          updated_at: new Date().toISOString()
        })
        .select("id,code,name,domain,active,created_at,updated_at")
        .single();
      if (insertError || !inserted?.id) {
        setError(insertError?.message ?? "เพิ่มเว็บไซต์ไม่สำเร็จ");
      } else {
        setSuccess("เพิ่มเว็บไซต์เรียบร้อย");
        const nextSite = inserted as SiteRow;
        setForm({
          id: nextSite.id,
          code: nextSite.code,
          name: nextSite.name,
          domain: nextSite.domain ?? "",
          active: nextSite.active
        });
        await loadSites();
      }
    }
    setLoading(false);
  }

  async function handleDelete(site: SiteRow) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!confirm(`ลบเว็บไซต์ ${site.name} ใช่หรือไม่`)) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const { error: deleteError } = await supabase.from("sites").delete().eq("id", site.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("ลบเว็บไซต์เรียบร้อย");
      await loadSites();
    }
    setLoading(false);
  }

  async function saveCompanyProfile() {
    if (!supabase || !form.id) return;
    setSavingCompany(true);
    setError(null);
    const { error: companyError } = await supabase.from("site_company_profiles").upsert(
      {
        site_id: form.id,
        company_name: companyForm.company_name.trim() || null,
        tax_id: companyForm.tax_id.trim() || null,
        phone: companyForm.phone.trim() || null,
        email: companyForm.email.trim() || null,
        line_id: companyForm.line_id.trim() || null,
        address: companyForm.address.trim() || null,
        about: companyForm.about.trim() || null,
        logo_url: companyForm.logo_url.trim() || null,
        cover_url: companyForm.cover_url.trim() || null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "site_id" }
    );
    if (companyError) {
      setError(companyError.message);
    } else {
      setSuccess("บันทึกข้อมูลบริษัทเรียบร้อย");
    }
    setSavingCompany(false);
  }

  function getWebsiteBankStoragePath(url: string) {
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/websitebank/`;
    if (url.startsWith(base)) return url.slice(base.length);
    return null;
  }

  async function uploadPaymentQr(file: File) {
    if (!supabase || !form.id) return;
    setUploadingPaymentQr(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = new FormData();
      payload.append("site_id", form.id);
      payload.append("image", file);
      const response = await fetch("/api/sites/payment-qr/upload", {
        method: "POST",
        body: payload
      });
      const result = (await response.json()) as { image_url?: string; path?: string; error?: string };
      if (!response.ok || !result.image_url) {
        throw new Error(result.error || "อัปโหลด QR Code ไม่สำเร็จ");
      }
      const nextUrl = result.image_url;
      const oldPath = paymentForm.qr_code_url ? getWebsiteBankStoragePath(paymentForm.qr_code_url) : null;
      if (oldPath && oldPath !== result.path) {
        await fetch("/api/sites/payment-qr/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths: [oldPath] })
        });
      }
      setPaymentForm((prev) => ({ ...prev, qr_code_url: nextUrl }));
      setSuccess("อัปโหลด QR Code เรียบร้อย (อย่าลืมกดบันทึก)");
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "อัปโหลด QR Code ไม่สำเร็จ";
      setError(message);
    } finally {
      setUploadingPaymentQr(false);
    }
  }

  async function removePaymentQr() {
    if (!paymentForm.qr_code_url) return;
    const path = getWebsiteBankStoragePath(paymentForm.qr_code_url);
    if (path) {
      await fetch("/api/sites/payment-qr/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: [path] })
      });
    }
    setPaymentForm((prev) => ({ ...prev, qr_code_url: "" }));
  }

  async function savePaymentAccount() {
    if (!supabase || !form.id) return;
    setSavingPayment(true);
    setError(null);
    const { error: paymentError } = await supabase.from("site_payment_accounts").upsert(
      {
        site_id: form.id,
        account_name: paymentForm.account_name.trim() || null,
        account_number: paymentForm.account_number.trim() || null,
        bank_name: paymentForm.bank_name.trim() || null,
        qr_code_url: paymentForm.qr_code_url.trim() || null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "site_id" }
    );
    if (paymentError) {
      setError(paymentError.message);
    } else {
      setSuccess("บันทึกข้อมูลการชำระเงินเรียบร้อย");
    }
    setSavingPayment(false);
  }

  async function saveService() {
    if (!supabase || !form.id) return;
    if (!serviceForm.title.trim()) {
      setError("กรุณากรอกชื่อบริการ");
      return;
    }
    setSavingService(true);
    setError(null);
    if (serviceForm.id) {
      const { error: updateError } = await supabase
        .from("site_services")
        .update({
          title: serviceForm.title.trim(),
          summary: serviceForm.summary.trim() || null,
          detail: serviceForm.detail.trim() || null,
          image_url: serviceForm.image_url.trim() || null,
          sort_order: Number(serviceForm.sort_order || 0),
          active: serviceForm.active,
          updated_at: new Date().toISOString()
        })
        .eq("id", serviceForm.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess("อัปเดตบริการเรียบร้อย");
      }
    } else {
      const { error: insertError } = await supabase.from("site_services").insert({
        site_id: form.id,
        title: serviceForm.title.trim(),
        summary: serviceForm.summary.trim() || null,
        detail: serviceForm.detail.trim() || null,
        image_url: serviceForm.image_url.trim() || null,
        sort_order: Number(serviceForm.sort_order || 0),
        active: serviceForm.active,
        updated_at: new Date().toISOString()
      });
      if (insertError) {
        setError(insertError.message);
      } else {
        setSuccess("เพิ่มบริการเรียบร้อย");
      }
    }
    await loadSiteContent(form.id);
    setSavingService(false);
  }

  async function deleteService(row: SiteServiceRow) {
    if (!supabase || !form.id) return;
    if (!confirm(`ลบบริการ ${row.title} ใช่หรือไม่`)) return;
    setSavingService(true);
    setError(null);
    const { error: deleteError } = await supabase.from("site_services").delete().eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("ลบบริการเรียบร้อย");
      await loadSiteContent(form.id);
    }
    setSavingService(false);
  }

  async function saveProduct() {
    if (!supabase || !form.id) return;
    if (!productForm.title.trim()) {
      setError("กรุณากรอกชื่อสินค้า");
      return;
    }
    setSavingProduct(true);
    setError(null);
    if (productForm.id) {
      const { error: updateError } = await supabase
        .from("site_showcase_products")
        .update({
          title: productForm.title.trim(),
          subtitle: productForm.subtitle.trim() || null,
          description: productForm.description.trim() || null,
          image_url: productForm.image_url.trim() || null,
          price_from: productForm.price_from ? Number(productForm.price_from) : null,
          cta_label: productForm.cta_label.trim() || null,
          cta_url: productForm.cta_url.trim() || null,
          sort_order: Number(productForm.sort_order || 0),
          active: productForm.active,
          updated_at: new Date().toISOString()
        })
        .eq("id", productForm.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess("อัปเดตสินค้าเรียบร้อย");
      }
    } else {
      const { error: insertError } = await supabase.from("site_showcase_products").insert({
        site_id: form.id,
        title: productForm.title.trim(),
        subtitle: productForm.subtitle.trim() || null,
        description: productForm.description.trim() || null,
        image_url: productForm.image_url.trim() || null,
        price_from: productForm.price_from ? Number(productForm.price_from) : null,
        cta_label: productForm.cta_label.trim() || null,
        cta_url: productForm.cta_url.trim() || null,
        sort_order: Number(productForm.sort_order || 0),
        active: productForm.active,
        updated_at: new Date().toISOString()
      });
      if (insertError) {
        setError(insertError.message);
      } else {
        setSuccess("เพิ่มสินค้าเรียบร้อย");
      }
    }
    await loadSiteContent(form.id);
    setSavingProduct(false);
  }

  async function deleteProduct(row: SiteProductRow) {
    if (!supabase || !form.id) return;
    if (!confirm(`ลบสินค้า ${row.title} ใช่หรือไม่`)) return;
    setSavingProduct(true);
    setError(null);
    const { error: deleteError } = await supabase
      .from("site_showcase_products")
      .delete()
      .eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("ลบสินค้าเรียบร้อย");
      await loadSiteContent(form.id);
    }
    setSavingProduct(false);
  }

  return (
    <div className="page active">
      <div className="toolbar" style={{ marginBottom: 18 }}>
        <button className="btn btn-primary" onClick={() => openModal()}>
          เพิ่มเว็บไซต์
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
                <th>ชื่อเว็บไซต์</th>
                <th>โดเมน</th>
                <th>ประเภท</th>
                <th>สถานะ</th>
                <th>แก้ไขล่าสุด</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((site) => (
                <tr key={site.id}>
                  <td>{site.name || CODE_NAME[site.code]}</td>
                  <td className="mono" style={{ color: "var(--text2)" }}>
                    {site.domain ?? "-"}
                  </td>
                  <td>
                    <span className={`tier-label ${CODE_TIER[site.code]}`}>{CODE_LABEL[site.code]}</span>
                  </td>
                  <td>
                    <span className={`badge ${site.active ? "paid" : "pending"}`}>
                      {site.active ? "ใช้งาน" : "พักใช้งาน"}
                    </span>
                  </td>
                  <td style={{ color: "var(--text3)" }}>
                    {new Date(site.updated_at ?? site.created_at).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric"
                    })}
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => openModal(site)}
                    >
                      จัดการ
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                      onClick={() => handleDelete(site)}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {!sites.length && !loading && (
                <tr>
                  <td colSpan={6} style={{ color: "var(--text3)", padding: 16 }}>
                    ยังไม่มีเว็บไซต์ในระบบ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePaginationControls
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 1100 }}>
            <div className="modal-head">
              <div className="modal-title">{form.id ? "แก้ไขเว็บไซต์" : "เพิ่มเว็บไซต์"}</div>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="card-head">
                  <span className="card-title">ข้อมูลเว็บไซต์</span>
                </div>
                <div className="card-body">
                  <div className="modal-grid">
                    <label>
                      <span className="auth-label">ชื่อเว็บไซต์</span>
                      <input
                        className="auth-input"
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="เช่น ยางรถยนต์ (ปลีก)"
                      />
                    </label>
                    <label>
                      <span className="auth-label">โดเมน</span>
                      <input
                        className="auth-input"
                        value={form.domain}
                        onChange={(event) => setForm((prev) => ({ ...prev, domain: event.target.value }))}
                        placeholder="เช่น car.tirehub.co"
                      />
                    </label>
                    <label>
                      <span className="auth-label">ประเภทเว็บไซต์</span>
                      <select
                        className="filter-select"
                        value={form.code}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, code: event.target.value as SiteRow["code"] }))
                        }
                        disabled={Boolean(form.id)}
                      >
                        {CODE_OPTIONS.map((code) => (
                          <option key={code} value={code}>
                            {CODE_NAME[code]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 22 }}>
                      <input
                        type="checkbox"
                        checked={form.active}
                        onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                        style={{ width: 16 }}
                      />
                      <span className="auth-label" style={{ margin: 0 }}>ใช้งานเว็บไซต์</span>
                    </label>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!hasSupabase || loading}>
                      {loading ? "กำลังบันทึก..." : "บันทึกข้อมูลเว็บไซต์"}
                    </button>
                  </div>
                </div>
              </div>

              {!form.id ? (
                <div style={{ fontSize: 12, color: "var(--text3)" }}>
                  กรุณาบันทึกเว็บไซต์ก่อน จากนั้นจึงจัดการข้อมูลบริษัท บริการ และสินค้าได้
                </div>
              ) : (
                <>
                  <div className="card" style={{ marginBottom: 12 }}>
                    <div className="card-head">
                      <span className="card-title">ข้อมูลบริษัท</span>
                    </div>
                    <div className="card-body">
                      <div className="modal-grid">
                        <label>
                          <span className="auth-label">ชื่อบริษัท</span>
                          <input
                            className="auth-input"
                            value={companyForm.company_name}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({ ...prev, company_name: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          <span className="auth-label">เลขประจำตัวผู้เสียภาษี</span>
                          <input
                            className="auth-input"
                            value={companyForm.tax_id}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({ ...prev, tax_id: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          <span className="auth-label">โทรศัพท์</span>
                          <input
                            className="auth-input"
                            value={companyForm.phone}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({ ...prev, phone: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          <span className="auth-label">อีเมล</span>
                          <input
                            className="auth-input"
                            value={companyForm.email}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({ ...prev, email: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          <span className="auth-label">Line ID</span>
                          <input
                            className="auth-input"
                            value={companyForm.line_id}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({ ...prev, line_id: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          <span className="auth-label">โลโก้ (URL)</span>
                          <input
                            className="auth-input"
                            value={companyForm.logo_url}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({ ...prev, logo_url: event.target.value }))
                            }
                          />
                        </label>
                        <label style={{ gridColumn: "1 / -1" }}>
                          <span className="auth-label">รูปหน้าปกเว็บไซต์ (URL)</span>
                          <input
                            className="auth-input"
                            value={companyForm.cover_url}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({ ...prev, cover_url: event.target.value }))
                            }
                          />
                        </label>
                        <label style={{ gridColumn: "1 / -1" }}>
                          <span className="auth-label">ที่อยู่บริษัท</span>
                          <input
                            className="auth-input"
                            value={companyForm.address}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({ ...prev, address: event.target.value }))
                            }
                          />
                        </label>
                        <label style={{ gridColumn: "1 / -1" }}>
                          <span className="auth-label">เกี่ยวกับบริษัท</span>
                          <textarea
                            className="auth-input"
                            rows={3}
                            value={companyForm.about}
                            onChange={(event) =>
                              setCompanyForm((prev) => ({ ...prev, about: event.target.value }))
                            }
                          />
                        </label>
                      </div>
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-primary"
                          onClick={saveCompanyProfile}
                          disabled={savingCompany || contentLoading}
                        >
                          {savingCompany ? "กำลังบันทึก..." : "บันทึกข้อมูลบริษัท"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="card" style={{ marginBottom: 12 }}>
                    <div className="card-head">
                      <span className="card-title">ข้อมูลบัญชีรับชำระ</span>
                    </div>
                    <div className="card-body">
                      <div className="modal-grid">
                        <label>
                          <span className="auth-label">ชื่อบัญชี</span>
                          <input
                            className="auth-input"
                            value={paymentForm.account_name}
                            onChange={(event) =>
                              setPaymentForm((prev) => ({ ...prev, account_name: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          <span className="auth-label">เลขที่บัญชี</span>
                          <input
                            className="auth-input"
                            value={paymentForm.account_number}
                            onChange={(event) =>
                              setPaymentForm((prev) => ({ ...prev, account_number: event.target.value }))
                            }
                          />
                        </label>
                        <label>
                          <span className="auth-label">ธนาคาร</span>
                          <input
                            className="auth-input"
                            value={paymentForm.bank_name}
                            onChange={(event) =>
                              setPaymentForm((prev) => ({ ...prev, bank_name: event.target.value }))
                            }
                          />
                        </label>
                        <label style={{ gridColumn: "1 / -1" }}>
                          <span className="auth-label">QR Code Payment</span>
                          <input
                            className="auth-input"
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              if (file) void uploadPaymentQr(file);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {paymentForm.qr_code_url && (
                          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, alignItems: "center" }}>
                            <img
                              src={paymentForm.qr_code_url}
                              alt="payment qr"
                              style={{ width: 180, maxWidth: "100%", borderRadius: 8, border: "1px solid var(--line)" }}
                            />
                            <button
                              className="btn btn-ghost"
                              style={{ color: "var(--red)" }}
                              onClick={() => void removePaymentQr()}
                              disabled={uploadingPaymentQr}
                            >
                              ลบรูป QR
                            </button>
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-primary"
                          onClick={savePaymentAccount}
                          disabled={savingPayment || contentLoading || uploadingPaymentQr}
                        >
                          {paymentSubmitLabel}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid2" style={{ alignItems: "start" }}>
                    <div className="card">
                      <div className="card-head">
                        <span className="card-title">บริการของเว็บไซต์</span>
                      </div>
                      <div className="card-body">
                        <div className="modal-grid">
                          <label>
                            <span className="auth-label">ชื่อบริการ</span>
                            <input
                              className="auth-input"
                              value={serviceForm.title}
                              onChange={(event) =>
                                setServiceForm((prev) => ({ ...prev, title: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span className="auth-label">รูปบริการ (URL)</span>
                            <input
                              className="auth-input"
                              value={serviceForm.image_url}
                              onChange={(event) =>
                                setServiceForm((prev) => ({ ...prev, image_url: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span className="auth-label">ลำดับ</span>
                            <input
                              className="auth-input"
                              type="number"
                              value={serviceForm.sort_order}
                              onChange={(event) =>
                                setServiceForm((prev) => ({ ...prev, sort_order: event.target.value }))
                              }
                            />
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 22 }}>
                            <input
                              type="checkbox"
                              checked={serviceForm.active}
                              onChange={(event) =>
                                setServiceForm((prev) => ({ ...prev, active: event.target.checked }))
                              }
                            />
                            <span className="auth-label" style={{ margin: 0 }}>เปิดใช้งาน</span>
                          </label>
                          <label style={{ gridColumn: "1 / -1" }}>
                            <span className="auth-label">คำอธิบายสั้น</span>
                            <input
                              className="auth-input"
                              value={serviceForm.summary}
                              onChange={(event) =>
                                setServiceForm((prev) => ({ ...prev, summary: event.target.value }))
                              }
                            />
                          </label>
                          <label style={{ gridColumn: "1 / -1" }}>
                            <span className="auth-label">รายละเอียด</span>
                            <textarea
                              className="auth-input"
                              rows={3}
                              value={serviceForm.detail}
                              onChange={(event) =>
                                setServiceForm((prev) => ({ ...prev, detail: event.target.value }))
                              }
                            />
                          </label>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button
                            className="btn btn-primary"
                            onClick={saveService}
                            disabled={savingService || contentLoading}
                          >
                            {savingService ? "กำลังบันทึก..." : serviceForm.id ? "อัปเดตบริการ" : "เพิ่มบริการ"}
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => setServiceForm(EMPTY_SERVICE_FORM)}
                            disabled={savingService}
                          >
                            ล้างฟอร์ม
                          </button>
                        </div>
                        <div className="table-wrap" style={{ marginTop: 12 }}>
                          <table>
                            <thead>
                              <tr>
                                <th>บริการ</th>
                                <th>ลำดับ</th>
                                <th>สถานะ</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {services.length === 0 ? (
                                <tr>
                                  <td colSpan={4} style={{ color: "var(--text3)" }}>
                                    ยังไม่มีบริการ
                                  </td>
                                </tr>
                              ) : (
                                services.map((row) => (
                                  <tr key={row.id}>
                                    <td>{row.title}</td>
                                    <td className="mono">{row.sort_order}</td>
                                    <td>
                                      <span className={`badge ${row.active ? "paid" : "pending"}`}>
                                        {row.active ? "เปิด" : "ปิด"}
                                      </span>
                                    </td>
                                    <td style={{ display: "flex", gap: 6 }}>
                                      <button
                                        className="btn btn-ghost"
                                        style={{ padding: "4px 10px", fontSize: 12 }}
                                        onClick={() =>
                                          setServiceForm({
                                            id: row.id,
                                            title: row.title,
                                            summary: row.summary ?? "",
                                            detail: row.detail ?? "",
                                            image_url: row.image_url ?? "",
                                            sort_order: String(row.sort_order ?? 0),
                                            active: row.active
                                          })
                                        }
                                      >
                                        แก้ไข
                                      </button>
                                      <button
                                        className="btn btn-ghost"
                                        style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                                        onClick={() => deleteService(row)}
                                      >
                                        ลบ
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-head">
                        <span className="card-title">สินค้าแนะนำของเว็บไซต์</span>
                      </div>
                      <div className="card-body">
                        <div className="modal-grid">
                          <label>
                            <span className="auth-label">ชื่อสินค้า</span>
                            <input
                              className="auth-input"
                              value={productForm.title}
                              onChange={(event) =>
                                setProductForm((prev) => ({ ...prev, title: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span className="auth-label">รูปสินค้า (URL)</span>
                            <input
                              className="auth-input"
                              value={productForm.image_url}
                              onChange={(event) =>
                                setProductForm((prev) => ({ ...prev, image_url: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span className="auth-label">ราคาเริ่มต้น</span>
                            <input
                              className="auth-input"
                              type="number"
                              value={productForm.price_from}
                              onChange={(event) =>
                                setProductForm((prev) => ({ ...prev, price_from: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span className="auth-label">ลำดับ</span>
                            <input
                              className="auth-input"
                              type="number"
                              value={productForm.sort_order}
                              onChange={(event) =>
                                setProductForm((prev) => ({ ...prev, sort_order: event.target.value }))
                              }
                            />
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 22 }}>
                            <input
                              type="checkbox"
                              checked={productForm.active}
                              onChange={(event) =>
                                setProductForm((prev) => ({ ...prev, active: event.target.checked }))
                              }
                            />
                            <span className="auth-label" style={{ margin: 0 }}>เปิดใช้งาน</span>
                          </label>
                          <label style={{ gridColumn: "1 / -1" }}>
                            <span className="auth-label">คำโปรย</span>
                            <input
                              className="auth-input"
                              value={productForm.subtitle}
                              onChange={(event) =>
                                setProductForm((prev) => ({ ...prev, subtitle: event.target.value }))
                              }
                            />
                          </label>
                          <label style={{ gridColumn: "1 / -1" }}>
                            <span className="auth-label">รายละเอียดสินค้า</span>
                            <textarea
                              className="auth-input"
                              rows={3}
                              value={productForm.description}
                              onChange={(event) =>
                                setProductForm((prev) => ({ ...prev, description: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span className="auth-label">ข้อความปุ่ม (CTA)</span>
                            <input
                              className="auth-input"
                              value={productForm.cta_label}
                              onChange={(event) =>
                                setProductForm((prev) => ({ ...prev, cta_label: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span className="auth-label">ลิงก์ปุ่ม (CTA URL)</span>
                            <input
                              className="auth-input"
                              value={productForm.cta_url}
                              onChange={(event) =>
                                setProductForm((prev) => ({ ...prev, cta_url: event.target.value }))
                              }
                            />
                          </label>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button
                            className="btn btn-primary"
                            onClick={saveProduct}
                            disabled={savingProduct || contentLoading}
                          >
                            {savingProduct ? "กำลังบันทึก..." : productForm.id ? "อัปเดตสินค้า" : "เพิ่มสินค้า"}
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => setProductForm(EMPTY_PRODUCT_FORM)}
                            disabled={savingProduct}
                          >
                            ล้างฟอร์ม
                          </button>
                        </div>
                        <div className="table-wrap" style={{ marginTop: 12 }}>
                          <table>
                            <thead>
                              <tr>
                                <th>สินค้า</th>
                                <th>ราคาเริ่มต้น</th>
                                <th>ลำดับ</th>
                                <th>สถานะ</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {products.length === 0 ? (
                                <tr>
                                  <td colSpan={5} style={{ color: "var(--text3)" }}>
                                    ยังไม่มีสินค้าแนะนำ
                                  </td>
                                </tr>
                              ) : (
                                products.map((row) => (
                                  <tr key={row.id}>
                                    <td>{row.title}</td>
                                    <td className="mono">{row.price_from ?? "-"}</td>
                                    <td className="mono">{row.sort_order}</td>
                                    <td>
                                      <span className={`badge ${row.active ? "paid" : "pending"}`}>
                                        {row.active ? "เปิด" : "ปิด"}
                                      </span>
                                    </td>
                                    <td style={{ display: "flex", gap: 6 }}>
                                      <button
                                        className="btn btn-ghost"
                                        style={{ padding: "4px 10px", fontSize: 12 }}
                                        onClick={() =>
                                          setProductForm({
                                            id: row.id,
                                            title: row.title,
                                            subtitle: row.subtitle ?? "",
                                            description: row.description ?? "",
                                            image_url: row.image_url ?? "",
                                            price_from: row.price_from !== null ? String(row.price_from) : "",
                                            cta_label: row.cta_label ?? "",
                                            cta_url: row.cta_url ?? "",
                                            sort_order: String(row.sort_order ?? 0),
                                            active: row.active
                                          })
                                        }
                                      >
                                        แก้ไข
                                      </button>
                                      <button
                                        className="btn btn-ghost"
                                        style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                                        onClick={() => deleteProduct(row)}
                                      >
                                        ลบ
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
