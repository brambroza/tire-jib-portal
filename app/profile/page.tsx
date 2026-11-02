"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "../../components/AuthGuard";
import ActionFeedback from "../../components/ui/ActionFeedback";
import { supabase } from "../../lib/supabaseClient";

type UserRole = "admin" | "staff" | "customer";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  group_id: string | null;
  site_id: string | null;
  dealer_approved: boolean;
  is_active: boolean;
  menu_permissions: string[] | null;
  technician_id: string | null;
};

type CustomerGroupRow = { id: string; name: string | null };
type SiteRow = { id: string; name: string | null; code: string | null };
type TechnicianRow = { id: string; full_name: string | null };

type ProfileForm = {
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  group_id: string;
  site_id: string;
  dealer_approved: boolean;
  is_active: boolean;
  menu_permissions_text: string;
  technician_id: string;
};

const EMPTY_FORM: ProfileForm = {
  full_name: "",
  email: "",
  phone: "",
  role: "customer",
  group_id: "",
  site_id: "",
  dealer_approved: false,
  is_active: true,
  menu_permissions_text: "",
  technician_id: ""
};

function toForm(profile: ProfileRow | null): ProfileForm {
  if (!profile) return EMPTY_FORM;
  return {
    full_name: profile.full_name ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    role: profile.role ?? "customer",
    group_id: profile.group_id ?? "",
    site_id: profile.site_id ?? "",
    dealer_approved: profile.dealer_approved ?? false,
    is_active: profile.is_active ?? true,
    menu_permissions_text: (profile.menu_permissions ?? []).join(", "),
    technician_id: profile.technician_id ?? ""
  };
}

