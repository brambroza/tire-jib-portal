"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

type MemberRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  line_user_id: string | null;
  line_msg_user_id: string | null;
  created_at: string | null;
  group_id: string | null;
  customer_groups?: { name: string | null } | null;
};

type GroupRow = { id: string; code: string; name: string };
type SiteRow = { id: string; name: string };
type CarBrandRow = { id: string; name: string };
type CarModelRow = { id: string; brand_id: string; name: string };
type VehicleRow = {
  id: string;
  customer_id: string;
  site_id: string;
  plate_no: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  current_mileage: number | null;
  active: boolean;
  updated_at: string | null;
};

type FormState = {
  id: string;
  line_user_id: string;
  line_msg_user_id: string;
  display_name: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  group_id: string;
};

const emptyForm: FormState = {
  id: "",
  line_user_id: "",
  line_msg_user_id: "",
  display_name: "",
  full_name: "",
  email: "",
  phone: "",
  address: "",
  group_id: ""
};

const emptyVehicleForm = {
  id: "",
  customer_id: "",
  site_id: "",
  plate_no: "",
  brand: "",
  model: "",
  year: "",
  current_mileage: "",
  active: true
};

export default function MembersPage() {
  const [activeTab, setActiveTab] = useState<"members" | "vehicles">("members");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [carBrands, setCarBrands] = useState<CarBrandRow[]>([]);
  const [carModels, setCarModels] = useState<CarModelRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState("all");
  const [search, setSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleMemberFilter, setVehicleMemberFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [lineTestMessage, setLineTestMessage] = useState("ทดสอบส่งข้อความจากระบบสมาชิก");
  const [lineTesting, setLineTesting] = useState(false);

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");

  async function loadMeta() {
    if (!supabase) return;
    const [groupRes, siteRes, brandRes, modelRes] = await Promise.all([
      supabase.from("customer_groups").select("id,code,name").order("name"),
      supabase.from("sites").select("id,name").order("name"),
      supabase.from("car_brands").select("id,name").order("name"),
      supabase.from("car_models").select("id,brand_id,name").order("name")
    ]);

    if (!groupRes.error && groupRes.data) setGroups(groupRes.data as GroupRow[]);
    if (!siteRes.error && siteRes.data) setSites(siteRes.data as SiteRow[]);
    if (!brandRes.error && brandRes.data) setCarBrands(brandRes.data as CarBrandRow[]);
    if (!modelRes.error && modelRes.data) setCarModels(modelRes.data as CarModelRow[]);
  }

  async function loadMembers() {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const { data, error: queryError } = await supabase
      .from("customes")
      .select("id,display_name,full_name,email,phone,address,line_user_id,line_msg_user_id,created_at,group_id,customer_groups(name)")
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
    } else {
      setMembers((data ?? []) as unknown as MemberRow[]);
    }
    setLoading(false);
  }

  async function loadVehicles() {
    if (!supabase) return;
    const { data, error: queryError } = await supabase
      .from("customer_vehicles")
      .select("id,customer_id,site_id,plate_no,brand,model,year,current_mileage,active,updated_at")
      .order("updated_at", { ascending: false });
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setVehicles((data ?? []) as VehicleRow[]);
  }

  useEffect(() => {
    if (!supabase) {
      setError("กรุณาตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }
    void loadMeta();
    void loadMembers();
    void loadVehicles();
  }, []);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const groupOk = filterGroup === "all" || member.group_id === filterGroup;
      const searchOk =
        search.trim().length === 0 ||
        [member.display_name, member.full_name, member.email, member.phone, member.line_user_id]
          .concat(member.address ?? "")
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
      return groupOk && searchOk;
    });
  }, [members, filterGroup, search]);

  const filteredVehicles = useMemo(() => {
    const keyword = vehicleSearch.toLowerCase();
    return vehicles.filter((vehicle) => {
      const memberOk =
        vehicleMemberFilter === "all" || vehicle.customer_id === vehicleMemberFilter;
      const customer = members.find((member) => member.id === vehicle.customer_id);
      const searchOk =
        !vehicleSearch.trim() ||
        [
          vehicle.plate_no,
          vehicle.brand,
          vehicle.model,
          customer?.display_name,
          customer?.full_name,
          customer?.email,
          customer?.phone
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      return memberOk && searchOk;
    });
  }, [vehicleSearch, vehicles, members, vehicleMemberFilter]);

  const memberVehicleCountMap = useMemo(() => {
    const map = new Map<string, number>();
    vehicles.forEach((vehicle) => {
      map.set(vehicle.customer_id, (map.get(vehicle.customer_id) ?? 0) + 1);
    });
    return map;
  }, [vehicles]);

  const visibleCarModels = useMemo(() => {
    if (!selectedBrandId) return [];
    return carModels.filter((row) => row.brand_id === selectedBrandId);
  }, [carModels, selectedBrandId]);

  const memberPagination = useTablePagination(filteredMembers, 10);
  const vehiclePagination = useTablePagination(filteredVehicles, 10);

  function openCreate() {
    setForm(emptyForm);
    setLineTestMessage("ทดสอบส่งข้อความจากระบบสมาชิก");
    setModalOpen(true);
  }

  function openEdit(member: MemberRow) {
    setForm({
      id: member.id,
      line_user_id: member.line_user_id ?? "",
      line_msg_user_id: member.line_msg_user_id ?? "",
      display_name: member.display_name ?? "",
      full_name: member.full_name ?? "",
      email: member.email ?? "",
      phone: member.phone ?? "",
      address: member.address ?? "",
      group_id: member.group_id ?? ""
    });
    setLineTestMessage("ทดสอบส่งข้อความจากระบบสมาชิก");
    setModalOpen(true);
  }

  async function handleSendLineTest() {
    const lineUserId = form.line_msg_user_id.trim();
    const message = lineTestMessage.trim();
    if (!lineUserId) {
      setError("กรุณาระบุ LINE Msg User ID ก่อนทดสอบส่งข้อความ");
      return;
    }
    if (!message) {
      setError("กรุณากรอกข้อความทดสอบ");
      return;
    }

    setLineTesting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/line/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lineUserId,
          type: "user",
          message
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "ส่งข้อความทดสอบ LINE ไม่สำเร็จ");
      }
      setSuccess("ส่งข้อความทดสอบ LINE เรียบร้อย");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งข้อความทดสอบ LINE ไม่สำเร็จ");
    } finally {
      setLineTesting(false);
    }
  }

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const normalizedLineUserId = form.line_user_id.trim()
      ? form.line_user_id.trim()
      : `nolineid-${Math.floor(1000 + Math.random() * 9000)}`;

    const payload = {
      ...(form.id ? { id: form.id } : {}),
      line_user_id: normalizedLineUserId,
      line_msg_user_id: form.line_msg_user_id.trim() || null,
      display_name: form.display_name || null,
      full_name: form.full_name || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      group_id: form.group_id || null
    };

    const { error: upsertError } = await supabase.from("customes").upsert(payload, { onConflict: "id" });

    if (upsertError) {
      setError(upsertError.message);
    } else {
      setSuccess(form.id ? "อัปเดตสมาชิกเรียบร้อย" : "เพิ่มสมาชิกเรียบร้อย");
      setModalOpen(false);
      setForm(emptyForm);
      await loadMembers();
    }
    setSaving(false);
  }

  function handleBrandChange(brandId: string) {
    const brandName = carBrands.find((brand) => brand.id === brandId)?.name ?? "";
    setSelectedBrandId(brandId);
    setSelectedModelId("");
    setVehicleForm((prev) => ({ ...prev, brand: brandName, model: "" }));
  }

  function handleModelChange(modelId: string) {
    const modelName = carModels.find((model) => model.id === modelId)?.name ?? "";
    setSelectedModelId(modelId);
    setVehicleForm((prev) => ({ ...prev, model: modelName }));
  }

  function openCreateVehicle(customerId?: string) {
    setVehicleForm({
      ...emptyVehicleForm,
      customer_id: customerId ?? "",
      site_id: sites[0]?.id ?? ""
    });
    if (customerId) {
      setVehicleMemberFilter(customerId);
      setActiveTab("vehicles");
    }
    setSelectedBrandId("");
    setSelectedModelId("");
    setVehicleModalOpen(true);
  }

  function openEditVehicle(vehicle: VehicleRow) {
    setVehicleForm({
      id: vehicle.id,
      customer_id: vehicle.customer_id,
      site_id: vehicle.site_id,
      plate_no: vehicle.plate_no,
      brand: vehicle.brand ?? "",
      model: vehicle.model ?? "",
      year: vehicle.year ? String(vehicle.year) : "",
      current_mileage: vehicle.current_mileage ? String(vehicle.current_mileage) : "",
      active: vehicle.active
    });
    const brandId =
      carBrands.find((brand) => brand.name.toLowerCase() === (vehicle.brand ?? "").trim().toLowerCase())?.id ?? "";
    const modelId =
      carModels.find(
        (model) =>
          model.brand_id === brandId &&
          model.name.toLowerCase() === (vehicle.model ?? "").trim().toLowerCase()
      )?.id ?? "";
    setSelectedBrandId(brandId);
    setSelectedModelId(modelId);
    setVehicleModalOpen(true);
  }

  async function handleSaveVehicle() {
    if (!supabase) return;
    if (!vehicleForm.customer_id || !vehicleForm.site_id || !vehicleForm.plate_no.trim()) {
      setError("กรุณาเลือกลูกค้า ไซต์ และทะเบียนรถ");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const payload = {
      customer_id: vehicleForm.customer_id,
      site_id: vehicleForm.site_id,
      plate_no: vehicleForm.plate_no.trim(),
      brand: vehicleForm.brand.trim() || null,
      model: vehicleForm.model.trim() || null,
      year: vehicleForm.year ? Number(vehicleForm.year) : null,
      current_mileage: vehicleForm.current_mileage ? Number(vehicleForm.current_mileage) : null,
      active: vehicleForm.active,
      updated_at: new Date().toISOString()
    };
    if (vehicleForm.id) {
      const { error: updateError } = await supabase.from("customer_vehicles").update(payload).eq("id", vehicleForm.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess("อัปเดตรถลูกค้าเรียบร้อย");
        setVehicleModalOpen(false);
        setVehicleForm(emptyVehicleForm);
        await loadVehicles();
      }
    } else {
      const { error: insertError } = await supabase.from("customer_vehicles").insert(payload);
      if (insertError) {
        setError(insertError.message);
      } else {
        setSuccess("เพิ่มรถลูกค้าเรียบร้อย");
        setVehicleModalOpen(false);
        setVehicleForm(emptyVehicleForm);
        await loadVehicles();
      }
    }
    setSaving(false);
  }

  async function handleDeleteVehicle(vehicle: VehicleRow) {
    if (!supabase) return;
    if (!confirm(`ลบรถทะเบียน ${vehicle.plate_no} ใช่หรือไม่`)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error: deleteError } = await supabase.from("customer_vehicles").delete().eq("id", vehicle.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("ลบรถลูกค้าเรียบร้อย");
      await loadVehicles();
    }
    setSaving(false);
  }

  return (
    <div className="page active">
      <div className="toolbar" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={`btn ${activeTab === "members" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("members")}
          >
            ข้อมูลสมาชิก
          </button>
          <button
            className={`btn ${activeTab === "vehicles" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab("vehicles")}
          >
            รถลูกค้า
          </button>
        </div>
        <select className="filter-select" value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
          <option value="all">ทุกกลุ่ม</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <div className="search-bar" style={{ maxWidth: 220 }}>
          <input
            placeholder="ค้นหาชื่อ/อีเมล/เบอร์/LINE"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-ghost"
          onClick={() => {
            void loadMembers();
            void loadVehicles();
          }}
        >
          รีเฟรช
        </button>
        <button className="btn btn-primary" onClick={openCreate}>
          เพิ่มสมาชิก
        </button>
      </div>

      <ActionFeedback
        error={error}
        success={success}
        onClearError={() => setError(null)}
        onClearSuccess={() => setSuccess(null)}
      />

      {activeTab === "members" && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ลูกค้า</th>
                  <th>LINE ID</th>
                  <th>อีเมล</th>
                  <th>โทร</th>
                  <th>ที่อยู่</th>
                  <th>กลุ่ม</th>
                  <th>สร้างเมื่อ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ color: "var(--text3)" }}>
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ color: "var(--text3)" }}>
                      ไม่พบข้อมูลสมาชิก
                    </td>
                  </tr>
                ) : (
                  memberPagination.paginatedRows.map((member) => (
                    <tr key={member.id}>
                      <td>{member.display_name || member.full_name || "-"}</td>
                      <td className="mono" style={{ color: "var(--text2)" }}>
                        {member.line_user_id || "-"}
                      </td>
                      <td className="mono" style={{ color: "var(--text2)" }}>
                        {member.email || "-"}
                      </td>
                      <td className="mono" style={{ color: "var(--text2)" }}>
                        {member.phone || "-"}
                      </td>
                      <td style={{ maxWidth: 220, whiteSpace: "pre-wrap" }}>
                        {member.address || "-"}
                      </td>
                      <td>
                        <span className="tier-label t-member">{member.customer_groups?.name || "-"}</span>
                      </td>
                      <td style={{ color: "var(--text3)" }}>
                        {member.created_at ? new Date(member.created_at).toLocaleDateString("th-TH") : "-"}
                      </td>
                      <td style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => openCreateVehicle(member.id)}
                        >
                          รถ {memberVehicleCountMap.get(member.id) ?? 0}
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => openEdit(member)}
                        >
                          แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePaginationControls
            page={memberPagination.page}
            totalPages={memberPagination.totalPages}
            pageSize={memberPagination.pageSize}
            totalItems={memberPagination.totalItems}
            onPageChange={memberPagination.setPage}
            onPageSizeChange={memberPagination.setPageSize}
          />
        </div>
      )}

      {activeTab === "vehicles" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-head">
            <span className="card-title">รถลูกค้า (Member 1 : M Car)</span>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                className="filter-select"
                value={vehicleMemberFilter}
                onChange={(event) => setVehicleMemberFilter(event.target.value)}
                style={{ width: 220 }}
              >
                <option value="all">สมาชิกทั้งหมด</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name || member.full_name || member.email || member.id}
                  </option>
                ))}
              </select>
              <div className="search-bar" style={{ width: 240 }}>
                <input
                  placeholder="ค้นหาทะเบียน/ลูกค้า/รุ่นรถ"
                  value={vehicleSearch}
                  onChange={(event) => setVehicleSearch(event.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={() => openCreateVehicle()}>
                เพิ่มรถ
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ทะเบียน</th>
                  <th>ลูกค้า</th>
                  <th>ไซต์</th>
                  <th>รถ</th>
                  <th>ไมล์</th>
                  <th>สถานะ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vehiclePagination.paginatedRows.map((vehicle) => {
                  const customer = members.find((member) => member.id === vehicle.customer_id);
                  const site = sites.find((item) => item.id === vehicle.site_id);
                  return (
                    <tr key={vehicle.id}>
                      <td className="mono">{vehicle.plate_no}</td>
                      <td>{customer?.display_name || customer?.full_name || customer?.email || "-"}</td>
                      <td>{site?.name ?? "-"}</td>
                      <td>{[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "-"}</td>
                      <td className="mono">{vehicle.current_mileage?.toLocaleString("th-TH") ?? "-"}</td>
                      <td>
                        <span className={`badge ${vehicle.active ? "paid" : "pending"}`}>
                          {vehicle.active ? "ใช้งาน" : "ไม่ใช้งาน"}
                        </span>
                      </td>
                      <td style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          onClick={() => openEditVehicle(vehicle)}
                        >
                          แก้ไข
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                          onClick={() => void handleDeleteVehicle(vehicle)}
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredVehicles.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} style={{ color: "var(--text3)" }}>
                      ไม่พบข้อมูลรถลูกค้า
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePaginationControls
            page={vehiclePagination.page}
            totalPages={vehiclePagination.totalPages}
            pageSize={vehiclePagination.pageSize}
            totalItems={vehiclePagination.totalItems}
            onPageChange={vehiclePagination.setPage}
            onPageSizeChange={vehiclePagination.setPageSize}
          />
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">{form.id ? "แก้ไขสมาชิก" : "เพิ่มสมาชิก"}</div>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ปิด
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-grid">
                {form.id && (
                  <div>
                    <label className="auth-label">Customer ID</label>
                    <input className="auth-input" value={form.id} disabled />
                  </div>
                )}
                <div>
                  <label className="auth-label">LINE Msg User ID</label>
                  <input
                    className="auth-input"
                    value={form.line_msg_user_id}
                    onChange={(e) => setForm({ ...form, line_msg_user_id: e.target.value })}
                    placeholder="เช่น Uxxxxxxxx (ใช้ส่ง LINE API)"
                  />
                </div>
                <div>
                  <label className="auth-label">LINE User ID (Login/Webhook)</label>
                  <input
                    className="auth-input"
                    value={form.line_user_id}
                    onChange={(e) => setForm({ ...form, line_user_id: e.target.value })}
                    placeholder="เช่น Uxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="auth-label">ชื่อที่แสดง</label>
                  <input
                    className="auth-input"
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
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
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="auth-label">ที่อยู่</label>
                  <textarea
                    className="auth-input"
                    rows={3}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    style={{ width: "100%", resize: "vertical" }}
                  />
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

                {form.id && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="auth-label">ทดสอบส่ง LINE Message</label>
                    <textarea
                      className="auth-input"
                      rows={3}
                      value={lineTestMessage}
                      onChange={(e) => setLineTestMessage(e.target.value)}
                      placeholder="พิมพ์ข้อความสำหรับทดสอบส่ง LINE"
                      style={{ width: "100%", resize: "vertical" }}
                    />
                    <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ color: "var(--text3)", fontSize: 12 }}>
                        ระบบจะส่งไปที่ LINE Msg User ID: {form.line_msg_user_id || "-"}
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void handleSendLineTest()}
                        disabled={lineTesting || saving}
                      >
                        {lineTesting ? "กำลังส่ง..." : "ทดสอบส่ง LINE"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ยกเลิก
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {vehicleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 760 }}>
            <div className="modal-head">
              <div className="modal-title">{vehicleForm.id ? "แก้ไขรถลูกค้า" : "เพิ่มรถลูกค้า"}</div>
              <button className="btn btn-ghost" onClick={() => setVehicleModalOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-grid">
                <div>
                  <label className="auth-label">ลูกค้า</label>
                  <select
                    className="filter-select"
                    value={vehicleForm.customer_id}
                    onChange={(event) => setVehicleForm((prev) => ({ ...prev, customer_id: event.target.value }))}
                  >
                    <option value="">เลือกลูกค้า</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.display_name || member.full_name || member.email || member.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="auth-label">ไซต์</label>
                  <select
                    className="filter-select"
                    value={vehicleForm.site_id}
                    onChange={(event) => setVehicleForm((prev) => ({ ...prev, site_id: event.target.value }))}
                  >
                    <option value="">เลือกไซต์</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="auth-label">ทะเบียนรถ</label>
                  <input
                    className="auth-input"
                    value={vehicleForm.plate_no}
                    onChange={(event) => setVehicleForm((prev) => ({ ...prev, plate_no: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="auth-label">ยี่ห้อรถ</label>
                  <select className="filter-select" value={selectedBrandId} onChange={(event) => handleBrandChange(event.target.value)}>
                    <option value="">เลือกยี่ห้อ</option>
                    {carBrands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="auth-label">รุ่นรถ</label>
                  <select
                    className="filter-select"
                    value={selectedModelId}
                    onChange={(event) => handleModelChange(event.target.value)}
                    disabled={!selectedBrandId}
                  >
                    <option value="">{selectedBrandId ? "เลือกรุ่น" : "เลือกยี่ห้อก่อน"}</option>
                    {visibleCarModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="auth-label">ปี</label>
                  <input
                    className="auth-input"
                    type="number"
                    value={vehicleForm.year}
                    onChange={(event) => setVehicleForm((prev) => ({ ...prev, year: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="auth-label">เลขไมล์ปัจจุบัน</label>
                  <input
                    className="auth-input"
                    type="number"
                    value={vehicleForm.current_mileage}
                    onChange={(event) => setVehicleForm((prev) => ({ ...prev, current_mileage: event.target.value }))}
                  />
                </div>
                <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 22 }}>
                  <input
                    type="checkbox"
                    checked={vehicleForm.active}
                    onChange={(event) => setVehicleForm((prev) => ({ ...prev, active: event.target.checked }))}
                    style={{ width: 16 }}
                  />
                  เปิดใช้งานรถคันนี้
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setVehicleModalOpen(false)}>
                ยกเลิก
              </button>
              <button className="btn btn-primary" onClick={() => void handleSaveVehicle()} disabled={saving}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
