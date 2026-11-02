"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";

type TechnicianRow = { id: string; full_name: string };

type AppointmentRow = {
  id: string;
  scheduled_at: string;
  job_duration_minutes: number;
  status: "waiting" | "in_progress" | "done" | "missed" | "cancelled";
  vehicle_plate: string | null;
  order_id: string;
  technician_id: string | null;
  orders?:
    | {
        order_no: string | null;
        customer_id: string | null;
        customer_phone?: string | null;
      }
    | {
        order_no: string | null;
        customer_id: string | null;
        customer_phone?: string | null;
      }[]
    | null;
  technicians?: { id: string; full_name: string | null } | null;
  productLabel: string;
  itemCount: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  customerSigned: boolean;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  quantity: number;
  skus?: {
    size_label: string | null;
    products?: { brand: string | null; name: string | null } | null;
  } | null;
};

type CustomerRow = {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  location?: string | null;
};

type ChecklistTemplateRow = {
  id: string;
  section_name?: string | null;
  response_mode?: string | null;
  response_options?: string[] | null;
};

type InspectionFormRow = {
  appointment_id: string;
  customer_sign: string | null;
  plate_no: string | null;
  car_model: string | null;
  mileage_km: string | null;
  technician_note: string | null;
  receive_time: string | null;
  finish_time: string | null;
  battery_voltage: string | null;
  tire_fl: string | null;
  tire_fr: string | null;
  tire_rl: string | null;
  tire_rr: string | null;
  tire_target_psi: string | null;
};

type ExecutionReportItemRow = {
  id: string;
  source_type: "order_item" | "extra";
  source_id: string | null;
  label: string;
  is_checked: boolean;
  note: string | null;
  sort_order: number;
};

type ReportChecklistItem = {
  source_type: "order_item" | "extra";
  source_id: string | null;
  section_name: string;
  response_mode: string;
  response_options: string[];
  label: string;
  quantity?: number;
  checked: boolean;
  selected_option: string;
  note: string;
};

type ExecutionReportPhotoRow = {
  id: string;
  photo_url: string;
};

type ExecutionReport = {
  notes: string | null;
  executed_at: string | null;
};

const CHECKLIST_RESULT_PREFIX = "__result__:";

function decodeChecklistNote(rawNote: string | null | undefined): string {
  const source = (rawNote ?? "").trim();
  if (!source.startsWith(CHECKLIST_RESULT_PREFIX)) return source;
  const firstLineBreak = source.indexOf("\n");
  if (firstLineBreak < 0) {
    return source.slice(CHECKLIST_RESULT_PREFIX.length).trim();
  }
  const selectedOption = source.slice(CHECKLIST_RESULT_PREFIX.length, firstLineBreak).trim();
  const note = source.slice(firstLineBreak + 1).trim();
  return [selectedOption, note].filter(Boolean).join(" — ");
}