function parsePermissions(input: string) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [groups, setGroups] = useState<CustomerGroupRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  const hasSupabase = useMemo(() => Boolean(supabase), []);

  useEffect(() => {
    void loadPageData();
  }, []);

  async function loadPageData() {
    if (!supabase) {
      setError("ไม่พบการตั้งค่า Supabase");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user?.id) {
      setError(authError?.message ?? "ไม่พบข้อมูลผู้ใช้งาน");
      setLoading(false);
      return;
    }

    const uid = authData.user.id;
    setUserId(uid);

    const [
      { data: profileData, error: profileError },
      { data: groupsData, error: groupsError },
      { data: sitesData, error: sitesError },
      { data: techniciansData, error: techniciansError }
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id,full_name,email,phone,role,group_id,site_id,dealer_approved,is_active,menu_permissions,technician_id"
        )
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("customer_groups").select("id,name").order("name"),
      supabase.from("sites").select("id,name,code").order("name"),
      supabase.from("technicians").select("id,full_name").order("full_name")
    ]);

    if (profileError || groupsError || sitesError || techniciansError) {
      setError(
        profileError?.message ??
          groupsError?.message ??
          sitesError?.message ??
          techniciansError?.message ??
          "โหลดข้อมูลไม่สำเร็จ"
      );
      setLoading(false);
      return;
    }

    const row = (profileData ?? null) as ProfileRow | null;
    setProfile(row);
    setForm(toForm(row));
    setGroups((groupsData ?? []) as CustomerGroupRow[]);
    setSites((sitesData ?? []) as SiteRow[]);
    setTechnicians((techniciansData ?? []) as TechnicianRow[]);
    setLoading(false);
  }

  async function handleCreateProfile() {
    if (!supabase || !userId) {
      setError("ไม่พบข้อมูลผู้ใช้งาน");
      return;
    }
    setCreating(true);
    setError(null);
    setSuccess(null);
    const permissions = parsePermissions(form.menu_permissions_text);

    const { error: createError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: form.full_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role,
      group_id: form.group_id || null,
      site_id: form.site_id || null,
      dealer_approved: form.dealer_approved,
      is_active: form.is_active,
      menu_permissions: permissions,
      technician_id: form.technician_id || null
    });

    if (createError) {
      setError(createError.message);
    } else {
      setSuccess("สร้างโปรไฟล์เรียบร้อย");
      await loadPageData();
    }
    setCreating(false);
  }

  async function handleSaveProfile() {
    if (!supabase || !userId) {
      setError("ไม่พบข้อมูลผู้ใช้งาน");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const permissions = parsePermissions(form.menu_permissions_text);
    const payload = {
      id: userId,
      full_name: form.full_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role,
      group_id: form.group_id || null,
      site_id: form.site_id || null,
      dealer_approved: form.dealer_approved,
      is_active: form.is_active,
      menu_permissions: permissions,
      technician_id: form.technician_id || null
    };

    const { error: saveError } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (saveError) {
      setError(saveError.message);
    } else {
      setSuccess("บันทึกโปรไฟล์เรียบร้อย");
      await loadPageData();
    }
    setSaving(false);
  }

  async function handleDeleteProfile() {
    if (!supabase || !userId) {
      setError("ไม่พบข้อมูลผู้ใช้งาน");
      return;
    }
    if (!confirm("ลบข้อมูลโปรไฟล์จากตาราง profiles ใช่หรือไม่")) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    const { error: deleteError } = await supabase.from("profiles").delete().eq("id", userId);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("ลบโปรไฟล์เรียบร้อย");
      setProfile(null);
      setForm(EMPTY_FORM);
    }
    setDeleting(false);
  }

  async function handleChangePassword() {
    if (!supabase) {
      setError("ไม่พบการตั้งค่า Supabase");
      return;
    }
    if (!passwordForm.newPassword.trim()) {
      setError("กรุณากรอกรหัสผ่านใหม่");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setError("รหัสผ่านใหม่ต้องอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("ยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }

    setPasswordLoading(true);
    setError(null);
    setSuccess(null);
    const { error: passwordError } = await supabase.auth.updateUser({
      password: passwordForm.newPassword
    });
    if (passwordError) {
      setError(passwordError.message);
    } else {
      setSuccess("เปลี่ยนรหัสผ่านเรียบร้อย");
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    }
    setPasswordLoading(false);
  }

  async function handleLogout() {
    setLogoutError(null);
    if (!supabase) {
      setLogoutError("ไม่พบการตั้งค่า Supabase");
      return;
    }

    setLoggingOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setLogoutError(signOutError.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
  }

  return (
    <AuthGuard>
      <div className="main" style={{ width: "100%" }}>
        <div className="topbar">
          <div className="page-title">โปรไฟล์ผู้ใช้งาน</div>
          <div className="topbar-sep" />
          <Link href="/" className="btn btn-ghost">
            กลับหน้าแดชบอร์ด
          </Link>
          <button className="btn btn-ghost" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? "กำลังออกจากระบบ..." : "Logout"}
          </button>
        </div>
        {logoutError && (
          <div style={{ color: "var(--red)", marginBottom: 8, fontSize: 12 }}>{logoutError}</div>
        )}

        <div className="content scrollbar-thin">
          <ActionFeedback
            error={error}
            success={success}
            onClearError={() => setError(null)}
            onClearSuccess={() => setSuccess(null)}
          />

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">
              <span className="card-title">ข้อมูลโปรไฟล์ (Supabase: public.profiles)</span>
            </div>
            <div className="card-body">
              {loading ? (
                <div style={{ color: "var(--text3)", fontSize: 12 }}>กำลังโหลดข้อมูล...</div>
              ) : (
                <>
                  <div className="modal-grid">
                    <label>
                      <span className="auth-label">ชื่อ-นามสกุล</span>
                      <input
                        className="auth-input"
                        value={form.full_name}
                        onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                      />
                    </label>
                    <label>
                      <span className="auth-label">อีเมล</span>
                      <input
                        className="auth-input"
                        value={form.email}
                        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </label>
                    <label>
                      <span className="auth-label">เบอร์โทร</span>
                      <input
                        className="auth-input"
                        value={form.phone}
                        onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </label>
                    <label>
                      <span className="auth-label">บทบาท</span>
                      <select
                        className="filter-select"
                        value={form.role}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, role: e.target.value as UserRole }))
                        }
                      >
                        <option value="admin">admin</option>
                        <option value="staff">staff</option>
                        <option value="customer">customer</option>
                      </select>
                    </label>
                    <label>
                      <span className="auth-label">กลุ่มลูกค้า</span>
                      <select
                        className="filter-select"
                        value={form.group_id}
                        onChange={(e) => setForm((prev) => ({ ...prev, group_id: e.target.value }))}
                      >
                        <option value="">-</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name ?? group.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="auth-label">Site</span>
                      <select
                        className="filter-select"
                        value={form.site_id}
                        onChange={(e) => setForm((prev) => ({ ...prev, site_id: e.target.value }))}
                      >
                        <option value="">-</option>
                        {sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name ?? site.code ?? site.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="auth-label">ทีมช่าง</span>
                      <select
                        className="filter-select"
                        value={form.technician_id}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, technician_id: e.target.value }))
                        }
                      >
                        <option value="">-</option>
                        {technicians.map((tech) => (
                          <option key={tech.id} value={tech.id}>
                            {tech.full_name ?? tech.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={form.dealer_approved}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, dealer_approved: e.target.checked }))
                        }
                      />
                      <span className="auth-label" style={{ marginBottom: 0 }}>Dealer Approved</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                      />
                      <span className="auth-label" style={{ marginBottom: 0 }}>Active</span>
                    </label>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <label className="auth-label">menu_permissions (คั่นด้วย comma)</label>
                    <input
                      className="auth-input"
                      value={form.menu_permissions_text}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, menu_permissions_text: e.target.value }))
                      }
                      placeholder="dashboard, orders, install"
                    />
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {!profile ? (
                      <button
                        className="btn btn-primary"
                        onClick={handleCreateProfile}
                        disabled={!hasSupabase || creating}
                      >
                        {creating ? "กำลังสร้าง..." : "Create Profile"}
                      </button>
                    ) : null}
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveProfile}
                      disabled={!hasSupabase || saving}
                    >
                      {saving ? "กำลังบันทึก..." : "Update Profile"}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setForm(toForm(profile))}
                      disabled={saving || creating}
                    >
                      Reset
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ color: "var(--red)" }}
                      onClick={handleDeleteProfile}
                      disabled={!profile || deleting}
                    >
                      {deleting ? "กำลังลบ..." : "Delete Profile Row"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-title">เปลี่ยนรหัสผ่าน</span>
            </div>
            <div className="card-body">
              <div className="modal-grid">
                <div>
                  <label className="auth-label">รหัสผ่านใหม่</label>
                  <input
                    className="auth-input"
                    type="password"
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="auth-label">ยืนยันรหัสผ่านใหม่</label>
                  <input
                    className="auth-input"
                    type="password"
                    placeholder="พิมพ์ซ้ำอีกครั้ง"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleChangePassword}
                  disabled={!hasSupabase || passwordLoading}
                >
                  {passwordLoading ? "กำลังอัปเดต..." : "เปลี่ยนรหัสผ่าน"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
