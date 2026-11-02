"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import AppDatePicker from "../ui/AppDatePicker";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

type TechnicianRow = {
  id: string;
  full_name: string;
  phone: string | null;
  role: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  member_count?: number;
};

type ProfileUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  technician_id: string | null;
};

type TechnicianWorkSlotRow = {
  id: string;
  technician_id: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  active: boolean;
};

type TechnicianHolidayRow = {
  id: string;
  technician_id: string;
  holiday_date: string;
  note: string | null;
  active: boolean;
};

const EMPTY_FORM = {
  id: "" as string,
  full_name: "",
  phone: "",
  role: "",
  active: true,
  notes: ""
};

const EMPTY_SLOT_FORM = {
  id: "",
  start_time: "09:00",
  end_time: "11:00",
  sort_order: "10",
  active: true
};

const EMPTY_HOLIDAY_FORM = {
  id: "",
  holiday_date: "",
  note: "",
  active: true
};

const DEFAULT_SLOT_PRESETS = [
  { start_time: "09:00", end_time: "11:00", sort_order: 10 },
  { start_time: "11:00", end_time: "13:00", sort_order: 20 },
  { start_time: "13:00", end_time: "15:00", sort_order: 30 },
  { start_time: "15:00", end_time: "17:00", sort_order: 40 }
];

function toTimeInput(value: string) {
  return value.slice(0, 5);
}