function splitChecklistNote(rawNote: string | null | undefined): { selectedOption: string; note: string } {
  const source = (rawNote ?? "").trim();
  if (!source.startsWith(CHECKLIST_RESULT_PREFIX)) {
    return { selectedOption: "", note: source };
  }
  const firstLineBreak = source.indexOf("\n");
  if (firstLineBreak < 0) {
    return { selectedOption: source.slice(CHECKLIST_RESULT_PREFIX.length).trim(), note: "" };
  }
  return {
    selectedOption: source.slice(CHECKLIST_RESULT_PREFIX.length, firstLineBreak).trim(),
    note: source.slice(firstLineBreak + 1).trim()
  };
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const STATUS_LABEL: Record<AppointmentRow["status"], string> = {
  waiting: "รอ",
  in_progress: "กำลังติดตั้ง",
  done: "เสร็จแล้ว",
  missed: "พลาดนัด",
  cancelled: "ยกเลิก"
};

const STATUS_CLASS: Record<AppointmentRow["status"], string> = {
  waiting: "badge pending",
  in_progress: "badge process",
  done: "badge paid",
  missed: "badge cancel",
  cancelled: "badge cancel"
};

export default function InstallPage() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
  const [dateFrom, setDateFrom] = useState(() => toDateInputValue(startOfMonth(new Date())));
  const [dateTo, setDateTo] = useState(() => toDateInputValue(endOfMonth(new Date())));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRow, setReportRow] = useState<AppointmentRow | null>(null);
  const [reportItems, setReportItems] = useState<ExecutionReportItemRow[]>([]);
  const [reportPhotos, setReportPhotos] = useState<ExecutionReportPhotoRow[]>([]);
  const [reportInfo, setReportInfo] = useState<ExecutionReport | null>(null);
  const [reportForm, setReportForm] = useState<InspectionFormRow | null>(null);
  const [reportChecklist, setReportChecklist] = useState<ReportChecklistItem[]>([]);

  const rangeLabel = `${new Date(dateFrom).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  })} - ${new Date(dateTo).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  })}`;

  useEffect(() => {
    void loadTechnicians();
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [dateFrom, dateTo]);

  function buildGoogleMapRoute(address: string | null | undefined) {
    if (!address) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
  }

  async function loadTechnicians() {
    if (!supabase) return;
    const { data, error: techError } = await supabase
      .from("technicians")
      .select("id,full_name")
      .order("full_name");
    if (!techError && data) setTechnicians(data as TechnicianRow[]);
  }

  async function loadAppointments() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setError(null);

    const [fromYear, fromMonth, fromDay] = dateFrom.split("-").map(Number);
    const [toYear, toMonth, toDay] = dateTo.split("-").map(Number);
    const start = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0).toISOString();
    const end = new Date(toYear, toMonth - 1, toDay, 23, 59, 59).toISOString();

    const { data: appointData, error: appointError } = await supabase
      .from("install_appointments")
      .select(
        "id,scheduled_at,job_duration_minutes,status,vehicle_plate,order_id,technician_id,orders(order_no,customer_id,customer_phone),technicians(id,full_name)"
      )
      .gte("scheduled_at", start)
      .lte("scheduled_at", end)
      .order("scheduled_at", { ascending: true });

    if (appointError) {
      setError(appointError.message);
      setLoading(false);
      return;
    }

    const appointmentIds = (appointData ?? []).map((row) => row.id);
    const orderIds = (appointData ?? []).map((row) => row.order_id);
    const customerIds = (appointData ?? [])
      .map((row) => {
        const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
        return order?.customer_id ?? null;
      })
      .filter((id): id is string => Boolean(id));
    let customers: CustomerRow[] = [];
    if (customerIds.length) {
      const { data: customerData, error: customerError } = await supabase
        .from("customes")
        .select("id,display_name,full_name,email,phone,address,location")
        .in("id", customerIds);
      if (customerError) {
        setError(customerError.message);
        setLoading(false);
        return;
      }
      customers = (customerData ?? []) as CustomerRow[];
    }
    let itemRows: OrderItemRow[] = [];
    if (orderIds.length) {
      const { data: itemData, error: itemError } = await supabase
        .from("order_items")
        .select("order_id,quantity,skus(size_label,products(brand,name))")
        .in("order_id", orderIds);
      if (!itemError && itemData) itemRows = itemData as unknown as OrderItemRow[];
    }

    let inspectionRows: InspectionFormRow[] = [];
    if (appointmentIds.length) {
      const { data: inspectionData, error: inspectionError } = await supabase
        .from("install_inspection_forms")
        .select("appointment_id,customer_sign")
        .in("appointment_id", appointmentIds);
      if (!inspectionError && inspectionData) inspectionRows = inspectionData as InspectionFormRow[];
    }

    const itemMap = new Map<string, { count: number; label: string }>();
    itemRows.forEach((item) => {
      const existing = itemMap.get(item.order_id) ?? { count: 0, label: "" };
      const product = item.skus?.products;
      const labelParts = [];
      if (product?.brand) labelParts.push(product.brand);
      if (product?.name) labelParts.push(product.name);
      if (item.skus?.size_label) labelParts.push(item.skus.size_label);
      const label = labelParts.join(" ");
      const newLabel = existing.label || label;
      itemMap.set(item.order_id, {
        count: existing.count + (item.quantity ?? 0),
        label: newLabel
      });
    });

    const customerMap = new Map<string, CustomerRow>();
    customers.forEach((customer) => customerMap.set(customer.id, customer));

    const signedMap = new Map<string, boolean>();
    inspectionRows.forEach((row) => {
      signedMap.set(row.appointment_id, Boolean(row.customer_sign && row.customer_sign.startsWith("data:image")));
    });

    const mapped = (appointData ?? []).map((row) => {
      const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
      const itemInfo = itemMap.get(row.order_id);
      const customer =
        order?.customer_id ? customerMap.get(order.customer_id) : null;
      return {
        id: row.id,
        scheduled_at: row.scheduled_at,
        job_duration_minutes: Number(row.job_duration_minutes ?? 120),
        status: row.status,
        vehicle_plate: row.vehicle_plate,
        order_id: row.order_id,
        technician_id: row.technician_id,
        orders: order ?? null,
        technicians: row.technicians ?? null,
        productLabel: itemInfo?.label || "-",
        itemCount: itemInfo?.count ?? 0,
        customer_name: customer?.display_name ?? customer?.full_name ?? customer?.email ?? null,
        customer_phone: order?.customer_phone ?? customer?.phone ?? null,
        customer_address: customer?.address ?? customer?.location ?? null,
        customerSigned: signedMap.get(row.id) ?? false
      } as unknown as AppointmentRow;
    });

    setAppointments(mapped);
    setLoading(false);
  }

  async function openReport(row: AppointmentRow) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setReportRow(row);
    setReportOpen(true);
    setReportLoading(true);
    setReportItems([]);
    setReportPhotos([]);
    setReportInfo(null);
    setReportForm(null);
    setReportChecklist([]);

    const { data: formData } = await supabase
      .from("install_inspection_forms")
      .select(
        "appointment_id,customer_sign,plate_no,car_model,mileage_km,technician_note,receive_time,finish_time,battery_voltage,tire_fl,tire_fr,tire_rl,tire_rr,tire_target_psi"
      )
      .eq("appointment_id", row.id)
      .maybeSingle();
    setReportForm((formData as InspectionFormRow) ?? null);

    const { data: reportData } = await supabase
      .from("install_execution_reports")
      .select("id,notes,executed_at")
      .eq("appointment_id", row.id)
      .maybeSingle();

    if (reportData?.id) {
      setReportInfo({ notes: reportData.notes, executed_at: reportData.executed_at });
      const { data: itemData } = await supabase
        .from("install_execution_report_items")
        .select("id,source_type,source_id,label,is_checked,note,sort_order")
        .eq("report_id", reportData.id)
        .order("sort_order", { ascending: true });
      const items = (itemData as ExecutionReportItemRow[]) ?? [];
      setReportItems(items);

      const { data: photoData } = await supabase
        .from("install_execution_report_photos")
        .select("id,photo_url")
        .eq("report_id", reportData.id);
      setReportPhotos((photoData as ExecutionReportPhotoRow[]) ?? []);

      const orderItemQtyMap = new Map<string, number>();
      const { data: orderItemData } = await supabase
        .from("order_items")
        .select("id,order_id,quantity")
        .eq("order_id", row.order_id);
      ((orderItemData as { id: string; quantity: number }[]) ?? []).forEach((item) => {
        orderItemQtyMap.set(item.id, item.quantity ?? 0);
      });

      const templateIds = items
        .filter((item) => item.source_type === "extra" && item.source_id)
        .map((item) => item.source_id as string);
      const templateMap = new Map<string, ChecklistTemplateRow>();
      if (templateIds.length) {
        const { data: templateData } = await supabase
          .from("install_checklist_items")
          .select("id,section_name,response_mode,response_options")
          .in("id", templateIds);
        ((templateData as ChecklistTemplateRow[]) ?? []).forEach((template) =>
          templateMap.set(template.id, template)
        );
      }

      const checklist: ReportChecklistItem[] = items.map((item) => {
        const { selectedOption, note } = splitChecklistNote(item.note);
        if (item.source_type === "order_item") {
          return {
            source_type: item.source_type,
            source_id: item.source_id,
            section_name: "รายการติดตั้ง",
            response_mode: "pass_fail",
            response_options: ["ผ่าน", "ไม่ผ่าน"],
            label: item.label,
            quantity: item.source_id ? orderItemQtyMap.get(item.source_id) ?? 0 : 0,
            checked: item.is_checked,
            selected_option: selectedOption,
            note
          };
        }
        const template = item.source_id ? templateMap.get(item.source_id) : undefined;
        return {
          source_type: item.source_type,
          source_id: item.source_id,
          section_name: template?.section_name?.trim() || "เช็กลิสต์ทั่วไป",
          response_mode: template?.response_mode?.trim() || "pass_fail",
          response_options:
            Array.isArray(template?.response_options) && template!.response_options!.length > 0
              ? template!.response_options!.map((value) => String(value))
              : ["ปกติ", "ไม่ปกติ"],
          label: item.label,
          checked: item.is_checked,
          selected_option: selectedOption,
          note
        };
      });
      setReportChecklist(checklist);
    }

    setReportLoading(false);
  }

  function closeReport() {
    setReportOpen(false);
    setReportRow(null);
  }

  function openReportPdfPreview() {
    if (!reportRow) return;
    const escapeHtml = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const orderNo =
      (Array.isArray(reportRow.orders) ? reportRow.orders[0]?.order_no : reportRow.orders?.order_no) ?? "-";

    const groupedChecklist = reportChecklist.reduce((acc, item) => {
      const key = item.section_name || "เช็กลิสต์ทั่วไป";
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)?.push(item);
      return acc;
    }, new Map<string, ReportChecklistItem[]>());

    const renderOptions = (item: ReportChecklistItem, fallback: string[]) => {
      const options = item.response_options.length > 0 ? item.response_options : fallback;
      return options
        .map((option, optionIdx) => {
          let checked = item.selected_option ? item.selected_option === option : false;
          if (!item.selected_option) {
            if (item.response_mode === "pass_fail") {
              checked = item.checked ? optionIdx === 0 : optionIdx === 1;
            } else if (item.response_mode === "low_normal_high") {
              checked = item.checked && optionIdx === 1;
            } else {
              checked = item.checked && optionIdx === 0;
            }
          }
          return `<span class="opt ${checked ? "on" : ""}">${checked ? "✓" : "□"} ${escapeHtml(option)}</span>`;
        })
        .join("");
    };

    const fluidRows = (groupedChecklist.get("ระดับสารหล่อลื่น และ สภาพของเหลวต่าง ๆ") ?? [])
      .map(
        (item) => `
        <tr>
          <td class="c-label">${escapeHtml(item.label)}</td>
          <td class="c-opt">${renderOptions(item, ["ต่ำ", "ปกติ", "เกิน"])}</td>
          <td class="c-opt">${renderOptions(item, ["ปกติ", "ไม่ปกติ"])}</td>
        </tr>
      `
      )
      .join("");
    const lightRowsData = groupedChecklist.get("ไฟสัญญาณ และส่องสว่าง") ?? [];
    const lightRows = Array.from({ length: Math.ceil(lightRowsData.length / 3) }, (_, rowIdx) =>
      lightRowsData.slice(rowIdx * 3, rowIdx * 3 + 3)
    )
      .map((row) => {
        const cells = row
          .map(
            (item) => `
          <td>
            <div class="light-title">${escapeHtml(item.label)}</div>
            <div class="c-opt">${renderOptions(item, ["ปกติ", "ไม่ปกติ"])}</div>
          </td>
        `
          )
          .join("");
        return `<tr>${cells}${"<td></td>".repeat(Math.max(0, 3 - row.length))}</tr>`;
      })
      .join("");
    const suspRowsData = groupedChecklist.get("ช่วงล่าง และโช๊คอัพ") ?? [];
    const suspRows = Array.from({ length: Math.ceil(suspRowsData.length / 2) }, (_, rowIdx) =>
      suspRowsData.slice(rowIdx * 2, rowIdx * 2 + 2)
    )
      .map((row) => {
        const renderSuspCell = (item?: ReportChecklistItem) => {
          if (!item) return `<td></td><td></td>`;
          return `
            <td class="c-label">${escapeHtml(item.label)}</td>
            <td class="c-opt">${renderOptions(item, ["ปกติ", "รั่ว", "ชำรุด"])}</td>
          `;
        };
        return `<tr>${renderSuspCell(row[0])}${renderSuspCell(row[1])}</tr>`;
      })
      .join("");
    const batteryItems = groupedChecklist.get("แบตเตอรี่") ?? [];
    const batteryLevelItem = batteryItems.find((item) => item.label.includes("ระดับปริมาณน้ำกลั่น"));
    const batteryTerminalItem = batteryItems.find(
      (item) => item.label.includes("สายขั้ว") || item.label.includes("ปลั๊ก")
    );
    const batteryLevelOptions = batteryLevelItem
      ? renderOptions(batteryLevelItem, ["ปกติ", "ต่ำ"])
      : `<span class="opt">□ ปกติ</span><span class="opt">□ ต่ำ</span>`;
    const batteryTerminalOptions = batteryTerminalItem
      ? renderOptions(batteryTerminalItem, ["ปกติ", "ไม่ปกติ"])
      : `<span class="opt">□ ปกติ</span><span class="opt">□ ไม่ปกติ</span>`;
    const genericSections = ["รายการติดตั้ง", "เช็กลิสต์ทั่วไป"]
      .map((sectionName) => {
        const rows = groupedChecklist.get(sectionName) ?? [];
        if (!rows.length) return "";
        const rowHtml = rows
          .map(
            (item) => `
          <tr>
            <td class="c-label">${escapeHtml(item.label)}${item.quantity ? ` x${item.quantity}` : ""}</td>
            <td class="c-opt">${renderOptions(item, ["ปกติ", "ไม่ปกติ"])}</td>
            <td>${escapeHtml(item.note || "-")}</td>
          </tr>
        `
          )
          .join("");
        return `
          <div class="section">
            <div class="section-title">${escapeHtml(sectionName)}</div>
            <table class="matrix-table">
              <tbody>${rowHtml}</tbody>
            </table>
          </div>
        `;
      })
      .join("");
    const photoBlocks = reportPhotos.map((photo) => `<img src="${photo.photo_url}" class="photo" />`).join("");
    const customerSignHtml = reportForm?.customer_sign?.startsWith("data:image")
      ? `<img src="${reportForm.customer_sign}" alt="customer-signature" style="max-width:100%;max-height:52px;object-fit:contain;" />`
      : "-";
    const technicianSignHtml = escapeHtml(reportRow.technicians?.full_name ?? "-");

    const printWindow = window.open("", "_blank", "width=980,height=1280");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Installation Report - ${orderNo}</title>
          <style>
            @page { size: A4; margin: 6mm; }
            body { font-family: "Sarabun", Arial, sans-serif; color: #173222; background:#eef8ef; margin:0; }
            .toolbar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #c4dfca; padding: 10px; text-align: right; }
            .toolbar button { background:#3f9f61; color:#fff; border:0; border-radius:6px; padding:6px 12px; cursor:pointer; }
            .sheet { width: 196mm; margin: 8px auto 14px; background:#fff; border:1px solid #9dd0a8; }
            .head { background: #7cc98f; color: #fff; padding: 8px 10px; display:flex; justify-content:space-between; align-items:center; }
            .head h2 { margin: 0; font-size: 19px; letter-spacing: 0.1px; }
            .head-sub { font-size: 11px; margin-top: 1px; opacity: 0.95; }
            .head-no { font-size: 20px; font-weight: 700; }
            .section { border-top: 1px solid #b9dfc2; }
            .section-title { background:#d6efdb; color:#26653a; font-weight:700; font-size:11px; padding:5px 8px; }
            .info-wrap { padding:6px; }
            .info-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
            .info-card { background:#e8f3e8; border:1px solid #c5ddc5; border-radius:6px; padding:8px; }
            .info-head { background:#3f853f; color:#fff; text-align:center; font-size:11px; font-weight:700; padding:4px 8px; border-radius:5px; margin-bottom:6px; }
            .i-row { display:grid; grid-template-columns:88px 1fr; align-items:center; gap:6px; margin-bottom:5px; }
            .i-row:last-child { margin-bottom:0; }
            .i-label { font-size:10px; color:#2d5c38; font-weight:600; }
            .i-value { background:#fff; border:1px solid #b9d2bb; border-radius:4px; min-height:22px; display:flex; align-items:center; padding:2px 7px; font-size:10px; }
            .i-time { display:grid; grid-template-columns:1fr auto 1fr; gap:6px; align-items:center; }
            .i-time-sep { font-size:10px; color:#587a61; }
            table { width:100%; border-collapse: collapse; }
            th, td { border: 1px solid #c3dfcb; padding: 5px 6px; font-size: 11px; text-align:left; }
            th { background:#edf8ef; color:#2b6f41; }
            .opt { display:inline-block; margin-right:10px; font-size:11px; color:#325e3f; }
            .opt.on { font-weight:700; color:#1d5730; }
            .matrix-wrap { display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:6px; }
            .matrix-box { border:1px solid #c3dfcb; }
            .matrix-title { background:#7ebd8c; color:#fff; font-size:10px; font-weight:700; padding:4px 7px; text-align:center; }
            .matrix-table { width:100%; border-collapse:collapse; }
            .matrix-table td { border:1px solid #d6eadb; padding:3px 4px; font-size:9px; vertical-align:top; }
            .matrix-table th { border:1px solid #d6eadb; padding:3px 4px; font-size:9px; background:#e3f3e7; color:#2b6f41; }
            .c-label { color:#295c38; font-weight:600; }
            .c-opt { white-space:nowrap; }
            .light-title { color:#295c38; font-size:9px; font-weight:600; margin-bottom:1px; }
            .susp-layout { display:grid; grid-template-columns:1fr 74px; gap:8px; align-items:center; }
            .shock-icon { text-align:center; width:74px; height:74px; margin:0 auto; border-radius:12px; border:1px solid #c9decf; background:#f5fbf6; display:flex; align-items:center; justify-content:center; }
            .shock-img { width:56px; height:56px; object-fit:contain; }
            .battery-card { background:#e8f3e8; border:1px solid #c5ddc5; border-radius:6px; padding:8px; }
            .battery-box { background:#fff; border:1px solid #c3dfcb; border-radius:6px; padding:8px; }
            .battery-icon { text-align:center; font-size:34px; margin-bottom:6px; }
            .battery-row { display:grid; grid-template-columns:110px 1fr; gap:6px; align-items:center; margin-bottom:5px; }
            .battery-label { font-size:10px; color:#2d5c38; font-weight:600; }
            .battery-opts { font-size:10px; white-space:nowrap; }
            .battery-volt { display:flex; align-items:center; gap:6px; margin-top:2px; }
            .battery-volt .vbox { min-width:54px; background:#f7f7f7; border:1px solid #b9d2bb; border-radius:3px; padding:3px 7px; font-size:11px; text-align:center; }
            .tire-box { background:#e8f3e8; border:1px solid #c5ddc5; border-radius:6px; margin:8px; padding:10px; }
            .tire-head { background:#3f853f; color:#fff; text-align:center; font-size:11px; font-weight:700; padding:4px 8px; border-radius:5px; margin-bottom:8px; }
            .tire-layout { display:grid; grid-template-columns: 1.1fr 0.9fr; gap:8px; }
            .tire-left { background:#fff; border:1px solid #c3dfcb; border-radius:6px; padding:10px; }
            .tire-grid { display:grid; grid-template-columns: 1fr 1fr 1fr; align-items:center; gap:8px; }
            .t-item { display:flex; flex-direction:column; gap:4px; align-items:flex-start; }
            .t-item label { font-size:10px; color:#2d5c38; font-weight:600; }
            .t-pill { min-width:50px; background:#f7f7f7; border:1px solid #b9d2bb; border-radius:3px; padding:3px 7px; font-size:11px; text-align:center; }
            .t-car { text-align:center; width:74px; height:74px; margin:0 auto; border-radius:999px; border:1px solid #c9decf; background: radial-gradient(circle at 30% 30%, #ffffff 0%, #edf7ef 70%, #e2f1e6 100%); display:flex; align-items:center; justify-content:center; box-shadow: inset 0 1px 0 rgba(255,255,255,0.8); }
            .t-car-img { width:58px; height:58px; object-fit:contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.15)); }
            .t-spare { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; }
            .t-spare label { font-size:10px; color:#2d5c38; font-weight:600; }
            .tire-right { background:#fff; border:1px solid #c3dfcb; border-radius:6px; padding:10px; }
            .tire-note-label { font-size:10px; color:#2d5c38; font-weight:600; margin-bottom:4px; }
            .tire-note-box { min-height:88px; border:1px solid #b9d2bb; border-radius:4px; background:#fafafa; padding:7px; font-size:10px; white-space:pre-wrap; }
            .note { white-space: pre-wrap; font-size: 10px; line-height: 1.4; padding: 7px; min-height: 44px; }
            .sign { display:grid; grid-template-columns:1fr 1fr; }
            .sign > div { border-top:1px solid #c7e3ce; border-right:1px solid #c7e3ce; padding:7px; min-height:48px; }
            .sign > div:last-child { border-right:0; }
            .sign-title { font-size:10px; color:#4f8e5d; margin-bottom:3px; }
            .sign-name { margin-top:12px; border-top:1px dashed #a7cfb2; padding-top:3px; font-size:10px; color:#3f6f4c; text-align:center; }
            .terms { border-top:1px solid #c7e3ce; background:#edf8ef; padding:6px 8px; font-size:9px; line-height:1.35; color:#376646; }
            .photo-wrap { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; padding:6px; }
            .photo { width:100%; aspect-ratio:1/1; object-fit:cover; border:1px solid #cfe9d5; border-radius:6px; }
            @media print {
              .toolbar { display:none; }
              .sheet { margin:0 auto; border:0; width:100%; }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button onclick="window.print()">พิมพ์ / บันทึก PDF</button>
          </div>
          <div class="sheet">
            <div class="head">
              <div>
                <h2>สวัสดี จิ๊บจิ๊บ</h2>
                <div class="head-sub">ฟอร์มตรวจเช็กและดำเนินการติดตั้งหน้างาน</div>
              </div>
              <div class="head-no">${orderNo}</div>
            </div>
            <div class="section">
              <div class="info-wrap">
                <div class="info-grid2">
                  <div class="info-card">
                    <div class="info-head">ข้อมูลลูกค้า</div>
                    <div class="i-row">
                      <div class="i-label">วันที่:</div>
                      <div class="i-value">${new Date(reportRow.scheduled_at).toLocaleDateString("th-TH")}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">เวลา:</div>
                      <div class="i-time">
                        <div class="i-value">${reportForm?.receive_time || "-"}</div>
                        <div class="i-time-sep">-</div>
                        <div class="i-value">${reportForm?.finish_time || "-"}</div>
                      </div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">ชื่อลูกค้า:</div>
                      <div class="i-value">${reportRow.customer_name ?? "-"}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">ที่อยู่/เปลี่ยนยาง:</div>
                      <div class="i-value">${reportRow.customer_address ?? "-"}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">เบอร์โทร:</div>
                      <div class="i-value">${reportRow.customer_phone ?? "-"}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">เลขที่บิล:</div>
                      <div class="i-value">${orderNo}</div>
                    </div>
                  </div>

                  <div class="info-card">
                    <div class="info-head">ข้อมูลรถ</div>
                    <div class="i-row">
                      <div class="i-label">ทะเบียนรถ:</div>
                      <div class="i-value">${reportForm?.plate_no || reportRow.vehicle_plate || "-"}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">ยี่ห้อรถ:</div>
                      <div class="i-value">${(reportForm?.car_model || "").split(" ")[0] || "-"}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">รุ่นรถ:</div>
                      <div class="i-value">${reportForm?.car_model || "-"}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">เลขไมล์:</div>
                      <div class="i-value">${reportForm?.mileage_km || "-"}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">ระบบเกียร์:</div>
                      <div class="i-value">ออโตเมติก</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="matrix-wrap">
              <div class="matrix-box">
                <div class="matrix-title">ระดับสารหล่อลื่น และ สภาพของเหลวต่าง ๆ</div>
                <table class="matrix-table">
                  <thead>
                    <tr><th style="width:30%;">ประเภท</th><th style="width:40%;">ระดับ</th><th style="width:30%;">สภาพของเหลว</th></tr>
                  </thead>
                  <tbody>${fluidRows || `<tr><td colspan="3">ไม่มีข้อมูล</td></tr>`}</tbody>
                </table>
              </div>
              <div class="matrix-box">
                <div class="matrix-title">ไฟสัญญาณ และ ส่องสว่าง</div>
                <table class="matrix-table">
                  <tbody>${lightRows || `<tr><td>ไม่มีข้อมูล</td><td></td><td></td></tr>`}</tbody>
                </table>
              </div>
              <div class="matrix-box">
                <div class="matrix-title">ช่วงล่าง และ โช๊คอัพ</div>
                <div class="susp-layout">
                  <table class="matrix-table">
                    <tbody>${suspRows || `<tr><td>ไม่มีข้อมูล</td><td></td><td></td><td></td></tr>`}</tbody>
                  </table>
                  <div class="shock-icon">
                    <img src="/assets/shock.jpg" alt="shock" class="shock-img" />
                  </div>
                </div>
              </div>
              <div class="matrix-box">
                <div class="matrix-title">แบตเตอรี่</div>
                <div class="battery-card">
                  <div class="battery-box">
                    <div class="battery-icon">
                      <img src="/assets/betterry.jpg" alt="battery" style="width:56px;height:56px;object-fit:contain;" />
                    </div>
                    <div class="battery-row">
                      <div class="battery-label">ระดับปริมาณน้ำกลั่น:</div>
                      <div class="battery-opts">${batteryLevelOptions}</div>
                    </div>
                    <div class="battery-row">
                      <div class="battery-label">สายขั้ว / ปลั๊กอนนต์:</div>
                      <div class="battery-opts">${batteryTerminalOptions}</div>
                    </div>
                    <div class="battery-volt">
                      <div class="battery-label">แรงดันไฟฟ้า (V):</div>
                      <div class="vbox">${reportForm?.battery_voltage || "-"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="tire-box">
                <div class="tire-head">ลมยาง (PSI)</div>
                <div class="tire-layout">
                  <div class="tire-left">
                    <div class="tire-grid">
                      <div class="t-item">
                        <label>หน้าซ้าย</label>
                        <div class="t-pill">${reportForm?.tire_fl || "-"}</div>
                      </div>
                      <div class="t-car">
                        <img src="/assets/car.jpg" alt="car" class="t-car-img" />
                      </div>
                      <div class="t-item">
                        <label>หน้าขวา</label>
                        <div class="t-pill">${reportForm?.tire_fr || "-"}</div>
                      </div>
                      <div class="t-item">
                        <label>หลังซ้าย</label>
                        <div class="t-pill">${reportForm?.tire_rl || "-"}</div>
                      </div>
                      <div class="t-spare">
                        <label>สำรอง</label>
                        <div class="t-pill">${reportForm?.tire_target_psi || "-"}</div>
                      </div>
                      <div class="t-item">
                        <label>หลังขวา</label>
                        <div class="t-pill">${reportForm?.tire_rr || "-"}</div>
                      </div>
                    </div>
                  </div>
                  <div class="tire-right">
                    <div class="tire-note-label">หมายเหตุยาง:</div>
                    <div class="tire-note-box">${escapeHtml(reportForm?.technician_note || reportInfo?.notes || "-")}</div>
                  </div>
                </div>
              </div>
            </div>
            ${genericSections}

            <div class="section">
              <div class="section-title">บันทึกเพิ่มเติม</div>
              <div class="note">${escapeHtml(
                (reportInfo?.notes || "-") + (reportForm?.technician_note ? `\n\nหมายเหตุช่าง: ${reportForm.technician_note}` : "")
              )}</div>
            </div>

            <div class="section">
              <div class="section-title">ภาพหน้างาน</div>
              ${photoBlocks ? `<div class="photo-wrap">${photoBlocks}</div>` : '<div style="font-size:12px;color:#4f8e5d;padding:8px;">ไม่มีรูปแนบ</div>'}
            </div>

            <div class="section">
              <div class="sign">
                <div class="sign-box">
                  <div class="sign-title">ลายเซ็นช่าง</div>
                  <div>${technicianSignHtml}</div>
                  <div class="sign-name">(ผู้ตรวจสอบ)</div>
                </div>
                <div class="sign-box">
                  <div class="sign-title">ลายเซ็นลูกค้า</div>
                  <div>${customerSignHtml}</div>
                  <div class="sign-name">(เจ้าของรถ / ผู้รับรถ)</div>
                </div>
              </div>
            </div>
            <div class="terms">
              1. โปรดตรวจสอบรายการตรวจเช็กและผลการดำเนินงานให้ครบถ้วนก่อนรับรถ<br/>
              2. กรณีพบความผิดปกติหลังรับบริการ กรุณาติดต่อทีมงานทันที<br/>
              3. เอกสารนี้เป็นหลักฐานการให้บริการ ณ วันและเวลาที่ระบุ
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  }

  const today = new Date();
  const todayCount = appointments.filter((appoint) => {
    const date = new Date(appoint.scheduled_at);
    return date.toDateString() === today.toDateString();
  }).length;
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowCount = appointments.filter((appoint) => {
    const date = new Date(appoint.scheduled_at);
    return date.toDateString() === tomorrow.toDateString();
  }).length;
  const weekCount = appointments.filter((appoint) => {
    const date = new Date(appoint.scheduled_at);
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff < 7;
  }).length;

  const closedCount = useMemo(
    () => appointments.filter((appoint) => appoint.status === "done" && appoint.customerSigned).length,
    [appointments]
  );

  async function handleAssign(appointmentId: string, technicianId: string) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    const { error: updateError } = await supabase
      .from("install_appointments")
      .update({ technician_id: technicianId || null })
      .eq("id", appointmentId);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("บันทึกช่างเรียบร้อย");
      await loadAppointments();
    }
  }

  async function handleStatusChange(appointmentId: string, status: AppointmentRow["status"]) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (status === "done") {
      const target = appointments.find((appoint) => appoint.id === appointmentId);
      if (target && !target.customerSigned) {
        setError("ปิดงานไม่ได้ ช่างยังไม่ได้ให้ลูกค้าเซ็นชื่อรับงาน");
        return;
      }
    }
    const { error: updateError } = await supabase
      .from("install_appointments")
      .update({ status })
      .eq("id", appointmentId);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("อัปเดตสถานะงานเรียบร้อย");
      await loadAppointments();
    }
  }

  async function handleDurationChange(appointmentId: string, minutes: number) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 30 || minutes > 480) {
      setError("ระยะเวลางานต้องอยู่ระหว่าง 30 - 480 นาที");
      return;
    }
    const { error: updateError } = await supabase
      .from("install_appointments")
      .update({ job_duration_minutes: minutes })
      .eq("id", appointmentId);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("อัปเดตระยะเวลางานเรียบร้อย");
      await loadAppointments();
    }
  }

  return (
    <div className="page active">
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        <div
          style={{
            background: "var(--accent-dim)",
            border: "1px solid var(--accent)",
            borderRadius: "var(--radius)",
            padding: "14px 18px",
            flex: 1
          }}
        >
          <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 500, marginBottom: 4 }}>วันนี้</div>
          <div style={{ fontSize: 22, fontWeight: 600 }} className="mono">
            {todayCount} คิว
          </div>
        </div>
        <div
          style={{
            background: "var(--blue-dim)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "14px 18px",
            flex: 1
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500, marginBottom: 4 }}>พรุ่งนี้</div>
          <div style={{ fontSize: 22, fontWeight: 600 }} className="mono">
            {tomorrowCount} คิว
          </div>
        </div>
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "14px 18px",
            flex: 1
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500, marginBottom: 4 }}>สัปดาห์นี้</div>
          <div style={{ fontSize: 22, fontWeight: 600 }} className="mono">
            {weekCount} คิว
          </div>
        </div>
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "14px 18px",
            flex: 1
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500, marginBottom: 4 }}>ปิดงานแล้ว (ช่วงที่เลือก)</div>
          <div style={{ fontSize: 22, fontWeight: 600 }} className="mono">
            {closedCount} / {appointments.length} งาน
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">ตารางนัดติดตั้งทั้งหมด — {rangeLabel}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)" }}>
              ตั้งแต่
              <input
                type="date"
                className="filter-select"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)" }}>
              ถึง
              <input
                type="date"
                className="filter-select"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: "5px 12px" }}
              onClick={() => {
                setDateFrom(toDateInputValue(startOfMonth(new Date())));
                setDateTo(toDateInputValue(endOfMonth(new Date())));
              }}
            >
              เดือนนี้
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }}>พิมพ์</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>วันที่/เวลา</th>
                <th>ลูกค้า</th>
                <th>ออร์เดอร์</th>
                <th>สินค้า</th>
                <th>ระยะเวลา</th>
                <th>ทะเบียน</th>
                <th>ช่าง</th>
                <th>สถานะ</th>
                <th>ปิดงาน</th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} style={{ color: "var(--text3)" }}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ color: "var(--text3)" }}>
                    ไม่มีนัดติดตั้งในช่วงที่เลือก
                  </td>
                </tr>
              ) : (
                appointments.map((row) => (
                  <tr key={row.id}>
                    <td className="mono" style={{ color: "var(--accent)", fontWeight: 500 }}>
                      {new Date(row.scheduled_at).toLocaleDateString("th-TH", {
                        day: "2-digit",
                        month: "short"
                      })}{" "}
                      {new Date(row.scheduled_at).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td>{row.customer_name ?? "-"}</td>
                    <td className="mono" style={{ fontSize: 12, color: "var(--text2)" }}>
                      {(Array.isArray(row.orders) ? row.orders[0]?.order_no : row.orders?.order_no) ?? "-"}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text2)" }}>
                      {row.productLabel} {row.itemCount ? `×${row.itemCount}` : ""}
                    </td>
                    <td>
                      <select
                        className="filter-select"
                        value={row.job_duration_minutes}
                        onChange={(event) =>
                          handleDurationChange(row.id, Number(event.target.value))
                        }
                      >
                        {[60, 90, 120, 150, 180, 210, 240].map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {(minutes / 60).toLocaleString("th-TH")} ชม.
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{row.vehicle_plate ?? "-"}</td>
                    <td>
                      <select
                        className="filter-select"
                        value={row.technician_id ?? ""}
                        onChange={(event) => handleAssign(row.id, event.target.value)}
                      >
                        <option value="">ยังไม่ระบุ</option>
                        {technicians.map((tech) => (
                          <option key={tech.id} value={tech.id}>
                            {tech.full_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={STATUS_CLASS[row.status]}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td>
                      {row.status === "done" ? (
                        row.customerSigned ? (
                          <span className="badge paid">ปิดงานแล้ว (เซ็นแล้ว)</span>
                        ) : (
                          <span className="badge cancel">ปิดงาน (ไม่มีลายเซ็น)</span>
                        )
                      ) : (
                        <span className="badge pending">ยังไม่ปิดงาน</span>
                      )}
                    </td>
                    <td>
                      <select
                        className="filter-select"
                        value={row.status}
                        onChange={(event) =>
                          handleStatusChange(row.id, event.target.value as AppointmentRow["status"])
                        }
                      >
                        {Object.entries(STATUS_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {buildGoogleMapRoute(row.customer_address) ? (
                        <a
                          className="btn btn-ghost"
                          style={{ padding: "4px 10px", fontSize: 12 }}
                          href={buildGoogleMapRoute(row.customer_address) ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                        >
                          นำทาง
                        </a>
                      ) : (
                        <span style={{ color: "var(--text3)", fontSize: 12 }}>ไม่มีที่อยู่</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={() => openReport(row)}
                      >
                        รายงาน
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {reportOpen && reportRow && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 640 }}>
            <div className="modal-head">
              <div className="modal-title">
                รายงานการติดตั้ง — {reportRow.customer_name ?? "-"}{" "}
                {new Date(reportRow.scheduled_at).toLocaleDateString("th-TH", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-ghost"
                  disabled={reportLoading}
                  onClick={openReportPdfPreview}
                >
                  ดูตัวอย่าง PDF
                </button>
                <button className="btn btn-ghost" onClick={closeReport}>
                  ปิด
                </button>
              </div>
            </div>
            <div className="modal-body">
              {reportLoading ? (
                <div style={{ color: "var(--text3)" }}>กำลังโหลด...</div>
              ) : (
                <>
                  <div style={{ marginBottom: 16 }}>
                    {reportRow.status === "done" && reportRow.customerSigned ? (
                      <span className="badge paid">ปิดงานแล้ว (เซ็นแล้ว)</span>
                    ) : reportRow.status === "done" ? (
                      <span className="badge cancel">ปิดงาน (ไม่มีลายเซ็น)</span>
                    ) : (
                      <span className="badge pending">ยังไม่ปิดงาน</span>
                    )}
                  </div>

                  <div style={{ fontWeight: 600, marginBottom: 8 }}>เช็คลิสต์การติดตั้ง</div>
                  {reportItems.length === 0 ? (
                    <div style={{ color: "var(--text3)", marginBottom: 16 }}>ยังไม่มีรายการเช็คลิสต์</div>
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px" }}>
                      {reportItems.map((item) => (
                        <li
                          key={item.id}
                          style={{
                            display: "flex",
                            gap: 8,
                            padding: "6px 0",
                            borderBottom: "1px solid var(--border)"
                          }}
                        >
                          <span>{item.is_checked ? "✅" : "⬜"}</span>
                          <div>
                            <div>{item.label}</div>
                            {decodeChecklistNote(item.note) && (
                              <div style={{ fontSize: 12, color: "var(--text3)" }}>
                                {decodeChecklistNote(item.note)}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {reportInfo?.notes && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>หมายเหตุช่าง</div>
                      <div style={{ fontSize: 13, color: "var(--text2)" }}>{reportInfo.notes}</div>
                    </div>
                  )}

                  {reportPhotos.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>รูปหน้างาน</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {reportPhotos.map((photo) => (
                          <a key={photo.id} href={photo.photo_url} target="_blank" rel="noreferrer">
                            <img
                              src={photo.photo_url}
                              alt="รูปหน้างาน"
                              style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8 }}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>ลายเซ็นลูกค้า</div>
                    {reportForm?.customer_sign?.startsWith("data:image") ? (
                      <img
                        src={reportForm.customer_sign}
                        alt="ลายเซ็นลูกค้า"
                        style={{
                          width: "100%",
                          maxWidth: 320,
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          background: "#fff"
                        }}
                      />
                    ) : (
                      <div style={{ color: "var(--text3)" }}>ยังไม่มีลายเซ็นลูกค้า</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <ActionFeedback
        error={error}
        success={success}
        onClearError={() => setError(null)}
        onClearSuccess={() => setSuccess(null)}
      />
    </div>
  );
}
