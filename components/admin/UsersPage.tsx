"use client";

import { useEffect, useMemo, useState } from "react";
import { pageTitles, type PageId } from "./types";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

import {
  fetchAuthUsers,
  fetchProfileMeta,
  upsertProfile,
  updateUserPermissions,
  updateUserStatus
} from "../../app/actions/users";

type UserRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  role: string | null;
  is_active: boolean;
  menu_permissions: string[];
  full_name: string | null;
  phone: string | null;
  group_id: string | null;
  site_id: string | null;
  dealer_approved: boolean;
};

type GroupRow = { id: string; name: string };
type SiteRow = { id: string; name: string };

type FormState = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  group_id: string;
  site_id: string;
  dealer_approved: boolean;
};

const emptyForm: FormState = {
  id: "",
  full_name: "",
  email: "",
  phone: "",
  role: "customer",
  group_id: "",
  site_id: "",
  dealer_approved: false
};

const MENU_OPTIONS: { id: string; label: string }[] = (Object.entries(pageTitles) as [
  PageId,
  string
][])
  .filter(([id]) => id !== "dashboard")
  .map(([id, label]) => ({ id, label }));

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [permOpen, setPermOpen] = useState(false);
  const [permUser, setPermUser] = useState<UserRow | null>(null);
  const [permSelection, setPermSelection] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadUsers();
    void loadMeta();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuthUsers();
      setUsers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ";
      setError(message);
    }
    setLoading(false);
  }

  async function loadMeta() {
    try {
      const meta = await fetchProfileMeta();
      setGroups(meta.groups as GroupRow[]);
      setSites(meta.sites as SiteRow[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ";
      setError(message);
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(user: UserRow) {
    setForm({
      id: user.id,
      full_name: user.full_name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      role: user.role ?? "customer",
      group_id: user.group_id ?? "",
      site_id: user.site_id ?? "",
      dealer_approved: Boolean(user.dealer_approved)
    });
    setFormOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (!form.id.trim()) {
        setError("กรุณาระบุ User ID (uuid) จาก auth.users");
        setSaving(false);
        return;
      }
      await upsertProfile({
        id: form.id.trim(),
        full_name: form.full_name || null,
        email: form.email || null,
        phone: form.phone || null,
        role: form.role || "customer",
        group_id: form.group_id || null,
        site_id: form.site_id || null,
        dealer_approved: form.dealer_approved
      });
      setFormOpen(false);
      setForm(emptyForm);
      await loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "บันทึกผู้ใช้งานไม่สำเร็จ";
      setError(message);
    }
    setSaving(false);
  }

  function openPermissions(user: UserRow) {
    setPermUser(user);
    setPermSelection(new Set(user.menu_permissions || []));
    setPermOpen(true);
  }

  async function savePermissions() {
    if (!permUser) return;
    setSaving(true);
    setError(null);
    try {
      const next = Array.from(permSelection);
      await updateUserPermissions(permUser.id, next);
      setUsers((prev) =>
        prev.map((item) =>
          item.id === permUser.id ? { ...item, menu_permissions: next } : item
        )
      );
      setPermOpen(false);
      setPermUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "บันทึกสิทธิ์ไม่สำเร็จ";
      setError(message);
    }
    setSaving(false);
  }

  async function toggleStatus(user: UserRow) {
    setSaving(true);
    setError(null);
    try {
      const nextStatus = !user.is_active;
      await updateUserStatus(user.id, nextStatus);
      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? { ...item, is_active: nextStatus } : item))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "อัปเดตสถานะไม่สำเร็จ";
      setError(message);
    }
    setSaving(false);
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const statusOk =
        statusFilter === "all" ||
        (statusFilter === "active" && user.is_active) ||
        (statusFilter === "inactive" && !user.is_active);
      const searchOk =
        search.trim().length === 0 ||
        [user.email, user.role, user.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
      return statusOk && searchOk;
    });
  }, [users, statusFilter, search]);

  const {
    page,
    pageSize,
    totalPages,
    totalItems,
    paginatedRows,
    setPage,
    setPageSize
  } = useTablePagination(filteredUsers, 10);

  return (
    <div className="page active">
      <div className="toolbar" style={{ marginBottom: 18 }}>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">ทุกสถานะ</option>
          <option value="active">ใช้งาน</option>
          <option value="inactive">ไม่ใช้งาน</option>
        </select>
        <div className="search-bar" style={{ maxWidth: 240 }}>
          <input
            placeholder="ค้นหาอีเมล/Role/ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={loadUsers}>
          รีเฟรช
        </button>
        <button className="btn btn-primary" onClick={openCreate}>
          เพิ่มผู้ใช้งาน
        </button>
      </div>

      <ActionFeedback error={error} onClearError={() => setError(null)} />

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ผู้ใช้งาน</th>
                <th>บทบาท</th>
                <th>สถานะ</th>
                <th>สร้างเมื่อ</th>
                <th>เข้าใช้ล่าสุด</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--text3)" }}>
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--text3)" }}>
                    ไม่พบข้อมูลผู้ใช้งาน
                  </td>
                </tr>
              ) : (
                paginatedRows.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.email || "-"}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>{user.id}</div>
                    </td>
                    <td>
                      <span className="tier-label t-general">{user.role || "-"}</span>
                    </td>
                    <td>
                      {user.is_active ? (
                        <span className="badge paid">ใช้งาน</span>
                      ) : (
                        <span className="badge cancel">ไม่ใช้งาน</span>
                      )}
                    </td>
                    <td style={{ color: "var(--text3)" }}>
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString("th-TH")
                        : "-"}
                    </td>
                    <td style={{ color: "var(--text3)" }}>
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleDateString("th-TH")
                        : "-"}
                    </td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn-ghost"

                        onClick={() => openPermissions(user)}
                      >
                        สิทธิ์เมนู
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={() => openEdit(user)}
                      >
                        แก้ไข
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={() => toggleStatus(user)}
                        disabled={saving}
                      >
                        {user.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                    </td>
                  </tr>
                ))
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

      {permOpen && permUser && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">กำหนดสิทธิ์เมนู</div>
              <button className="btn btn-ghost" onClick={() => setPermOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div className="perm-table">
                <div className="perm-row perm-header">
                  <div>เมนู</div>
                  <div className="perm-cell">เปิดใช้งาน</div>
                </div>
                {MENU_OPTIONS.map((menu) => (
                  <div className="perm-row" key={menu.id}>
                    <div className="perm-menu">{menu.label}</div>
                    <label className="perm-cell">
                      <input
                        type="checkbox"
                        checked={permSelection.has(menu.id)}
                        onChange={(e) => {
                          setPermSelection((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) {
                              next.add(menu.id);
                            } else {
                              next.delete(menu.id);
                            }
                            return next;
                          });
                        }}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setPermOpen(false)}>
                ยกเลิก
              </button>
              <button className="btn btn-primary" onClick={savePermissions} disabled={saving}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">จัดการผู้ใช้งาน</div>
              <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-grid">
                <div>
                  <label className="auth-label">User ID (uuid)</label>
                  <input
                    className="auth-input"
                    value={form.id}
                    onChange={(e) => setForm({ ...form, id: e.target.value })}
                    placeholder="เช่น 1b2c..."
                  />
                </div>
                <div>
                  <label className="auth-label">ชื่อ-นามสกุล</label>
                  <input
                    className="auth-input"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="auth-label">อีเมล</label>
                  <input
                    className="auth-input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="auth-label">โทรศัพท์</label>
                  <input
                    className="auth-input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="auth-label">บทบาท</label>
                  <select
                    className="filter-select"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
                <div>
                  <label className="auth-label">กลุ่มลูกค้า</label>
                  <select
                    className="filter-select"
                    value={form.group_id}
                    onChange={(e) => setForm({ ...form, group_id: e.target.value })}
                  >
                    <option value="">ไม่ระบุ</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="auth-label">Site</label>
                  <select
                    className="filter-select"
                    value={form.site_id}
                    onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                  >
                    <option value="">ไม่ระบุ</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.dealer_approved}
                    onChange={(e) => setForm({ ...form, dealer_approved: e.target.checked })}
                  />
                  <span>อนุมัติดีลเลอร์แล้ว</span>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>
                ยกเลิก
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