export default function TechniciansPage() {
  const [techs, setTechs] = useState<TechnicianRow[]>([]);
  const [profileUsers, setProfileUsers] = useState<ProfileUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assignTeamId, setAssignTeamId] = useState("");
  const [assignTeamName, setAssignTeamName] = useState("");
  const [scheduleTeamId, setScheduleTeamId] = useState("");
  const [scheduleTeamName, setScheduleTeamName] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT_FORM);
  const [holidayForm, setHolidayForm] = useState(EMPTY_HOLIDAY_FORM);
  const [workSlots, setWorkSlots] = useState<TechnicianWorkSlotRow[]>([]);
  const [holidays, setHolidays] = useState<TechnicianHolidayRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [search, setSearch] = useState("");

  const hasSupabase = useMemo(() => Boolean(supabase), []);

  async function loadTechs() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    const [{ data, error: fetchError }, { data: memberRows, error: memberError }] = await Promise.all([
      supabase
        .from("technicians")
        .select("id,full_name,phone,role,active,notes,created_at,updated_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("technician_id")
        .not("technician_id", "is", null)
    ]);

    if (fetchError) {
      setError(fetchError.message);
    } else if (memberError) {
      setError(memberError.message);
    } else {
      const countMap = new Map<string, number>();
      (memberRows ?? []).forEach((row) => {
        const technicianId = (row as { technician_id?: string | null }).technician_id;
        if (!technicianId) return;
        countMap.set(technicianId, (countMap.get(technicianId) ?? 0) + 1);
      });
      const enriched = ((data ?? []) as TechnicianRow[]).map((team) => ({
        ...team,
        member_count: countMap.get(team.id) ?? 0
      }));
      setTechs(enriched);
    }
    setLoading(false);
  }

  async function loadProfileUsers() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("id,full_name,email,phone,role,technician_id")
      .order("full_name", { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setProfileUsers((data ?? []) as ProfileUserRow[]);
  }

  useEffect(() => {
    void loadTechs();
    void loadProfileUsers();
  }, []);

  const filteredTechs = useMemo(() => {
    if (!search.trim()) return techs;
    const keyword = search.toLowerCase();
    return techs.filter((tech) =>
      [tech.full_name, tech.phone, tech.role, tech.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [techs, search]);

  const {
    page,
    pageSize,
    totalPages,
    totalItems,
    paginatedRows,
    setPage,
    setPageSize
  } = useTablePagination(filteredTechs, 10);

  function openModal(row?: TechnicianRow) {
    if (row) {
      setForm({
        id: row.id,
        full_name: row.full_name,
        phone: row.phone ?? "",
        role: row.role ?? "",
        active: row.active,
        notes: row.notes ?? ""
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setModalOpen(true);
  }

  function openAssignModal(team: TechnicianRow) {
    setAssignTeamId(team.id);
    setAssignTeamName(team.full_name);
    setSelectedUserId("");
    setAssignOpen(true);
  }

  async function loadTeamSchedules(technicianId: string) {
    if (!supabase || !technicianId) return;
    setScheduleLoading(true);
    const [{ data: slotData, error: slotError }, { data: holidayData, error: holidayError }] =
      await Promise.all([
        supabase
          .from("technician_work_slots")
          .select("id,technician_id,start_time,end_time,sort_order,active")
          .eq("technician_id", technicianId)
          .order("sort_order", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("technician_holidays")
          .select("id,technician_id,holiday_date,note,active")
          .eq("technician_id", technicianId)
          .order("holiday_date", { ascending: false })
      ]);
    if (slotError) {
      setError(slotError.message);
    } else if (holidayError) {
      setError(holidayError.message);
    } else {
      setWorkSlots((slotData ?? []) as TechnicianWorkSlotRow[]);
      setHolidays((holidayData ?? []) as TechnicianHolidayRow[]);
    }
    setScheduleLoading(false);
  }

  function openScheduleModal(team: TechnicianRow) {
    setScheduleTeamId(team.id);
    setScheduleTeamName(team.full_name);
    setSlotForm(EMPTY_SLOT_FORM);
    setHolidayForm(EMPTY_HOLIDAY_FORM);
    setWorkSlots([]);
    setHolidays([]);
    setScheduleOpen(true);
    void loadTeamSchedules(team.id);
  }

  function closeScheduleModal() {
    setScheduleOpen(false);
    setScheduleTeamId("");
    setScheduleTeamName("");
    setSlotForm(EMPTY_SLOT_FORM);
    setHolidayForm(EMPTY_HOLIDAY_FORM);
    setWorkSlots([]);
    setHolidays([]);
  }

  function editSlot(row: TechnicianWorkSlotRow) {
    setSlotForm({
      id: row.id,
      start_time: toTimeInput(row.start_time),
      end_time: toTimeInput(row.end_time),
      sort_order: String(row.sort_order ?? 0),
      active: row.active
    });
  }

  async function saveSlot() {
    if (!supabase || !scheduleTeamId) return;
    if (!slotForm.start_time || !slotForm.end_time) {
      setError("กรุณาระบุช่วงเวลาเริ่มและสิ้นสุด");
      return;
    }
    if (slotForm.start_time >= slotForm.end_time) {
      setError("เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด");
      return;
    }
    const sortOrder = Number(slotForm.sort_order || 0);
    if (!Number.isFinite(sortOrder)) {
      setError("ลำดับไม่ถูกต้อง");
      return;
    }
    setSavingSlot(true);
    setError(null);
    setSuccess(null);
    if (slotForm.id) {
      const { error: updateError } = await supabase
        .from("technician_work_slots")
        .update({
          start_time: `${slotForm.start_time}:00`,
          end_time: `${slotForm.end_time}:00`,
          sort_order: sortOrder,
          active: slotForm.active,
          updated_at: new Date().toISOString()
        })
        .eq("id", slotForm.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess("อัปเดตช่วงเวลาทำงานเรียบร้อย");
        setSlotForm(EMPTY_SLOT_FORM);
        await loadTeamSchedules(scheduleTeamId);
      }
    } else {
      const { error: insertError } = await supabase.from("technician_work_slots").insert({
        technician_id: scheduleTeamId,
        start_time: `${slotForm.start_time}:00`,
        end_time: `${slotForm.end_time}:00`,
        sort_order: sortOrder,
        active: slotForm.active,
        updated_at: new Date().toISOString()
      });
      if (insertError) {
        setError(insertError.message);
      } else {
        setSuccess("เพิ่มช่วงเวลาทำงานเรียบร้อย");
        setSlotForm(EMPTY_SLOT_FORM);
        await loadTeamSchedules(scheduleTeamId);
      }
    }
    setSavingSlot(false);
  }

  async function addDefaultSlots() {
    if (!supabase || !scheduleTeamId) return;
    setSavingSlot(true);
    setError(null);
    setSuccess(null);
    const payload = DEFAULT_SLOT_PRESETS.map((slot) => ({
      technician_id: scheduleTeamId,
      start_time: `${slot.start_time}:00`,
      end_time: `${slot.end_time}:00`,
      sort_order: slot.sort_order,
      active: true,
      updated_at: new Date().toISOString()
    }));
    const { error: upsertError } = await supabase
      .from("technician_work_slots")
      .upsert(payload, { onConflict: "technician_id,start_time,end_time" });
    if (upsertError) {
      setError(upsertError.message);
    } else {
      setSuccess("เพิ่มช่วงเวลามาตรฐานเรียบร้อย");
      await loadTeamSchedules(scheduleTeamId);
    }
    setSavingSlot(false);
  }

  async function deleteSlot(row: TechnicianWorkSlotRow) {
    if (!supabase || !scheduleTeamId) return;
    if (!confirm(`ลบช่วงเวลา ${toTimeInput(row.start_time)}-${toTimeInput(row.end_time)} ใช่หรือไม่`)) return;
    setSavingSlot(true);
    setError(null);
    setSuccess(null);
    const { error: deleteError } = await supabase.from("technician_work_slots").delete().eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("ลบช่วงเวลาทำงานเรียบร้อย");
      if (slotForm.id === row.id) setSlotForm(EMPTY_SLOT_FORM);
      await loadTeamSchedules(scheduleTeamId);
    }
    setSavingSlot(false);
  }

  function editHoliday(row: TechnicianHolidayRow) {
    setHolidayForm({
      id: row.id,
      holiday_date: row.holiday_date,
      note: row.note ?? "",
      active: row.active
    });
  }

  async function saveHoliday() {
    if (!supabase || !scheduleTeamId) return;
    if (!holidayForm.holiday_date) {
      setError("กรุณาเลือกวันหยุด");
      return;
    }
    setSavingHoliday(true);
    setError(null);
    setSuccess(null);
    if (holidayForm.id) {
      const { error: updateError } = await supabase
        .from("technician_holidays")
        .update({
          holiday_date: holidayForm.holiday_date,
          note: holidayForm.note.trim() || null,
          active: holidayForm.active,
          updated_at: new Date().toISOString()
        })
        .eq("id", holidayForm.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess("อัปเดตวันหยุดเรียบร้อย");
        setHolidayForm(EMPTY_HOLIDAY_FORM);
        await loadTeamSchedules(scheduleTeamId);
      }
    } else {
      const { error: insertError } = await supabase.from("technician_holidays").insert({
        technician_id: scheduleTeamId,
        holiday_date: holidayForm.holiday_date,
        note: holidayForm.note.trim() || null,
        active: holidayForm.active,
        updated_at: new Date().toISOString()
      });
      if (insertError) {
        setError(insertError.message);
      } else {
        setSuccess("เพิ่มวันหยุดเรียบร้อย");
        setHolidayForm(EMPTY_HOLIDAY_FORM);
        await loadTeamSchedules(scheduleTeamId);
      }
    }
    setSavingHoliday(false);
  }

  async function deleteHoliday(row: TechnicianHolidayRow) {
    if (!supabase || !scheduleTeamId) return;
    if (!confirm(`ลบวันหยุด ${new Date(row.holiday_date).toLocaleDateString("th-TH")} ใช่หรือไม่`)) return;
    setSavingHoliday(true);
    setError(null);
    setSuccess(null);
    const { error: deleteError } = await supabase.from("technician_holidays").delete().eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("ลบวันหยุดเรียบร้อย");
      if (holidayForm.id === row.id) setHolidayForm(EMPTY_HOLIDAY_FORM);
      await loadTeamSchedules(scheduleTeamId);
    }
    setSavingHoliday(false);
  }

  async function handleAddUserToTeam() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!selectedUserId) {
      setError("กรุณาเลือกผู้ใช้งาน");
      return;
    }
    if (!assignTeamId) {
      setError("ไม่พบทีมช่าง");
      return;
    }
    const selected = profileUsers.find((user) => user.id === selectedUserId);
    if (!selected) {
      setError("ไม่พบข้อมูลผู้ใช้งาน");
      return;
    }
    if (selected.technician_id === assignTeamId) {
      setError("ผู้ใช้งานนี้อยู่ในทีมนี้แล้ว");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ technician_id: assignTeamId, role: selected.role ?? "staff" })
      .eq("id", selected.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("เพิ่มผู้ใช้งานเข้าทีมช่างเรียบร้อย");
      setAssignOpen(false);
      setAssignTeamId("");
      setAssignTeamName("");
      await loadProfileUsers();
      await loadTechs();
    }
    setLoading(false);
  }

  const availableUsers = useMemo(() => {
    if (!assignTeamId) return [];
    return profileUsers.filter((user) => user.technician_id !== assignTeamId);
  }, [profileUsers, assignTeamId]);

  const teamMembers = useMemo(() => {
    if (!assignTeamId) return [];
    return profileUsers.filter((user) => user.technician_id === assignTeamId);
  }, [profileUsers, assignTeamId]);

  async function handleRemoveUserFromTeam(userId: string) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ technician_id: null })
      .eq("id", userId);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("นำผู้ใช้งานออกจากทีมช่างเรียบร้อย");
      await loadProfileUsers();
      await loadTechs();
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!form.full_name.trim()) {
      setError("กรุณากรอกชื่อช่าง");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    if (form.id) {
      const { error: updateError } = await supabase
        .from("technicians")
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          role: form.role.trim() || null,
          active: form.active,
          notes: form.notes.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", form.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess("อัปเดตข้อมูลทีมช่างเรียบร้อย");
        setModalOpen(false);
        await loadTechs();
      }
    } else {
      const { error: insertError } = await supabase.from("technicians").insert({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        role: form.role.trim() || null,
        active: form.active,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString()
      });
      if (insertError) {
        setError(insertError.message);
      } else {
        setSuccess("เพิ่มทีมช่างเรียบร้อย");
        setModalOpen(false);
        await loadTechs();
      }
    }
    setLoading(false);
  }

  async function handleDelete(row: TechnicianRow) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!confirm(`ลบช่าง ${row.full_name} ใช่หรือไม่`)) return;
    setLoading(true);
    setError(null);
    const { error: deleteError } = await supabase.from("technicians").delete().eq("id", row.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("ลบข้อมูลทีมช่างเรียบร้อย");
      await loadTechs();
    }
    setLoading(false);
  }

  return (
    <div className="page active">
      <div className="toolbar" style={{ marginBottom: 18 }}>
        <div className="search-bar" style={{ width: 240 }}>
          <input
            placeholder="ค้นหาช่าง..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => openModal()}>
          เพิ่มทีมช่าง
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
                <th>ชื่อช่าง</th>
                <th>จำนวนช่าง</th>
                <th>เบอร์โทร</th>
                <th>ตำแหน่ง/ทีม</th>
                <th>สถานะ</th>
                <th>อัปเดตล่าสุด</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((tech) => (
                <tr key={tech.id}>
                  <td>{tech.full_name}</td>
                  <td className="mono">{tech.member_count ?? 0}</td>
                  <td className="mono" style={{ color: "var(--text2)" }}>
                    {tech.phone ?? "-"}
                  </td>
                  <td>{tech.role ?? "-"}</td>
                  <td>
                    <span className={`badge ${tech.active ? "paid" : "pending"}`}>
                      {tech.active ? "พร้อมงาน" : "พักงาน"}
                    </span>
                  </td>
                  <td style={{ color: "var(--text3)" }}>
                    {new Date(tech.updated_at ?? tech.created_at).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric"
                    })}
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => openAssignModal(tech)}
                    >
                      จัดการช่าง
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => openScheduleModal(tech)}
                    >
                      เวลาทำงาน/วันหยุด
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => openModal(tech)}
                    >
                      แก้ไข
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                      onClick={() => handleDelete(tech)}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredTechs.length && !loading && (
                <tr>
                  <td colSpan={7} style={{ color: "var(--text3)", padding: 16 }}>
                    ยังไม่มีทีมช่างในระบบ
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
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">{form.id ? "แก้ไขทีมช่าง" : "เพิ่มทีมช่าง"}</div>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-grid">
                <label>
                  ชื่อช่าง
                  <input
                    value={form.full_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                    placeholder="เช่น สมชาย ช่างดี"
                  />
                </label>
                <label>
                  เบอร์โทร
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="เช่น 0812345678"
                  />
                </label>
                <label>
                  ตำแหน่ง/ทีม
                  <input
                    value={form.role}
                    onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                    placeholder="เช่น ทีมติดตั้ง A"
                  />
                </label>
                <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                    style={{ width: 16 }}
                  />
                  พร้อมรับงาน
                </label>
                <label>
                  หมายเหตุ
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="เช่น เชี่ยวชาญยางรถบรรทุก"
                    rows={3}
                  />
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ยกเลิก
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!hasSupabase || loading}>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 1080 }}>
            <div className="modal-head">
              <div className="modal-title">กำหนดช่วงเวลาทำงานและวันหยุด: {scheduleTeamName}</div>
              <button className="btn btn-ghost" onClick={closeScheduleModal}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div className="grid2" style={{ alignItems: "start" }}>
                <div className="card">
                  <div className="card-head">
                    <span className="card-title">ช่วงเวลาทำงาน </span>
                  </div>
                  <div className="card-body">
                    <div className="modal-grid">
                      <label>
                        เวลาเริ่ม
                        <input
                          type="time"
                          value={slotForm.start_time}
                          onChange={(event) => setSlotForm((prev) => ({ ...prev, start_time: event.target.value }))}
                        />
                      </label>
                      <label>
                        เวลาสิ้นสุด
                        <input
                          type="time"
                          value={slotForm.end_time}
                          onChange={(event) => setSlotForm((prev) => ({ ...prev, end_time: event.target.value }))}
                        />
                      </label>
                      <label>
                        ลำดับ
                        <input
                          type="number"
                          value={slotForm.sort_order}
                          onChange={(event) => setSlotForm((prev) => ({ ...prev, sort_order: event.target.value }))}
                        />
                      </label>
                      <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 22 }}>
                        <input
                          type="checkbox"
                          checked={slotForm.active}
                          onChange={(event) => setSlotForm((prev) => ({ ...prev, active: event.target.checked }))}
                          style={{ width: 16 }}
                        />
                        เปิดใช้งาน
                      </label>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button className="btn btn-ghost" onClick={() => setSlotForm(EMPTY_SLOT_FORM)} disabled={savingSlot}>
                        ล้างฟอร์ม
                      </button>
                      <button className="btn btn-ghost" onClick={() => void addDefaultSlots()} disabled={savingSlot || scheduleLoading}>
                        ใส่ช่วงเวลามาตรฐาน
                      </button>
                      <button className="btn btn-primary" onClick={() => void saveSlot()} disabled={savingSlot || scheduleLoading}>
                        {savingSlot ? "กำลังบันทึก..." : slotForm.id ? "อัปเดตช่วงเวลา" : "เพิ่มช่วงเวลา"}
                      </button>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--text3)" }}>
                      ตัวอย่างช่วงเวลา: 09:00-11:00, 11:00-13:00, 13:00-15:00, 15:00-17:00
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-head">
                    <span className="card-title">วันหยุด</span>
                  </div>
                  <div className="card-body">
                    <div className="modal-grid">
                      <label>
                        วันที่หยุด
                        <AppDatePicker
                          value={holidayForm.holiday_date}
                          onChange={(value) =>
                            setHolidayForm((prev) => ({ ...prev, holiday_date: value }))
                          }
                        />
                      </label>
                      <label>
                        หมายเหตุ
                        <input
                          value={holidayForm.note}
                          onChange={(event) => setHolidayForm((prev) => ({ ...prev, note: event.target.value }))}
                          placeholder="เช่น วันหยุดนักขัตฤกษ์"
                        />
                      </label>
                      <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 22 }}>
                        <input
                          type="checkbox"
                          checked={holidayForm.active}
                          onChange={(event) =>
                            setHolidayForm((prev) => ({ ...prev, active: event.target.checked }))
                          }
                          style={{ width: 16 }}
                        />
                        เปิดใช้งานวันหยุดนี้
                      </label>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setHolidayForm(EMPTY_HOLIDAY_FORM)}
                        disabled={savingHoliday}
                      >
                        ล้างฟอร์ม
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => void saveHoliday()}
                        disabled={savingHoliday || scheduleLoading}
                      >
                        {savingHoliday ? "กำลังบันทึก..." : holidayForm.id ? "อัปเดตวันหยุด" : "เพิ่มวันหยุด"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid2" style={{ alignItems: "start", marginTop: 12 }}>
                <div className="card">
                  <div className="card-head">
                    <span className="card-title">รายการช่วงเวลาทำงาน</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>ช่วงเวลา</th>
                          <th>ลำดับ</th>
                          <th>สถานะ</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {workSlots.map((slot) => (
                          <tr key={slot.id}>
                            <td className="mono">{toTimeInput(slot.start_time)} - {toTimeInput(slot.end_time)}</td>
                            <td className="mono">{slot.sort_order}</td>
                            <td>
                              <span className={`badge ${slot.active ? "paid" : "pending"}`}>
                                {slot.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                              </span>
                            </td>
                            <td style={{ display: "flex", gap: 6 }}>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: "4px 10px", fontSize: 12 }}
                                onClick={() => editSlot(slot)}
                              >
                                แก้ไข
                              </button>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                                onClick={() => void deleteSlot(slot)}
                              >
                                ลบ
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!workSlots.length && !scheduleLoading && (
                          <tr>
                            <td colSpan={4} style={{ color: "var(--text3)", padding: 12 }}>
                              ยังไม่มีช่วงเวลาทำงาน
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="card-head">
                    <span className="card-title">รายการวันหยุด</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>วันที่</th>
                          <th>หมายเหตุ</th>
                          <th>สถานะ</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {holidays.map((holiday) => (
                          <tr key={holiday.id}>
                            <td className="mono">
                              {new Date(holiday.holiday_date).toLocaleDateString("th-TH", {
                                year: "numeric",
                                month: "short",
                                day: "numeric"
                              })}
                            </td>
                            <td>{holiday.note ?? "-"}</td>
                            <td>
                              <span className={`badge ${holiday.active ? "paid" : "pending"}`}>
                                {holiday.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                              </span>
                            </td>
                            <td style={{ display: "flex", gap: 6 }}>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: "4px 10px", fontSize: 12 }}
                                onClick={() => editHoliday(holiday)}
                              >
                                แก้ไข
                              </button>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                                onClick={() => void deleteHoliday(holiday)}
                              >
                                ลบ
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!holidays.length && !scheduleLoading && (
                          <tr>
                            <td colSpan={4} style={{ color: "var(--text3)", padding: 12 }}>
                              ยังไม่มีวันหยุด
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {assignOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">เพิ่มผู้ใช้งานเข้าทีมช่าง: {assignTeamName}</div>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setAssignOpen(false);
                  setAssignTeamId("");
                  setAssignTeamName("");
                }}
              >
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 12, fontSize: 12, color: "var(--text2)" }}>
                ทีมนี้มีช่างทั้งหมด {teamMembers.length} คน
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ชื่อ</th>
                        <th>อีเมล</th>
                        <th>เบอร์โทร</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member) => (
                        <tr key={member.id}>
                          <td>{member.full_name ?? "-"}</td>
                          <td className="mono" style={{ color: "var(--text2)" }}>
                            {member.email ?? "-"}
                          </td>
                          <td className="mono" style={{ color: "var(--text2)" }}>
                            {member.phone ?? "-"}
                          </td>
                          <td>
                            <button
                              className="btn btn-ghost"
                              style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }}
                              onClick={() => void handleRemoveUserFromTeam(member.id)}
                              disabled={loading}
                            >
                              นำออกจากทีม
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!teamMembers.length && (
                        <tr>
                          <td colSpan={4} style={{ color: "var(--text3)", padding: 12 }}>
                            ยังไม่มีช่างในทีมนี้
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <label>
                เพิ่มผู้ใช้งานเข้าในทีม
                <select
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                >
                  <option value="">เลือกผู้ใช้งาน</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {(user.full_name ?? user.email ?? user.id)} {user.email ? `(${user.email})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {!availableUsers.length && (
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--text3)" }}>
                  ยังไม่มีผู้ใช้งานที่สามารถเพิ่มเข้าทีมช่างได้
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setAssignOpen(false);
                  setAssignTeamId("");
                  setAssignTeamName("");
                }}
              >
                ยกเลิก
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddUserToTeam}
                disabled={!hasSupabase || loading || !selectedUserId}
              >
                เพิ่มเข้าทีม
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
