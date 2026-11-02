"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";

type TechnicianRow = { id: string; full_name: string };
type ProfileScopeRow = { role: string | null; technician_id: string | null };

type AppointmentRow = {
  id: string;
  scheduled_at: string;
  status: "waiting" | "in_progress" | "done" | "missed" | "cancelled";
  order_id: string;
  site_id: string | null;
  technician_id: string | null;
  orders?:
  | {
    order_no: string | null;
    site_id: string | null;
    customer_id: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_address?: string | null;
    cart_id?: string | null;
  }
  | {
    order_no: string | null;
    site_id: string | null;
    customer_id: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_address?: string | null;
    cart_id?: string | null;
  }[]
  | null;
  productLabel: string;
  itemCount: number;
  items: { label: string; quantity: number }[];
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  customer_line_user_id?: string | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  quantity: number;
  sku_id: string;
  skus?: {
    size_label: string | null;
    products?: { brand: string | null; name: string | null } | null;
  } | null;
};

type ChecklistTemplateRow = {
  id: string;
  title: string;
  active: boolean;
  sort_order: number;
  section_name?: string | null;
  response_mode?: string | null;
  response_options?: string[] | null;
  unit_label?: string | null;
};

type ExecutionReportRow = {
  id: string;
  appointment_id: string;
  notes: string | null;
  form_data?: unknown;
};

type ExecutionReportItemRow = {
  source_type: "order_item" | "extra";
  source_id: string | null;
  label: string;
  is_checked: boolean;
  note: string | null;
  sort_order: number;
};

type ExecutionReportPhotoRow = {
  photo_url: string;
};

type InstallChecklistState = {
  source_type: "order_item" | "extra";
  source_id: string | null;
  section_name: string;
  response_mode: string;
  response_options: string[];
  unit_label?: string | null;
  label: string;
  quantity?: number;
  checked: boolean;
  selected_option: string;
  note: string;
  sort_order: number;
};

type CustomerRow = {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  location?: string | null;
  line_user_id?: string | null;
  line_msg_user_id?: string | null;
};

type CartContactRow = {
  id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
};

type SkuOptionRow = {
  id: string;
  sku_code: string | null;
  size_label: string | null;
  products?: { brand: string | null; name: string | null } | null;
};

type CarModelRow = Record<string, unknown>;

type FieldIssueRow = {
  id: string;
  sku_id: string;
  quantity: number;
  reason: string | null;
  created_at: string;
  skus?: {
    sku_code: string | null;
    size_label: string | null;
    products?: { brand: string | null; name: string | null } | null;
  } | null;
};

type InspectionFormData = {
  receive_time: string;
  finish_time: string;
  plate_no: string;
  car_model: string;
  mileage_km: string;
  battery_voltage: string;
  tire_fl: string;
  tire_fr: string;
  tire_rl: string;
  tire_rr: string;
  tire_checked_before: boolean;
  tire_checked_after: boolean;
  tire_target_psi: string;
  technician_note: string;
  customer_sign: string;
  insurance_type: string;
  insurance_expiry_date: string;
  act_expiry_date: string;
  tax_expiry_date: string;
};

type InstallInspectionFormRow = {
  appointment_id: string;
  receive_time: string | null;
  finish_time: string | null;
  plate_no: string | null;
  car_model: string | null;
  mileage_km: string | null;
  battery_voltage: string | null;
  tire_fl: string | null;
  tire_fr: string | null;
  tire_rl: string | null;
  tire_rr: string | null;
  tire_checked_before: boolean | null;
  tire_checked_after: boolean | null;
  tire_target_psi: string | null;
  technician_note: string | null;
  customer_sign: string | null;
  insurance_type?: string | null;
  insurance_expiry_date?: string | null;
  act_expiry_date?: string | null;
  tax_expiry_date?: string | null;
};

const INSURANCE_TYPE_OPTIONS = ["ประกันชั้น 1", "ประกันชั้น 2+", "ประกันชั้น 2", "ประกันชั้น 3+", "ประกันชั้น 3"];

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

const CHECKLIST_RESULT_PREFIX = "__result__:";

function getChecklistFallbackOptions(mode: string): string[] {
  if (mode === "low_normal_high") return ["ต่ำ", "ปกติ", "เกิน"];
  if (mode === "normal_leak_damaged") return ["ปกติ", "รั่ว", "ฉีกขาด"];
  if (mode === "text_only") return ["ผ่าน"];
  return ["ปกติ", "ไม่ปกติ"];
}

function encodeChecklistNote(rawNote: string, selectedOption: string): string | null {
  const note = rawNote.trim();
  const selected = selectedOption.trim();
  if (!selected && !note) return null;
  if (!selected) return note;
  return `${CHECKLIST_RESULT_PREFIX}${selected}\n${note}`.trim();
}

function decodeChecklistNote(rawNote: string | null | undefined): { selectedOption: string; note: string } {
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

export default function FieldInstallPage() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
  const [activeTech, setActiveTech] = useState("all");
  const [canViewAllTeams, setCanViewAllTeams] = useState(false);
  const [techScopeReady, setTechScopeReady] = useState(false);
  const [activeDay, setActiveDay] = useState<number>(new Date().getDate());
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<AppointmentRow | null>(null);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [executeRow, setExecuteRow] = useState<AppointmentRow | null>(null);
  const [executeChecklist, setExecuteChecklist] = useState<InstallChecklistState[]>([]);
  const [executeNotes, setExecuteNotes] = useState("");
  const [reportPhotoUrls, setReportPhotoUrls] = useState<string[]>([]);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [savingExecute, setSavingExecute] = useState(false);
  const [closePreviewOpen, setClosePreviewOpen] = useState(false);
  const [issueSkuId, setIssueSkuId] = useState("");
  const [issueQty, setIssueQty] = useState("1");
  const [issueReason, setIssueReason] = useState("");
  const [issueSaving, setIssueSaving] = useState(false);
  const [issueSkuOptions, setIssueSkuOptions] = useState<SkuOptionRow[]>([]);
  const [carModelOptions, setCarModelOptions] = useState<string[]>([]);
  const [fieldIssues, setFieldIssues] = useState<FieldIssueRow[]>([]);
  const [currentTechnicianSignName, setCurrentTechnicianSignName] = useState("-");
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isSigningRef = useRef(false);
  const [inspectionForm, setInspectionForm] = useState<InspectionFormData>({
    receive_time: "",
    finish_time: "",
    plate_no: "",
    car_model: "",
    mileage_km: "",
    battery_voltage: "",
    tire_fl: "",
    tire_fr: "",
    tire_rl: "",
    tire_rr: "",
    tire_checked_before: false,
    tire_checked_after: false,
    tire_target_psi: "",
    technician_note: "",
    customer_sign: "",
    insurance_type: "",
    insurance_expiry_date: "",
    act_expiry_date: "",
    tax_expiry_date: ""
  });
  const uploadPreviewUrls = useMemo(
    () => uploadFiles.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    [uploadFiles]
  );

  const monthLabel = monthCursor.toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric"
  });

  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  const monthStartWeekday = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay();

  useEffect(() => {
    void loadTechnicians();
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [monthCursor, activeTech, techScopeReady, canViewAllTeams]);

  useEffect(() => {
    return () => {
      uploadPreviewUrls.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [uploadPreviewUrls]);

  function buildGoogleMapRoute(address: string | null | undefined) {
    if (!address) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
  }

  function appendUploadFiles(files: File[]) {
    if (!files.length) return;
    setUploadFiles((prev) => {
      const existingKeys = new Set(
        prev.map((file) => `${file.name}:${file.size}:${file.lastModified}`)
      );
      const next = [...prev];
      files.forEach((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!existingKeys.has(key)) {
          next.push(file);
          existingKeys.add(key);
        }
      });
      return next;
    });
  }

  async function loadTechnicians() {
    if (!supabase) return;
    setTechScopeReady(false);

    const { data: authData } = await supabase.auth.getUser();
    const authUserId = authData.user?.id;
    if (!authUserId) {
      setTechnicians([]);
      setActiveTech("all");
      setCanViewAllTeams(false);
      setTechScopeReady(true);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role,technician_id,full_name ")
      .eq("id", authUserId)
      .maybeSingle();

     

    const profile = (profileData ?? null) as
      | (ProfileScopeRow & { full_name?: string | null; display_name?: string | null; email?: string | null })
      | null;

   
    setCurrentTechnicianSignName(
      profile?.display_name ?? profile?.full_name ?? profile?.email ?? "-"
    );
    const isAdmin = profile?.role === "admin";
    setCanViewAllTeams(isAdmin);

    const { data, error: techError } = await supabase
      .from("technicians")
      .select("id,full_name")
      .order("full_name");
    if (techError) {
      setTechScopeReady(true);
      return;
    }

    const list = (data ?? []) as TechnicianRow[];

    if (isAdmin) {
      setTechnicians(list);
      if (!activeTech) setActiveTech("all");
      setTechScopeReady(true);
      return;
    }

    const ownTechId = profile?.technician_id ?? null;
    const ownTeam = ownTechId ? list.find((tech) => tech.id === ownTechId) ?? null : null;
    if (ownTeam) {
      setTechnicians([ownTeam]);
      setActiveTech(ownTeam.id);
    } else {
      // Fallback: if profile.technician_id is missing/mismatched, keep UI usable.
      setTechnicians(list);
      setActiveTech(list[0]?.id ?? "all");
    }
    setTechScopeReady(true);
  }

  async function loadAppointments() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!techScopeReady) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!canViewAllTeams && (!activeTech || activeTech === "all")) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).toISOString();
    const end = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0, 23, 59, 59).toISOString();

    let query = supabase
      .from("install_appointments")
      .select(
        "id,scheduled_at,status,order_id,technician_id,orders(order_no,site_id,customer_id,customer_name,customer_phone,customer_address,cart_id)"
      )
      .gte("scheduled_at", start)
      .lte("scheduled_at", end)
      .order("scheduled_at", { ascending: true });

    if (!canViewAllTeams || activeTech !== "all") {
      query = query.eq("technician_id", activeTech);
    }

    const { data: appointData, error: appointError } = await query;

    if (appointError) {
      setError(appointError.message);
      setLoading(false);
      return;
    }

    const orderIds = (appointData ?? []).map((row) => row.order_id);
    const customerIds = (appointData ?? [])
      .map((row) => {
        const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
        return order?.customer_id ?? null;
      })
      .filter((id): id is string => Boolean(id));

    let itemRows: OrderItemRow[] = [];
    if (orderIds.length) {
      const { data: itemData } = await supabase
        .from("order_items")
        .select("order_id,quantity,sku_id,skus(size_label,products(brand,name))")
        .in("order_id", orderIds);
      if (itemData) itemRows = itemData as unknown as OrderItemRow[];
    }

    let customers: CustomerRow[] = [];
    if (customerIds.length) {
      const { data: customerData } = await supabase
        .from("customes")
        .select("id,display_name,full_name,email,phone,address,location,line_user_id,line_msg_user_id")
        .in("id", customerIds);
      customers = (customerData ?? []) as CustomerRow[];
    }
    const cartIds = (appointData ?? [])
      .map((row) => {
        const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
        return order?.cart_id ?? null;
      })
      .filter((id): id is string => Boolean(id));
    let carts: CartContactRow[] = [];
    if (cartIds.length) {
      const { data: cartData } = await supabase
        .from("carts")
        .select("id,customer_name,customer_phone,customer_address")
        .in("id", cartIds);
      carts = (cartData ?? []) as CartContactRow[];
    }

    const customerMap = new Map<string, CustomerRow>();
    customers.forEach((customer) => customerMap.set(customer.id, customer));
    const cartMap = new Map<string, CartContactRow>();
    carts.forEach((cart) => cartMap.set(cart.id, cart));

    const itemMap = new Map<string, { count: number; label: string }>();
    const itemListMap = new Map<string, { label: string; quantity: number }[]>();
    itemRows.forEach((item) => {
      const existing = itemMap.get(item.order_id) ?? { count: 0, label: "" };
      const list = itemListMap.get(item.order_id) ?? [];
      const product = item.skus?.products;
      const labelParts = [];
      if (product?.brand) labelParts.push(product.brand);
      if (product?.name) labelParts.push(product.name);
      if (item.skus?.size_label) labelParts.push(item.skus.size_label);
      const label = labelParts.join(" ");
      const newLabel = existing.label || label;
      list.push({ label: label || "-", quantity: item.quantity ?? 0 });
      itemMap.set(item.order_id, {
        count: existing.count + (item.quantity ?? 0),
        label: newLabel
      });
      itemListMap.set(item.order_id, list);
    });

    const mapped = (appointData ?? []).map((row) => {
      const itemInfo = itemMap.get(row.order_id);
      const items = itemListMap.get(row.order_id) ?? [];
      const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
      const customer = order?.customer_id ? customerMap.get(order.customer_id) : null;
      const cart = order?.cart_id ? cartMap.get(order.cart_id) : null;
      return {
        id: row.id,
        scheduled_at: row.scheduled_at,
        status: row.status,
        order_id: row.order_id,
        site_id: order?.site_id ?? null,
        technician_id: row.technician_id,
        orders: order ?? null,
        productLabel: itemInfo?.label || "-",
        itemCount: itemInfo?.count ?? 0,
        items,
        customer_name:
          order?.customer_name ??
          cart?.customer_name ??
          customer?.display_name ??
          customer?.full_name ??
          customer?.email ??
          null,
        customer_phone:
          order?.customer_phone ??
          cart?.customer_phone ??
          customer?.phone ??
          null,
        customer_address:
          order?.customer_address ??
          cart?.customer_address ??
          customer?.address ??
          customer?.location ??
          null,
        customer_line_user_id: customer?.line_msg_user_id ?? customer?.line_user_id ?? null
      } as unknown as AppointmentRow;
    });

    setAppointments(mapped);
    setLoading(false);
  }

  const dayStats = useMemo(() => {
    const map = new Map<number, number>();
    appointments.forEach((appoint) => {
      const date = new Date(appoint.scheduled_at);
      if (date.getMonth() !== monthCursor.getMonth()) return;
      const day = date.getDate();
      map.set(day, (map.get(day) ?? 0) + 1);
    });
    return map;
  }, [appointments, monthCursor]);

  const calendarDays = Array.from({ length: daysInMonth }).map((_, idx) => {
    const dayNumber = idx + 1;
    const count = dayStats.get(dayNumber) ?? 0;
    let status = "" as "" | "low" | "mid" | "high";
    if (count >= 6) status = "high";
    else if (count >= 3) status = "mid";
    else if (count > 0) status = "low";
    return { day: dayNumber, status };
  });

  const activeRows = appointments.filter((appoint) => {
    const date = new Date(appoint.scheduled_at);
    return (
      date.getFullYear() === monthCursor.getFullYear() &&
      date.getMonth() === monthCursor.getMonth() &&
      date.getDate() === activeDay
    );
  });
  const selectedIssueSku = issueSkuOptions.find((sku) => sku.id === issueSkuId) ?? null;
  const queueRows = [...activeRows].sort((a, b) =>
    a.scheduled_at.localeCompare(b.scheduled_at)
  );

  function openQueueRouteInGoogleMaps() {

    const orderedAddresses = queueRows
      .map((row) => row.customer_address?.trim() ?? "")
      .filter((address) => Boolean(address));
    const uniqueAddresses = Array.from(new Set(orderedAddresses));

    console.log("uniqueAddresses", uniqueAddresses);

    if (uniqueAddresses.length === 0) {
      setError("ไม่พบที่อยู่ลูกค้าสำหรับสร้างเส้นทาง");
      return;
    }

    if (uniqueAddresses.length === 1) {
      const singleRoute = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        uniqueAddresses[0]
      )}&travelmode=driving`;
      window.open(singleRoute, "_blank");
      return;
    }

    // Google Maps URL practical limit: use first -> last and middle as waypoints.
    // Keep at most 12 stops (origin + 10 waypoints + destination) to avoid overly long URLs.
    const limited = uniqueAddresses.slice(0, 12);
    const origin = limited[0];
    const destination = limited[limited.length - 1];
    const waypoints = limited.slice(1, -1).join("|");
    const routeUrl =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${encodeURIComponent(origin)}` +
      `&destination=${encodeURIComponent(destination)}` +
      (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : "") +
      `&travelmode=driving`;

    window.open(routeUrl, "_blank");
    if (uniqueAddresses.length > limited.length) {
      setSuccess(
        `เปิดเส้นทางตามคิวแล้ว (แสดง ${limited.length} จุดแรกจากทั้งหมด ${uniqueAddresses.length} จุด)`
      );
    }
  }

  function exportDailyPickupPdf() {
    if (activeRows.length === 0) {
      setError("ไม่มีคิวงานสำหรับพิมพ์ในวันที่เลือก");
      return;
    }

    const escapeHtml = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

    const dayDate = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), activeDay);
    const dayLabel = dayDate.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const sortedRows = [...activeRows].sort((a, b) => {
      const customerA = a.customer_name ?? "";
      const customerB = b.customer_name ?? "";
      if (customerA !== customerB) return customerA.localeCompare(customerB);
      return a.scheduled_at.localeCompare(b.scheduled_at);
    });

    const groupedByCustomer = new Map<string, AppointmentRow[]>();
    sortedRows.forEach((row) => {
      const customerKey = `${row.customer_name ?? "-"}|${row.customer_phone ?? "-"}|${row.customer_address ?? "-"}`;
      const list = groupedByCustomer.get(customerKey) ?? [];
      list.push(row);
      groupedByCustomer.set(customerKey, list);
    });

    const detailSections = Array.from(groupedByCustomer.entries())
      .map(([key, rows], customerIndex) => {
        const [customerName, customerPhone, customerAddress] = key.split("|");
        const totalItems = rows.reduce((sum, row) => sum + (row.itemCount ?? 0), 0);
        const rowsHtml = rows
          .map((row, rowIndex) => {
            const orderNo =
              (Array.isArray(row.orders) ? row.orders[0]?.order_no : row.orders?.order_no) ?? "-";
            const timeLabel = new Date(row.scheduled_at).toLocaleTimeString("th-TH", {
              hour: "2-digit",
              minute: "2-digit"
            });
            const itemsLabel =
              row.items.length > 0
                ? row.items
                  .map(
                    (item) =>
                      `<div class="item-line"><span class="item-name">${escapeHtml(item.label)}</span><span class="item-qty">x${item.quantity}</span></div>`
                  )
                  .join("")
                : `<div class="item-line"><span class="item-name">${escapeHtml(row.productLabel)}</span><span class="item-qty">${row.itemCount ? `x${row.itemCount}` : ""}</span></div>`;
            return `
              <tr>
                <td>${rowIndex + 1}</td>
                <td>${timeLabel}</td>
                <td>${escapeHtml(orderNo)}</td>
                <td class="item-cell">${itemsLabel}</td>
                <td></td>
              </tr>
            `;
          })
          .join("");

        return `
          <section class="customer-section">
            <div class="customer-head">
              <div class="customer-title">ลูกค้า ${customerIndex + 1}: ${escapeHtml(customerName)}</div>
              <div class="customer-sub">เบอร์: ${escapeHtml(customerPhone)} | ที่อยู่: ${escapeHtml(customerAddress)}</div>
            </div>
            <div class="customer-summary">จำนวนงาน: ${rows.length} งาน | จำนวนสินค้ารวม: ${totalItems} รายการ</div>
            <table>
              <thead>
                <tr>
                  <th style="width:40px">#</th>
                  <th style="width:90px">เวลา</th>
                  <th style="width:140px">ออร์เดอร์</th>
                  <th>รายละเอียดสินค้า</th>
                  <th style="width:120px">เซ็นรับของ</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </section>
        `;
      })
      .join("");

    const totalJobs = activeRows.length;
    const totalQty = activeRows.reduce((sum, row) => sum + (row.itemCount ?? 0), 0);

    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Pickup Dispatch Sheet - ${dayLabel}</title>
          <style>
            body { font-family: "Sarabun", Arial, sans-serif; color: #0f172a; padding: 24px; }
            .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; }
            .brand { font-size: 20px; font-weight: 700; letter-spacing: 0.3px; }
            .doc { font-size: 12px; color: #334155; }
            .meta { margin: 0 0 16px 0; font-size: 12px; color: #334155; }
            .stats { display: flex; gap: 10px; margin-bottom: 16px; }
            .stat-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; min-width: 150px; }
            .stat-label { font-size: 11px; color: #64748b; margin-bottom: 2px; }
            .stat-value { font-size: 16px; font-weight: 700; }
            .customer-section { margin-bottom: 16px; page-break-inside: avoid; }
            .customer-head { margin-bottom: 6px; }
            .customer-title { font-size: 14px; font-weight: 700; }
            .customer-sub { font-size: 12px; color: #334155; margin-top: 2px; }
            .customer-summary { font-size: 11px; color: #475569; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
            th, td { border: 1px solid #94a3b8; padding: 6px; font-size: 12px; vertical-align: top; text-align: left; }
            th { background: #e2e8f0; font-weight: 700; }
            .item-cell { line-height: 1.45; }
            .item-line { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px dashed #cbd5e1; padding: 1px 0; }
            .item-line:last-child { border-bottom: none; }
            .item-name { flex: 1; }
            .item-qty { font-weight: 700; }
            .footer-note { margin-top: 16px; font-size: 11px; color: #64748b; }
            @media print { .customer-section { break-inside: avoid; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">Dreammaker - Pickup Dispatch Sheet</div>
            <div class="doc">เอกสารเตรียมสินค้า / งานติดตั้ง</div>
          </div>
          <div class="meta">วันที่ปฏิบัติงาน: ${dayLabel}</div>
          <div class="stats">
            <div class="stat-card">
              <div class="stat-label">จำนวนลูกค้า</div>
              <div class="stat-value">${groupedByCustomer.size}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">จำนวนงาน</div>
              <div class="stat-value">${totalJobs}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">จำนวนสินค้ารวม</div>
              <div class="stat-value">${totalQty}</div>
            </div>
          </div>
          ${detailSections}
          <div class="footer-note">หมายเหตุ: เอกสารนี้ใช้สำหรับหยิบสินค้า (Pickup) และเตรียมส่งทีมช่างเข้าหน้างาน</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function loadCarModelOptions() {
    if (!supabase || carModelOptions.length > 0) return;
    const { data, error: modelError } = await supabase
      .from("car_models")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (modelError) {
      setError(modelError.message);
      return;
    }

    const options = ((data ?? []) as CarModelRow[])
      .map((row) => {
        const model = typeof row.model === "string" ? row.model.trim() : "";
        const modelName = typeof row.model_name === "string" ? row.model_name.trim() : "";
        const name = typeof row.name === "string" ? row.name.trim() : "";
        const brand = typeof row.brand === "string" ? row.brand.trim() : "";
        const value = model || modelName || name;
        if (!value) return "";
        return brand ? `${brand} ${value}`.trim() : value;
      })
      .filter((value): value is string => Boolean(value));

    setCarModelOptions(Array.from(new Set(options)));
  }

  async function openExecuteModal(appointment: AppointmentRow) {
    if (!supabase) return;
    await loadCarModelOptions();
    setDetailOpen(false);
    setDetailRow(null);
    setExecuteOpen(true);
    setExecuteRow(appointment);
    setExecuteChecklist([]);
    setExecuteNotes("");
    setReportPhotoUrls([]);
    setUploadFiles([]);
    setIssueSkuId("");
    setIssueQty("1");
    setIssueReason("");
    setFieldIssues([]);
    setInspectionForm({
      receive_time: "",
      finish_time: "",
      plate_no: "",
      car_model: "",
      mileage_km: "",
      battery_voltage: "",
      tire_fl: "",
      tire_fr: "",
      tire_rl: "",
      tire_rr: "",
    tire_checked_before: false,
    tire_checked_after: false,
    tire_target_psi: "",
    technician_note: "",
    customer_sign: "",
    insurance_type: "",
    insurance_expiry_date: "",
    act_expiry_date: "",
    tax_expiry_date: ""
  });
    setError(null);

    const [{ data: orderItemData, error: orderItemError }, { data: extraData, error: extraError }] =
      await Promise.all([
        supabase
          .from("order_items")
          .select("id,order_id,quantity,sku_id,skus(size_label,products(brand,name))")
          .eq("order_id", appointment.order_id),
        supabase
          .from("install_checklist_items")
          .select("id,title,active,sort_order,section_name,response_mode,response_options,unit_label")
          .eq("active", true)
          .order("sort_order", { ascending: true })
      ]);

    if (orderItemError) {
      setError(orderItemError.message);
      return;
    }
    if (extraError) {
      setError(extraError.message);
      return;
    }

    const orderChecklist = ((orderItemData ?? []) as unknown as OrderItemRow[]).map((item, idx) => {
      const product = item.skus?.products;
      const parts = [];
      if (product?.brand) parts.push(product.brand);
      if (product?.name) parts.push(product.name);
      if (item.skus?.size_label) parts.push(item.skus.size_label);
      const label = parts.join(" ") || item.sku_id || "รายการสินค้า";
      return {
        source_type: "order_item" as const,
        source_id: item.id,
        section_name: "รายการติดตั้ง",
        response_mode: "pass_fail",
        response_options: ["ผ่าน", "ไม่ผ่าน"],
        unit_label: null,
        label,
        quantity: item.quantity ?? 0,
        checked: false,
        selected_option: "",
        note: "",
        sort_order: idx
      };
    });

    const extraChecklist = ((extraData ?? []) as ChecklistTemplateRow[]).map((item, idx) => ({
      source_type: "extra" as const,
      source_id: item.id,
      section_name: item.section_name?.trim() || "เช็กลิสต์ทั่วไป",
      response_mode: item.response_mode?.trim() || "pass_fail",
      response_options:
        Array.isArray(item.response_options) && item.response_options.length > 0
          ? item.response_options.map((value) => String(value))
          : ["ปกติ", "ไม่ปกติ"],
      unit_label: item.unit_label ?? null,
      label: item.title,
      checked: false,
      selected_option: "",
      note: "",
      sort_order: 1000 + idx
    }));

    const baseChecklist = [...orderChecklist, ...extraChecklist];

    const [reportWithFormRes, inspectionFormRes] = await Promise.all([
      supabase
        .from("install_execution_reports")
        .select("id,appointment_id,notes,form_data")
        .eq("appointment_id", appointment.id)
        .maybeSingle(),
      supabase
        .from("install_inspection_forms")
        .select(
          "appointment_id,receive_time,finish_time,plate_no,car_model,mileage_km,battery_voltage,tire_fl,tire_fr,tire_rl,tire_rr,tire_checked_before,tire_checked_after,tire_target_psi,technician_note,customer_sign,insurance_type,insurance_expiry_date,act_expiry_date,tax_expiry_date"
        )
        .eq("appointment_id", appointment.id)
        .maybeSingle()
    ]);

    if (!inspectionFormRes.error && inspectionFormRes.data) {
      const formRow = inspectionFormRes.data as InstallInspectionFormRow;
      setInspectionForm((prev) => ({
        ...prev,
        receive_time: formRow.receive_time ?? prev.receive_time,
        finish_time: formRow.finish_time ?? prev.finish_time,
        plate_no: formRow.plate_no ?? prev.plate_no,
        car_model: formRow.car_model ?? prev.car_model,
        mileage_km: formRow.mileage_km ?? prev.mileage_km,
        battery_voltage: formRow.battery_voltage ?? prev.battery_voltage,
        tire_fl: formRow.tire_fl ?? prev.tire_fl,
        tire_fr: formRow.tire_fr ?? prev.tire_fr,
        tire_rl: formRow.tire_rl ?? prev.tire_rl,
        tire_rr: formRow.tire_rr ?? prev.tire_rr,
        tire_checked_before: formRow.tire_checked_before ?? prev.tire_checked_before,
        tire_checked_after: formRow.tire_checked_after ?? prev.tire_checked_after,
        tire_target_psi: formRow.tire_target_psi ?? prev.tire_target_psi,
        technician_note: formRow.technician_note ?? prev.technician_note,
        customer_sign: formRow.customer_sign ?? prev.customer_sign,
        insurance_type: formRow.insurance_type ?? prev.insurance_type,
        insurance_expiry_date: formRow.insurance_expiry_date ?? prev.insurance_expiry_date,
        act_expiry_date: formRow.act_expiry_date ?? prev.act_expiry_date,
        tax_expiry_date: formRow.tax_expiry_date ?? prev.tax_expiry_date
      }));
    }

    const reportWithFormData = reportWithFormRes.data;
    const reportWithFormError = reportWithFormRes.error;
    let reportData = reportWithFormData as ExecutionReportRow | null;
    if (reportWithFormError && reportWithFormError.message.toLowerCase().includes("form_data")) {
      const { data: legacyReportData } = await supabase
        .from("install_execution_reports")
        .select("id,appointment_id,notes")
        .eq("appointment_id", appointment.id)
        .maybeSingle();
      reportData = (legacyReportData ?? null) as ExecutionReportRow | null;
    }

    if (!reportData) {
      setExecuteChecklist(baseChecklist);
      await loadIssueSkuOptions();
      await loadFieldIssues(appointment.id);
      return;
    }

    const report = reportData as ExecutionReportRow;
    setExecuteNotes(report.notes ?? "");
    const formDataRaw = report.form_data;
    if (formDataRaw && typeof formDataRaw === "object") {
      const formData = formDataRaw as Partial<InspectionFormData>;
      setInspectionForm((prev) => ({
        ...prev,
        receive_time: formData.receive_time ?? prev.receive_time,
        finish_time: formData.finish_time ?? prev.finish_time,
        plate_no: formData.plate_no ?? prev.plate_no,
        car_model: formData.car_model ?? prev.car_model,
        mileage_km: formData.mileage_km ?? prev.mileage_km,
        battery_voltage: formData.battery_voltage ?? prev.battery_voltage,
        tire_fl: formData.tire_fl ?? prev.tire_fl,
        tire_fr: formData.tire_fr ?? prev.tire_fr,
        tire_rl: formData.tire_rl ?? prev.tire_rl,
        tire_rr: formData.tire_rr ?? prev.tire_rr,
        tire_checked_before:
          typeof formData.tire_checked_before === "boolean"
            ? formData.tire_checked_before
            : prev.tire_checked_before,
        tire_checked_after:
          typeof formData.tire_checked_after === "boolean"
            ? formData.tire_checked_after
            : prev.tire_checked_after,
        tire_target_psi: formData.tire_target_psi ?? prev.tire_target_psi,
        technician_note: formData.technician_note ?? prev.technician_note,
        customer_sign: formData.customer_sign ?? prev.customer_sign,
        insurance_type: formData.insurance_type ?? prev.insurance_type,
        insurance_expiry_date: formData.insurance_expiry_date ?? prev.insurance_expiry_date,
        act_expiry_date: formData.act_expiry_date ?? prev.act_expiry_date,
        tax_expiry_date: formData.tax_expiry_date ?? prev.tax_expiry_date
      }));
    }
    const [{ data: reportItems }, { data: reportPhotos }] = await Promise.all([
      supabase
        .from("install_execution_report_items")
        .select("source_type,source_id,label,is_checked,note,sort_order")
        .eq("report_id", report.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("install_execution_report_photos")
        .select("photo_url")
        .eq("report_id", report.id)
        .order("created_at", { ascending: true })
    ]);

    const savedItems = (reportItems ?? []) as ExecutionReportItemRow[];
    if (savedItems.length > 0) {
      const map = new Map<string, ExecutionReportItemRow>(
        savedItems.map((item) => [`${item.source_type}:${item.source_id ?? item.label}`, item])
      );
      setExecuteChecklist(
        baseChecklist.map((item) => {
          const key = `${item.source_type}:${item.source_id ?? item.label}`;
          const saved = map.get(key);
          const parsed = decodeChecklistNote(saved?.note);
          return saved
            ? {
              ...item,
              checked: saved.is_checked || Boolean(parsed.selectedOption),
              selected_option: parsed.selectedOption,
              note: parsed.note,
              label: saved.label
            }
            : item;
        })
      );
    } else {
      setExecuteChecklist(baseChecklist);
    }

    setReportPhotoUrls(
      ((reportPhotos ?? []) as ExecutionReportPhotoRow[])
        .map((item) => item.photo_url)
        .filter((url): url is string => Boolean(url))
    );

    await loadIssueSkuOptions();
    await loadFieldIssues(appointment.id);
  }

  async function loadIssueSkuOptions() {
    if (!supabase || issueSkuOptions.length > 0) return;
    const { data, error: skuError } = await supabase
      .from("skus")
      .select("id,sku_code,size_label,products(brand,name)")
      .order("sku_code", { ascending: true })
      .limit(2000);
    if (skuError) {
      setError(skuError.message);
      return;
    }
    setIssueSkuOptions((data ?? []) as unknown as SkuOptionRow[]);
  }

  async function loadFieldIssues(appointmentId: string) {
    if (!supabase) return;
    const { data, error: issueError } = await supabase
      .from("order_bonus_items")
      .select(
        "id,sku_id,quantity,reason,created_at,skus(sku_code,size_label,products(brand,name))"
      )
      .eq("appointment_id", appointmentId)
      .eq("source", "field_install")
      .order("created_at", { ascending: false });
    if (issueError) {
      setError(issueError.message);
      return;
    }
    setFieldIssues((data ?? []) as unknown as FieldIssueRow[]);
  }

  async function addFieldIssue() {
    if (!supabase || !executeRow) return;
    const qty = Number(issueQty);
    if (!issueSkuId) {
      setError("กรุณาเลือกรายการสินค้า");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("จำนวนสินค้าไม่ถูกต้อง");
      return;
    }

    setIssueSaving(true);
    setError(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const createdBy = authData.user?.id ?? null;
      const { data: issueData, error: issueInsertError } = await supabase
        .from("order_bonus_items")
        .insert({
          order_id: executeRow.order_id,
          appointment_id: executeRow.id,
          sku_id: issueSkuId,
          quantity: qty,
          source: "field_install",
          reason: issueReason.trim() || null,
          created_by: createdBy
        })
        .select("id")
        .single();
      if (issueInsertError) throw new Error(issueInsertError.message);

      const { data: invData, error: invError } = await supabase
        .from("inventory")
        .select("sku_id,qty_on_hand,qty_reserved,min_stock")
        .eq("sku_id", issueSkuId)
        .maybeSingle();
      if (invError || !invData) {
        throw new Error(invError?.message ?? "ไม่พบสต๊อกของรายการที่เลือก");
      }
      const nextOnHand = Math.max(0, Number(invData.qty_on_hand ?? 0) - qty);
      const { error: invUpdateError } = await supabase.from("inventory").upsert({
        sku_id: issueSkuId,
        qty_on_hand: nextOnHand,
        qty_reserved: invData.qty_reserved ?? 0,
        min_stock: invData.min_stock ?? 0
      });
      if (invUpdateError) throw new Error(invUpdateError.message);

      const { error: moveError } = await supabase.from("inventory_movements").insert({
        sku_id: issueSkuId,
        movement_type: "free_issue",
        qty_change: -qty,
        ref_type: "install_appointment",
        ref_id: executeRow.id,
        note: issueReason.trim() || "เบิกเพิ่มหน้างาน",
        order_bonus_item_id: issueData?.id ?? null,
        created_by: createdBy
      });
      if (moveError) throw new Error(moveError.message);

      setIssueQty("1");
      setIssueReason("");
      setIssueSkuId("");
      setSuccess("บันทึกการเบิกเพิ่มหน้างานเรียบร้อย");
      await loadFieldIssues(executeRow.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกการเบิกเพิ่มไม่สำเร็จ");
    } finally {
      setIssueSaving(false);
    }
  }

  async function uploadExecutionPhotos(appointmentId: string, files: File[]) {
    if (!supabase || files.length === 0) return [] as string[];
    const bucket = supabase.storage.from("install_reports");
    const uploaded: string[] = [];
    for (const file of files) {
      const safeName = file.name.replace(/\s+/g, "-");
      const path = `install_reports/${appointmentId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}-${safeName}`;
      const { error: uploadError } = await bucket.upload(path, file, { upsert: false });
      if (uploadError) {
        throw new Error(uploadError.message);
      }
      const { data } = bucket.getPublicUrl(path);
      if (data?.publicUrl) uploaded.push(data.publicUrl);
    }
    return uploaded;
  }

  async function syncVehicleRenewalReminders() {
    if (!supabase || !executeRow) return;
    const order = Array.isArray(executeRow.orders) ? executeRow.orders[0] : executeRow.orders;
    const customerId = order?.customer_id ?? null;
    const siteId = executeRow.site_id ?? order?.site_id ?? null;
    const plateNo = inspectionForm.plate_no.trim();
    if (!customerId || !siteId || !plateNo) return;

    const { data: vehicleData, error: vehicleError } = await supabase
      .from("customer_vehicles")
      .upsert(
        {
          customer_id: customerId,
          site_id: siteId,
          plate_no: plateNo,
          model: inspectionForm.car_model.trim() || null,
          current_mileage: inspectionForm.mileage_km ? Number(inspectionForm.mileage_km.replace(/,/g, "")) || null : null,
          active: true,
          updated_at: new Date().toISOString()
        },
        { onConflict: "site_id,plate_no" }
      )
      .select("id")
      .single();
    if (vehicleError || !vehicleData?.id) {
      throw new Error(vehicleError?.message ?? "ไม่สามารถบันทึกข้อมูลรถสำหรับแจ้งเตือนได้");
    }

    const renewalRows = [
      {
        renewal_type: "insurance",
        insurance_class: inspectionForm.insurance_type || null,
        expiry_date: inspectionForm.insurance_expiry_date || null
      },
      {
        renewal_type: "act",
        insurance_class: null,
        expiry_date: inspectionForm.act_expiry_date || null
      },
      {
        renewal_type: "tax",
        insurance_class: null,
        expiry_date: inspectionForm.tax_expiry_date || null
      }
    ].filter((row) => Boolean(row.expiry_date));

    for (const row of renewalRows) {
      const { error: renewalError } = await supabase
        .from("vehicle_renewals")
        .upsert(
          {
            vehicle_id: vehicleData.id,
            renewal_type: row.renewal_type,
            insurance_class: row.insurance_class,
            expiry_date: row.expiry_date,
            remind_before_days: 30,
            active: true,
            updated_at: new Date().toISOString()
          },
          { onConflict: "vehicle_id,renewal_type" }
        );
      if (renewalError) throw new Error(`บันทึกรายการแจ้งเตือนไม่สำเร็จ: ${renewalError.message}`);
    }
  }

  async function saveExecutionReport(options?: { closeAfterSave?: boolean }) {
    if (!supabase || !executeRow) return false;
    const closeAfterSave = options?.closeAfterSave ?? true;
    setSavingExecute(true);
    setError(null);
    setSuccess(null);
    try {
      const normalizedCarModel = inspectionForm.car_model.trim().replace(/\s+/g, " ");
      if (normalizedCarModel) {
        const { error: carModelError } = await supabase
          .from("car_models")
          .upsert(
            {
              model: normalizedCarModel,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            { onConflict: "model" }
          );
        if (carModelError) {
          console.warn("save car_models failed:", carModelError.message);
        }
      }

      const { data: authData } = await supabase.auth.getUser();
      const executedBy = authData.user?.id ?? null;

      const reportPayload = {
        appointment_id: executeRow.id,
        notes: executeNotes.trim() || null,
        form_data: inspectionForm,
        executed_at: new Date().toISOString(),
        executed_by: executedBy,
        updated_at: new Date().toISOString()
      };

      const inspectionFormPayload = {
        appointment_id: executeRow.id,
        receive_time: inspectionForm.receive_time || null,
        finish_time: inspectionForm.finish_time || null,
        plate_no: inspectionForm.plate_no || null,
        car_model: inspectionForm.car_model || null,
        mileage_km: inspectionForm.mileage_km || null,
        battery_voltage: inspectionForm.battery_voltage || null,
        tire_fl: inspectionForm.tire_fl || null,
        tire_fr: inspectionForm.tire_fr || null,
        tire_rl: inspectionForm.tire_rl || null,
        tire_rr: inspectionForm.tire_rr || null,
        tire_checked_before: inspectionForm.tire_checked_before,
        tire_checked_after: inspectionForm.tire_checked_after,
        tire_target_psi: inspectionForm.tire_target_psi || null,
        technician_note: inspectionForm.technician_note || null,
        customer_sign: inspectionForm.customer_sign || null,
        insurance_type: inspectionForm.insurance_type || null,
        insurance_expiry_date: inspectionForm.insurance_expiry_date || null,
        act_expiry_date: inspectionForm.act_expiry_date || null,
        tax_expiry_date: inspectionForm.tax_expiry_date || null,
        updated_at: new Date().toISOString()
      };
      const { error: inspectionFormError } = await supabase
        .from("install_inspection_forms")
        .upsert(inspectionFormPayload, { onConflict: "appointment_id" });
      if (inspectionFormError?.message.toLowerCase().includes("insurance_type")) {
        const {
          insurance_type: _insuranceType,
          insurance_expiry_date: _insuranceExpiryDate,
          act_expiry_date: _actExpiryDate,
          tax_expiry_date: _taxExpiryDate,
          ...legacyInspectionFormPayload
        } = inspectionFormPayload;
        const { error: legacyInspectionFormError } = await supabase
          .from("install_inspection_forms")
          .upsert(legacyInspectionFormPayload, { onConflict: "appointment_id" });
        if (legacyInspectionFormError) {
          throw new Error(`บันทึกฟอร์มตรวจเช็กไม่สำเร็จ: ${legacyInspectionFormError.message}`);
        }
      }
      if (
        inspectionFormError &&
        !inspectionFormError.message.toLowerCase().includes("insurance_type") &&
        !inspectionFormError.message.toLowerCase().includes("install_inspection_forms")
      ) {
        throw new Error(`บันทึกฟอร์มตรวจเช็กไม่สำเร็จ: ${inspectionFormError.message}`);
      }

      let reportData: { id: string } | null = null;
      let reportError: { message: string } | null = null;
      const { data: reportDataWithForm, error: reportErrorWithForm } = await supabase
        .from("install_execution_reports")
        .upsert(reportPayload, { onConflict: "appointment_id" })
        .select("id")
        .single();
      reportData = reportDataWithForm as { id: string } | null;
      reportError = reportErrorWithForm as { message: string } | null;

      if (reportError?.message?.toLowerCase().includes("form_data")) {
        const { data: legacyReportData, error: legacyReportError } = await supabase
          .from("install_execution_reports")
          .upsert(
            {
              appointment_id: executeRow.id,
              notes: executeNotes.trim() || null,
              executed_at: new Date().toISOString(),
              executed_by: executedBy,
              updated_at: new Date().toISOString()
            },
            { onConflict: "appointment_id" }
          )
          .select("id")
          .single();
        reportData = legacyReportData as { id: string } | null;
        reportError = legacyReportError as { message: string } | null;
      }

      if (reportError || !reportData?.id) {
        throw new Error(reportError?.message ?? "ไม่สามารถบันทึกรายงานติดตั้งได้");
      }
      const reportId = reportData.id as string;

      await syncVehicleRenewalReminders();

      const { error: deleteItemError } = await supabase
        .from("install_execution_report_items")
        .delete()
        .eq("report_id", reportId);
      if (deleteItemError) throw new Error(deleteItemError.message);

      const itemPayload = executeChecklist.map((item, idx) => ({
        report_id: reportId,
        source_type: item.source_type,
        source_id: item.source_id,
        label: item.label,
        is_checked: item.checked || Boolean(item.selected_option),
        note: encodeChecklistNote(item.note, item.selected_option),
        sort_order: idx
      }));
      if (itemPayload.length) {
        const { error: insertItemError } = await supabase
          .from("install_execution_report_items")
          .insert(itemPayload);
        if (insertItemError) throw new Error(insertItemError.message);
      }

      const uploadedUrls = await uploadExecutionPhotos(executeRow.id, uploadFiles);
      const allUrls = [...reportPhotoUrls, ...uploadedUrls];

      const { error: deletePhotoError } = await supabase
        .from("install_execution_report_photos")
        .delete()
        .eq("report_id", reportId);
      if (deletePhotoError) throw new Error(deletePhotoError.message);

      if (allUrls.length) {
        const { error: insertPhotoError } = await supabase
          .from("install_execution_report_photos")
          .insert(allUrls.map((url) => ({ report_id: reportId, photo_url: url })));
        if (insertPhotoError) throw new Error(insertPhotoError.message);
      }

      const allDone = executeChecklist.every((item) => item.checked);
      const hasCustomerSign = inspectionForm.customer_sign.startsWith("data:image");
      if (allDone && !hasCustomerSign) {
        setError("ต้องให้ลูกค้าเซ็นชื่อก่อนปิดงาน");
        return false;
      }
      const nextStatus = allDone && hasCustomerSign ? "done" : "in_progress";
      const { error: statusError } = await supabase
        .from("install_appointments")
        .update({ status: nextStatus })
        .eq("id", executeRow.id);
      if (statusError) throw new Error(statusError.message);


      if (nextStatus === "done") {
        const { error: orderStatusError } = await supabase
          .from("orders")
          .update({ status: "completed" })
          .eq("id", executeRow.order_id);
        if (orderStatusError) throw new Error(orderStatusError.message);
      }

      setSuccess("บันทึกผลการดำเนินการติดตั้งเรียบร้อย");
      if (closeAfterSave) {
        setExecuteOpen(false);
        setExecuteRow(null);
      }
      await loadAppointments();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกผลการดำเนินการไม่สำเร็จ");
      return false;
    } finally {
      setSavingExecute(false);
    }
  }

  async function saveAndExportExecutionPdf() {
    const saved = await saveExecutionReport({ closeAfterSave: false });
    if (saved) exportExecutionPdf();
  }

  function openClosePreview() {
    const allDone = executeChecklist.every((item) => item.checked);
    if (!allDone) {
      setError("เช็คลิสต์ยังไม่ครบ ต้องทำรายการให้ครบก่อนปิดงาน");
      return;
    }
    if (!inspectionForm.customer_sign.startsWith("data:image")) {
      setError("ต้องให้ลูกค้าเซ็นชื่อก่อนปิดงาน");
      return;
    }
    setError(null);
    setClosePreviewOpen(true);
  }

  async function confirmCloseJob() {
    const saved = await saveExecutionReport({ closeAfterSave: true });
    if (saved) setClosePreviewOpen(false);
  }

  async function sendExecutionReportToLine(printHtml?: string, baseUrl?: string) {
    if (!executeRow) return;
    const lineUserId = executeRow.customer_line_user_id?.trim() ?? "";
    if (!lineUserId) {
      setError("ไม่พบ LINE Msg User ID ของลูกค้า");
      return;
    }

    const orderNo =
      (Array.isArray(executeRow.orders) ? executeRow.orders[0]?.order_no : executeRow.orders?.order_no) ?? "-";
    const scheduleText = new Date(executeRow.scheduled_at).toLocaleString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
    const tireSummary = `ลมยาง FL:${inspectionForm.tire_fl || "-"} FR:${inspectionForm.tire_fr || "-"} RL:${inspectionForm.tire_rl || "-"} RR:${inspectionForm.tire_rr || "-"}`;
    const message = [
      `แจ้งผลติดตั้งออร์เดอร์ ${orderNo}`,
      `วันเวลาเข้าบริการ: ${scheduleText}`,
      `เวลาเริ่ม-เสร็จ: ${inspectionForm.receive_time || "-"} - ${inspectionForm.finish_time || "-"}`,
      `ทะเบียนรถ: ${inspectionForm.plate_no || "-"}`,
      tireSummary,
      `หมายเหตุช่าง: ${inspectionForm.technician_note || "-"}`
    ].join("\n");

    setSavingExecute(true);
    setError(null);
    try {
      const pdfRes = await fetch("/api/reports/execution-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: printHtml || undefined,
          baseUrl: baseUrl || (typeof window !== "undefined" ? window.location.origin : undefined),
          orderNo,
          customerName: executeRow.customer_name ?? "-",
          customerPhone: executeRow.customer_phone ?? "-",
          customerAddress: executeRow.customer_address ?? "-",
          scheduleText,
          receiveTime: inspectionForm.receive_time || "-",
          finishTime: inspectionForm.finish_time || "-",
          plateNo: inspectionForm.plate_no || "-",
          tireSummary,
          technicianNote: inspectionForm.technician_note || "-"
        })
      });
      const uploadPayload = (await pdfRes.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!pdfRes.ok || !uploadPayload.url) {
        throw new Error(uploadPayload.error || "สร้าง PDF ไม่สำเร็จ");
      }

      const response = await fetch("/api/line/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lineUserId,
          type: "user",
          messages: [
            {
              type: "flex",
              altText: `รายงานติดตั้งออร์เดอร์ ${orderNo}`,
              contents: {
                type: "bubble",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#eb952b",
                  paddingAll: "12px",
                  contents: [
                    {
                      type: "text",
                      text: "รายงานผลติดตั้ง",
                      color: "#FFFFFF",
                      weight: "bold",
                      size: "md"
                    }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",
                  contents: [
                    { type: "text", text: `ออร์เดอร์: ${orderNo}`, weight: "bold", size: "md", wrap: true },
                    { type: "text", text: `วันเวลาเข้าบริการ: ${scheduleText}`, size: "sm", wrap: true },
                    { type: "text", text: `เวลาเริ่ม-เสร็จ: ${inspectionForm.receive_time || "-"} - ${inspectionForm.finish_time || "-"}`, size: "sm", wrap: true },
                    { type: "text", text: `ทะเบียนรถ: ${inspectionForm.plate_no || "-"}`, size: "sm", wrap: true },
                    { type: "text", text: tireSummary, size: "sm", wrap: true },
                    { type: "text", text: `หมายเหตุช่าง: ${inspectionForm.technician_note || "-"}`, size: "sm", wrap: true }
                  ]
                },
                footer: {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",
                  contents: [
                    {
                      type: "button",
                      style: "primary",
                      color: "#eb952b",
                      action: {
                        type: "uri",
                        label: "เปิดรายงาน PDF",
                        uri: uploadPayload.url
                      }
                    }
                  ]
                }
              }
            }
            /*     ,
                {
                  type: "text",
                  text: `${message}\n\nดาวน์โหลดรายงาน PDF:\n${uploadPayload.url}`
                } */
          ]
        })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "ส่ง LINE ไม่สำเร็จ");
      }
      setSuccess("ส่งรายงานให้ลูกค้าทาง LINE เรียบร้อย");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งรายงานทาง LINE ไม่สำเร็จ");
    } finally {
      setSavingExecute(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bridge = window as Window & {
      __sendExecutionReportPdfToLine?: () => void;
      __sendExecutionReportPdfToLineWithHtml?: (html: string, baseUrl?: string) => void;
    };
    bridge.__sendExecutionReportPdfToLine = () => {
      void sendExecutionReportToLine();
    };
    bridge.__sendExecutionReportPdfToLineWithHtml = (html: string, htmlBaseUrl?: string) => {
      void sendExecutionReportToLine(html, htmlBaseUrl);
    };
    return () => {
      delete bridge.__sendExecutionReportPdfToLine;
      delete bridge.__sendExecutionReportPdfToLineWithHtml;
    };
  }, [executeRow, inspectionForm, reportPhotoUrls, uploadPreviewUrls]);

  function clearCustomerSignature() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setInspectionForm((prev) => ({ ...prev, customer_sign: "" }));
  }

  function saveCustomerSignatureToForm() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setInspectionForm((prev) => ({ ...prev, customer_sign: dataUrl }));
  }

  function startCustomerSign(clientX: number, clientY: number) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1c3d2a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    isSigningRef.current = true;
  }

  function moveCustomerSign(clientX: number, clientY: number) {
    if (!isSigningRef.current) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.stroke();
  }

  function endCustomerSign() {
    if (!isSigningRef.current) return;
    isSigningRef.current = false;
    saveCustomerSignatureToForm();
  }

  useEffect(() => {
    if (!executeOpen) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (inspectionForm.customer_sign.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = inspectionForm.customer_sign;
    }
  }, [executeOpen, inspectionForm.customer_sign]);

  function exportExecutionPdf() {
    if (!executeRow) return;
    const orderNo =
      (Array.isArray(executeRow.orders) ? executeRow.orders[0]?.order_no : executeRow.orders?.order_no) ?? "-";
    const escapeHtml = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    const groupedChecklist = executeChecklist.reduce((acc, item) => {
      const key = item.section_name || "เช็กลิสต์ทั่วไป";
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)?.push(item);
      return acc;
    }, new Map<string, InstallChecklistState[]>());
    const renderOptions = (item: InstallChecklistState, fallback: string[]) => {
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
        const renderSuspCell = (item?: InstallChecklistState) => {
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
    const batteryLevelItem = batteryItems.find((item) =>
      item.label.includes("ระดับปริมาณน้ำกลั่น")
    );
    const batteryTerminalItem = batteryItems.find((item) =>
      item.label.includes("สายขั้ว") || item.label.includes("ปลั๊ก")
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
    const photoBlocks = [...reportPhotoUrls, ...uploadPreviewUrls.map((item) => item.url)]
      .map((url) => `<img src="${url}" class="photo" />`)
      .join("");
    const customerSignHtml = inspectionForm.customer_sign.startsWith("data:image")
      ? `<img src="${inspectionForm.customer_sign}" alt="customer-signature" style="max-width:100%;max-height:52px;object-fit:contain;" />`
      : escapeHtml(inspectionForm.customer_sign || "&nbsp;");
    const technicianSignHtml = escapeHtml(currentTechnicianSignName || "-");
    const printWindow = window.open("", "_blank", "width=980,height=1280");
    if (!printWindow) return;
    const mark = (ok: boolean) => (ok ? "✓" : "□");
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
            .grid { display:grid; grid-template-columns:repeat(4,1fr); }
            .cell { border-right: 1px solid #c7e3ce; border-bottom: 1px solid #c7e3ce; padding:6px 8px; min-height:44px; }
            .cell:nth-child(4n) { border-right: 0; }
            .cell-label { font-size: 10px; color:#4a8a5f; }
            .cell-value { font-size: 12px; font-weight: 600; margin-top:2px; }
            table { width:100%; border-collapse: collapse; }
            th, td { border: 1px solid #c3dfcb; padding: 5px 6px; font-size: 11px; text-align:left; }
            th { background:#edf8ef; color:#2b6f41; }
            .checkmark { font-family: sans-serif; font-size: 13px; }
            .opt { display:inline-block; margin-right:10px; font-size:11px; color:#325e3f; }
            .opt.on { font-weight:700; color:#1d5730; }
            .unit { margin-left:8px; font-size:10px; color:#4d7f5a; }
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
            .shock-icon {
              text-align:center;
              width:74px;
              height:74px;
              margin:0 auto;
              border-radius:12px;
              border:1px solid #c9decf;
              background:#f5fbf6;
              display:flex;
              align-items:center;
              justify-content:center;
            }
            .shock-img { width:56px; height:56px; object-fit:contain; }
            .battery-card { background:#e8f3e8; border:1px solid #c5ddc5; border-radius:6px; padding:8px; }
            .battery-head { background:#3f853f; color:#fff; text-align:center; font-size:11px; font-weight:700; padding:4px 8px; border-radius:5px; margin-bottom:8px; }
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
            .t-car {
              text-align:center;
              width:74px;
              height:74px;
              margin:0 auto;
              border-radius:999px;
              border:1px solid #c9decf;
              background: radial-gradient(circle at 30% 30%, #ffffff 0%, #edf7ef 70%, #e2f1e6 100%);
              display:flex;
              align-items:center;
              justify-content:center;
              box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
            }
            .t-car-img {
              width:58px;
              height:58px;
              object-fit:contain;
              filter: drop-shadow(0 2px 2px rgba(0,0,0,0.15));
            }
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
            <button onclick="window.opener && window.opener.__sendExecutionReportPdfToLineWithHtml ? window.opener.__sendExecutionReportPdfToLineWithHtml(document.documentElement.outerHTML, window.location.origin) : (window.opener && window.opener.__sendExecutionReportPdfToLine ? window.opener.__sendExecutionReportPdfToLine() : alert('ไม่สามารถส่ง LINE ได้')); window.close();">ส่ง PDF ให้ลูกค้า</button>
            <button onclick="window.print(); window.close();">พิมพ์ / บันทึก PDF</button>
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
                      <div class="i-value">${new Date(executeRow.scheduled_at).toLocaleDateString("th-TH")}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">เวลา:</div>
                      <div class="i-time">
                        <div class="i-value">${inspectionForm.receive_time || "-"}</div>
                        <div class="i-time-sep">-</div>
                        <div class="i-value">${inspectionForm.finish_time || "-"}</div>
                      </div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">ชื่อลูกค้า:</div>
                      <div class="i-value">${executeRow.customer_name ?? "-"}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">ที่อยู่/เปลี่ยนยาง:</div>
                      <div class="i-value">${executeRow.customer_address ?? "-"}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">เบอร์โทร:</div>
                      <div class="i-value">${executeRow.customer_phone ?? "-"}</div>
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
                      <div class="i-value">${inspectionForm.plate_no || "-"}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">ยี่ห้อรถ:</div>
                      <div class="i-value">${(inspectionForm.car_model || "").split(" ")[0] || "-"}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">รุ่นรถ:</div>
                      <div class="i-value">${inspectionForm.car_model || "-"}</div>
                    </div>
                    <div class="i-row">
                      <div class="i-label">เลขไมล์:</div>
                      <div class="i-value">${inspectionForm.mileage_km || "-"}</div>
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
                      <div class="vbox">${inspectionForm.battery_voltage || "-"}</div>
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
                        <div class="t-pill">${inspectionForm.tire_fl || "-"}</div>
                      </div>
                      <div class="t-car">
                      <img src="/assets/car.jpg" alt="car" class="t-car-img" />
                      </div>
                      <div class="t-item">
                        <label>หน้าขวา</label>
                        <div class="t-pill">${inspectionForm.tire_fr || "-"}</div>
                      </div>
                      <div class="t-item">
                        <label>หลังซ้าย</label>
                        <div class="t-pill">${inspectionForm.tire_rl || "-"}</div>
                      </div>
                      <div class="t-spare">
                        <label>สำรอง</label>
                        <div class="t-pill">${inspectionForm.tire_target_psi || "-"}</div>
                      </div>
                      <div class="t-item">
                        <label>หลังขวา</label>
                        <div class="t-pill">${inspectionForm.tire_rr || "-"}</div>
                      </div>
                    </div>
                  </div>
                  <div class="tire-right">
                    <div class="tire-note-label">หมายเหตุยาง:</div>
                    <div class="tire-note-box">${escapeHtml(inspectionForm.technician_note || executeNotes || "-")}</div>
                  </div>
                </div>
              </div>
            </div>
            ${genericSections}

            <div class="section">
              <div class="section-title">บันทึกเพิ่มเติม</div>
              <div class="note">${(executeNotes || "-") + (inspectionForm.technician_note ? `\n\nหมายเหตุช่าง: ${inspectionForm.technician_note}` : "")}</div>
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

  async function handlePick(appointment: AppointmentRow) {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const { data: items, error: itemError } = await supabase
      .from("order_items")
      .select("sku_id,quantity")
      .eq("order_id", appointment.order_id);
    if (itemError) {
      setError(itemError.message);
      setLoading(false);
      return;
    }
    const rows = items ?? [];
    for (const row of rows) {
      const { data: invData, error: invError } = await supabase
        .from("inventory")
        .select("sku_id,qty_on_hand,qty_reserved,min_stock")
        .eq("sku_id", row.sku_id)
        .maybeSingle();
      if (invError || !invData) {
        setError(invError?.message ?? "ไม่พบสต๊อก");
        setLoading(false);
        return;
      }
      const nextOnHand = Math.max(0, (invData.qty_on_hand ?? 0) - row.quantity);
      const nextReserved = Math.max(0, (invData.qty_reserved ?? 0) - row.quantity);
      const { error: updateError } = await supabase.from("inventory").upsert({
        sku_id: invData.sku_id,
        qty_on_hand: nextOnHand,
        qty_reserved: nextReserved,
        min_stock: invData.min_stock ?? 0
      });
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
    }

    await supabase
      .from("install_appointments")
      .update({ status: "in_progress" })
      .eq("id", appointment.id);

    setSuccess("ตัดสต๊อกเรียบร้อย");
    await loadAppointments();
    setLoading(false);
  }

  return (
    <div className="page active">
      <div className="toolbar" style={{ marginBottom: 18, flexWrap: "wrap" }}>
        <select
          className="filter-select"
          value={activeTech}
          onChange={(e) => setActiveTech(e.target.value)}
          disabled={!canViewAllTeams}
        >
          {canViewAllTeams ? <option value="all">ทุกทีมช่าง</option> : null}
          {technicians.map((tech) => (
            <option key={tech.id} value={tech.id}>
              {tech.full_name}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={loadAppointments}>
          รีเฟรช
        </button>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-head">
            <span className="card-title">ปฏิทินคิวงาน — {monthLabel}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "5px 12px" }}
                onClick={() => {
                  const prev = new Date(monthCursor);
                  prev.setMonth(prev.getMonth() - 1);
                  setMonthCursor(prev);
                  setActiveDay(1);
                }}
              >
                ก่อนหน้า
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "5px 12px" }}
                onClick={() => {
                  const next = new Date(monthCursor);
                  next.setMonth(next.getMonth() + 1);
                  setMonthCursor(next);
                  setActiveDay(1);
                }}
              >
                ถัดไป
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="calendar-grid">
              {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((label) => (
                <div className="calendar-head" key={label}>
                  {label}
                </div>
              ))}
              {Array.from({ length: monthStartWeekday }).map((_, idx) => (
                <div className="calendar-cell muted" key={`empty-${idx}`} />
              ))}
              {calendarDays.map((day) => (
                <div
                  key={day.day}
                  className={`calendar-cell ${activeDay === day.day ? "active" : ""}`}
                  onClick={() => setActiveDay(day.day)}
                >
                  <div className="calendar-day">{day.day}</div>
                  {day.status && <div className={`calendar-dot ${day.status}`} />}
                </div>
              ))}
            </div>
            <div className="calendar-legend">
              <span><span className="calendar-dot low" /> คิวน้อย</span>
              <span><span className="calendar-dot mid" /> ปานกลาง</span>
              <span><span className="calendar-dot high" /> แน่น</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">คิวงาน — {activeDay} {monthLabel}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "5px 12px" }}
                onClick={openQueueRouteInGoogleMaps}
                disabled={!queueRows.some((row) => Boolean(row.customer_address))}
              >
                เส้นทางตามคิว
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "5px 12px" }}
                onClick={exportDailyPickupPdf}
              >
                พิมพ์
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>ลูกค้า</th>
                  <th>เบอร์</th>
                  <th>ที่อยู่</th>
                  <th>ออร์เดอร์</th>
                  <th>สินค้า</th>
                  <th>สถานะ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ color: "var(--text3)" }}>
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : activeRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ color: "var(--text3)" }}>
                      ไม่มีคิวงานในวันนี้
                    </td>
                  </tr>
                ) : (
                  queueRows.map((row) => (
                    <tr key={row.id}>
                      <td className="mono" style={{ color: "var(--accent)", fontWeight: 500 }}>
                        {new Date(row.scheduled_at).toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                      <td>{row.customer_name ?? "-"}</td>
                      <td className="mono" style={{ fontSize: 12, color: "var(--text2)" }}>
                        {row.customer_phone ?? "-"}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text2)" }}>
                        {row.customer_address ?? "-"}
                      </td>
                      <td className="mono" style={{ fontSize: 12, color: "var(--text2)" }}>
                        {(Array.isArray(row.orders) ? row.orders[0]?.order_no : row.orders?.order_no) ?? "-"}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text2)" }}>
                        {row.productLabel} {row.itemCount ? `×${row.itemCount}` : ""}
                      </td>
                      <td>
                        <span className={STATUS_CLASS[row.status]}>{STATUS_LABEL[row.status]}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: "10px 16px", fontSize: 14 }}
                            onClick={() => {
                              setDetailRow(row);
                              setDetailOpen(true);
                            }}
                          >
                            รายละเอียด
                          </button>
                          {buildGoogleMapRoute(row.customer_address) ? (
                            <a
                              className="btn btn-ghost"
                              style={{ padding: "10px 16px", fontSize: 14 }}
                              href={buildGoogleMapRoute(row.customer_address) ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                            >
                              นำทาง
                            </a>
                          ) : null}
                          <button
                            className="btn btn-primary"
                            style={{ padding: "10px 16px", fontSize: 14 }}
                            onClick={() => handlePick(row)}
                            disabled={loading || row.status !== "waiting"}
                          >
                            Pick สินค้า
                          </button>
                          {(row.status === "in_progress" || row.status === "done") && (
                            <button
                              className="btn btn-ghost"
                              style={
                                row.status === "done"
                                  ? { padding: "10px 16px", fontSize: 14, borderStyle: "dashed", opacity: 0.8 }
                                  : { padding: "10px 16px", fontSize: 14 }
                              }
                              onClick={() => openExecuteModal(row)}
                            >
                              {row.status === "done" ? "แก้ไข" : "ดำเนินการติดตั้ง"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ActionFeedback
        error={error}
        success={success}
        onClearError={() => setError(null)}
        onClearSuccess={() => setSuccess(null)}
      />
      {detailOpen && detailRow && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">รายละเอียดงานติดตั้ง</div>
              <button className="btn btn-ghost" onClick={() => setDetailOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "var(--text3)" }}>ลูกค้า</div>
                <div style={{ fontWeight: 600 }}>{detailRow.customer_name ?? "-"}</div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  เบอร์: {detailRow.customer_phone ?? "-"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  ที่อยู่: {detailRow.customer_address ?? "-"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  ออร์เดอร์: {(Array.isArray(detailRow.orders) ? detailRow.orders[0]?.order_no : detailRow.orders?.order_no) ?? "-"}
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>สินค้า</th>
                      <th>จำนวน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRow.items.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ color: "var(--text3)" }}>
                          ไม่พบรายการสินค้า
                        </td>
                      </tr>
                    ) : (
                      detailRow.items.map((item, idx) => (
                        <tr key={`${item.label}-${idx}`}>
                          <td>{item.label}</td>
                          <td className="mono">{item.quantity}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDetailOpen(false)}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
      {executeOpen && executeRow && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 900 }}>
            <div className="modal-head">
              <div className="modal-title">ดำเนินการติดตั้ง</div>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setExecuteOpen(false);
                  setExecuteRow(null);
                }}
              >
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 10 }}>
                ออร์เดอร์: {(Array.isArray(executeRow.orders) ? executeRow.orders[0]?.order_no : executeRow.orders?.order_no) ?? "-"}
                {" | "}
                ลูกค้า: {executeRow.customer_name ?? "-"}
              </div>

              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <span className="card-title">เช็กลิสต์งานติดตั้ง</span>
                  {executeChecklist.length > 0 && (
                    <span
                      className={`badge ${
                        executeChecklist.every((item) => item.checked) ? "paid" : "pending"
                      }`}
                    >
                      เช็คแล้ว {executeChecklist.filter((item) => item.checked).length}/{executeChecklist.length}
                    </span>
                  )}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 280 }}>ผลติดตั้ง</th>
                        <th>รายการ</th>
                        <th style={{ width: 100 }}>จำนวน</th>
                        <th style={{ width: 280 }}>หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executeChecklist.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ color: "var(--text3)" }}>
                            ไม่มีรายการเช็กลิสต์
                          </td>
                        </tr>
                      ) : (
                        executeChecklist.map((item, idx) => (
                          <tr key={`${item.source_type}-${item.source_id ?? idx}`}>
                            <td>
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {(item.response_options.length > 0
                                  ? item.response_options
                                  : getChecklistFallbackOptions(item.response_mode)
                                ).map((option) => (
                                  <label
                                    key={`${item.source_type}-${item.source_id ?? idx}-${option}`}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      fontSize: 14,
                                      padding: "8px 6px",
                                      cursor: "pointer"
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      style={{ width: 22, height: 22, cursor: "pointer" }}
                                      checked={item.selected_option === option}
                                      onChange={(e) => {
                                        const nextSelected = e.target.checked ? option : "";
                                        setExecuteChecklist((prev) =>
                                          prev.map((row, rowIdx) =>
                                            rowIdx === idx
                                              ? { ...row, selected_option: nextSelected, checked: Boolean(nextSelected) }
                                              : row
                                          )
                                        );
                                      }}
                                    />
                                    {option}
                                  </label>
                                ))}
                              </div>
                            </td>
                            <td>{item.label}</td>
                            <td className="mono">{item.quantity ?? "-"}</td>
                            <td>
                              <input
                                className="create-input"
                                style={{ width: "100%" }}
                                value={item.note}
                                onChange={(e) => {
                                  const note = e.target.value;
                                  setExecuteChecklist((prev) =>
                                    prev.map((row, rowIdx) =>
                                      rowIdx === idx ? { ...row, note } : row
                                    )
                                  );
                                }}
                                placeholder="ระบุหมายเหตุ (ถ้ามี)"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <span className="card-title">สรุปงานติดตั้ง (บันทึกทั่วไป)</span>
                </div>
                <div className="card-body">
                  <textarea
                    className="create-input"
                    value={executeNotes}
                    onChange={(e) => setExecuteNotes(e.target.value)}
                    rows={4}
                    placeholder="เช่น สภาพหน้างาน, ปัญหาที่พบ, ข้อเสนอแนะ"
                    style={{ width: "100%", resize: "vertical" }}
                  />
                </div>
              </div>

              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <span className="card-title">ข้อมูลฟอร์มตรวจเช็ก </span>
                </div>
                <div className="card-body">
                  <div className="field-info-cols" style={{ display: "grid", gap: 12 }}>
                    <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>เวลางานและข้อมูลรถ</div>
                      <div className="modal-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                        <label>
                          เวลาเริ่ม
                          <input className="search-bar" style={{ width: "100%" }}
                            type="time"
                            value={inspectionForm.receive_time}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, receive_time: e.target.value }))}
                          />
                        </label>
                        <label>
                          เวลาสิ้นสุด
                          <input className="search-bar" style={{ width: "100%" }}
                            type="time"
                            value={inspectionForm.finish_time}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, finish_time: e.target.value }))}
                          />
                        </label>
                        <label>
                          ทะเบียนรถ
                          <input className="search-bar" style={{ width: "100%" }}
                            value={inspectionForm.plate_no}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, plate_no: e.target.value }))}
                            placeholder="เช่น กข1234"
                          />
                        </label>
                        <label>
                          รุ่นรถ
                          <input className="search-bar" style={{ width: "100%" }}
                            list="car-model-options"
                            value={inspectionForm.car_model}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, car_model: e.target.value }))}
                            placeholder="เช่น NISSAN Almera"
                          />
                        </label>
                        <datalist id="car-model-options">
                          {carModelOptions.map((model) => (
                            <option key={model} value={model} />
                          ))}
                        </datalist>
                        <label>
                          เลขไมล์
                          <input className="search-bar" style={{ width: "100%" }}
                            inputMode="numeric"
                            value={inspectionForm.mileage_km}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, mileage_km: e.target.value }))}
                            placeholder="เช่น 159910"
                          />
                        </label>
                        <label>
                          แบตเตอรี่ (V)
                          <input className="search-bar" style={{ width: "100%" }}
                            inputMode="decimal"
                            value={inspectionForm.battery_voltage}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, battery_voltage: e.target.value }))}
                            placeholder="เช่น 12.6"
                          />
                        </label>
                        <label>
                          ประกันภัย
                          <select
                            className="search-bar"
                            style={{ width: "100%" }}
                            value={inspectionForm.insurance_type}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, insurance_type: e.target.value }))}
                          >
                            <option value="">เลือกประเภท</option>
                            {INSURANCE_TYPE_OPTIONS.map((item) => (
                              <option key={item} value={item}>{item}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          วันหมดอายุประกัน
                          <input
                            className="search-bar"
                            style={{ width: "100%" }}
                            type="date"
                            value={inspectionForm.insurance_expiry_date}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, insurance_expiry_date: e.target.value }))}
                          />
                        </label>
                        <label>
                          วันหมดอายุ พ.ร.บ.
                          <input
                            className="search-bar"
                            style={{ width: "100%" }}
                            type="date"
                            value={inspectionForm.act_expiry_date}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, act_expiry_date: e.target.value }))}
                          />
                        </label>
                        <label>
                          วันหมดอายุภาษี
                          <input
                            className="search-bar"
                            style={{ width: "100%" }}
                            type="date"
                            value={inspectionForm.tax_expiry_date}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, tax_expiry_date: e.target.value }))}
                          />
                        </label>
                      </div>
                    </div>

                    <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>ตรวจลมยาง (PSI)</div>
                      <div className="modal-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                        <label>
                          หน้า-ซ้าย
                          <input className="search-bar" style={{ width: "100%" }}
                            inputMode="numeric"
                            value={inspectionForm.tire_fl}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, tire_fl: e.target.value }))}
                            placeholder="33"
                          />
                        </label>
                        <label>
                          หน้า-ขวา
                          <input className="search-bar" style={{ width: "100%" }}
                            inputMode="numeric"
                            value={inspectionForm.tire_fr}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, tire_fr: e.target.value }))}
                            placeholder="33"
                          />
                        </label>
                        <label>
                          หลัง-ซ้าย
                          <input className="search-bar" style={{ width: "100%" }}
                            inputMode="numeric"
                            value={inspectionForm.tire_rl}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, tire_rl: e.target.value }))}
                            placeholder="33"
                          />
                        </label>
                        <label>
                          หลัง-ขวา
                          <input className="search-bar" style={{ width: "100%" }}
                            inputMode="numeric"
                            value={inspectionForm.tire_rr}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, tire_rr: e.target.value }))}
                            placeholder="33"
                          />
                        </label>
                        <label style={{ gridColumn: "span 2" }}>
                          ค่าแนะนำลมยาง (PSI)
                          <input className="search-bar" style={{ width: "100%" }}
                            inputMode="numeric"
                            value={inspectionForm.tire_target_psi}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, tire_target_psi: e.target.value }))}
                            placeholder="เช่น 33"
                          />
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px", fontSize: 14, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            style={{ width: 22, height: 22, cursor: "pointer" }}
                            checked={inspectionForm.tire_checked_before}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, tire_checked_before: e.target.checked }))}
                          />
                          ตรวจก่อนติดตั้ง
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px", fontSize: 14, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            style={{ width: 22, height: 22, cursor: "pointer" }}
                            checked={inspectionForm.tire_checked_after}
                            onChange={(e) => setInspectionForm((prev) => ({ ...prev, tire_checked_after: e.target.checked }))}
                          />
                          ตรวจหลังติดตั้ง
                        </label>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      background: "var(--bg3)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 12
                    }}
                  >
                    <div>
                      <label className="auth-label">ลายเซ็นลูกค้า (Digital Sign)</label>
                      <div
                        style={{
                          border: "1px dashed var(--border2)",
                          borderRadius: 8,
                          background: "#fff",
                          padding: 8
                        }}
                      >
                        <canvas
                          ref={signatureCanvasRef}
                          width={1200}
                          height={340}
                          style={{ width: "100%", height: 320, display: "block", touchAction: "none", cursor: "crosshair" }}
                          onMouseDown={(e) => startCustomerSign(e.clientX, e.clientY)}
                          onMouseMove={(e) => moveCustomerSign(e.clientX, e.clientY)}
                          onMouseUp={endCustomerSign}
                          onMouseLeave={endCustomerSign}
                          onTouchStart={(e) => {
                            const touch = e.touches[0];
                            if (!touch) return;
                            startCustomerSign(touch.clientX, touch.clientY);
                          }}
                          onTouchMove={(e) => {
                            const touch = e.touches[0];
                            if (!touch) return;
                            moveCustomerSign(touch.clientX, touch.clientY);
                          }}
                          onTouchEnd={endCustomerSign}
                        />
                        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "var(--text3)" }}>เซ็นด้วยนิ้ว/เมาส์</span>
                          <button type="button" className="btn btn-ghost" style={{ padding: "10px 18px", fontSize: 14 }} onClick={clearCustomerSignature}>
                            ล้างลายเซ็น
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text3)" }}>
                        ต้องเช็กครบทุกรายการและมีลายเซ็นลูกค้าก่อนจึงจะปิดงานได้
                      </div>
                    </div>
                    <div style={{ marginTop: 10, maxWidth: 320 }}>
                      <label className="auth-label">ผู้ตรวจสอบ (ช่าง)</label>
                      <input
                        className="search-bar"
                        style={{ width: "100%" }}
                        value={currentTechnicianSignName}
                        readOnly
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label className="auth-label">หมายเหตุช่าง (จากแบบฟอร์มตรวจเช็ครถ)</label>
                    <textarea
                      className="create-input"
                      rows={3}
                      value={inspectionForm.technician_note}
                      onChange={(e) => setInspectionForm((prev) => ({ ...prev, technician_note: e.target.value }))}
                      placeholder="เช่น แนะนำลูกค้าเติมลม 33 psi"
                      style={{ width: "100%", resize: "vertical" }}
                    />
                  </div>
                </div>
              </div>



              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <span className="card-title">แนบรูปภาพหน้างาน (หลายรูป)</span>
                </div>
                <div className="card-body">
                  <div
                    className="dropzone"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDraggingUpload(true);
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDraggingUpload(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setDraggingUpload(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDraggingUpload(false);
                      appendUploadFiles(Array.from(e.dataTransfer.files ?? []));
                    }}
                    style={{
                      minHeight: 140,
                      padding: 24,
                      borderColor: draggingUpload ? "var(--accent)" : undefined,
                      background: draggingUpload ? "var(--accent-dim)" : undefined
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                    <div>
                      {draggingUpload ? "ปล่อยไฟล์ที่นี่เพื่ออัปโหลด" : "ลากไฟล์มาวาง หรือแตะเพื่อเลือกรูปภาพ"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
                      รองรับหลายรูปพร้อมกัน
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        appendUploadFiles(Array.from(e.target.files ?? []));
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>

                  {(reportPhotoUrls.length > 0 || uploadPreviewUrls.length > 0) && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>
                        รูปภาพรายงาน
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                          gap: 10
                        }}
                      >
                        {reportPhotoUrls.map((url, idx) => (
                          <div key={`saved-${idx}`} style={{ position: "relative" }}>
                            <img
                              src={url}
                              alt={`saved-photo-${idx}`}
                              style={{
                                width: "100%",
                                aspectRatio: "1 / 1",
                                objectFit: "cover",
                                borderRadius: 8,
                                border: "1px solid var(--border)"
                              }}
                            />
                            <button
                              className="exec-photo-del"
                              aria-label="ลบรูปภาพ"
                              onClick={() =>
                                setReportPhotoUrls((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                              }
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {uploadPreviewUrls.map((item, idx) => (
                          <div key={`new-${idx}`} style={{ position: "relative" }}>
                            <img
                              src={item.url}
                              alt={item.name}
                              style={{
                                width: "100%",
                                aspectRatio: "1 / 1",
                                objectFit: "cover",
                                borderRadius: 8,
                                border: "1px solid var(--border)"
                              }}
                            />
                            <button
                              className="exec-photo-del"
                              aria-label="ลบรูปภาพ"
                              onClick={() =>
                                setUploadFiles((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                              }
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <span className="card-title">เบิกเพิ่มหน้างาน</span>
                </div>
                <div className="card-body">
                  <div
                    style={{
                      background: "var(--bg3)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 12
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>
                      ข้อมูลงาน
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {(Array.isArray(executeRow.orders) ? executeRow.orders[0]?.order_no : executeRow.orders?.order_no) ?? "-"}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "var(--text2)" }}>
                      ลูกค้า: {executeRow.customer_name ?? "-"}
                    </div>
                  </div>

                  <div className="modal-grid" style={{ gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span className="auth-label">รายการสินค้า</span>
                      <select
                        className="filter-select"
                        value={issueSkuId}
                        onChange={(e) => setIssueSkuId(e.target.value)}
                        style={{ width: "100%" }}
                      >
                        <option value="">เลือกสินค้า</option>
                        {issueSkuOptions.map((sku) => (
                          <option key={sku.id} value={sku.id}>
                            {(sku.products?.brand ?? "")} {(sku.products?.name ?? "")} {sku.size_label ?? ""} ({sku.sku_code ?? "-"})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span className="auth-label">จำนวน</span>
                      <input
                        className="filter-select"
                        type="number"
                        min={1}
                        value={issueQty}
                        onChange={(e) => setIssueQty(e.target.value)}
                      />
                    </label>
                  </div>

                  {selectedIssueSku && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 8,
                        border: "1px dashed var(--border2)",
                        background: "var(--accent-dim2)",
                        fontSize: 12
                      }}
                    >
                      <strong>รายการที่เลือก:</strong>{" "}
                      {(selectedIssueSku.products?.brand ?? "")} {(selectedIssueSku.products?.name ?? "")}{" "}
                      {selectedIssueSku.size_label ?? ""} ({selectedIssueSku.sku_code ?? "-"})
                    </div>
                  )}

                  <div style={{ marginTop: 12, marginBottom: 10 }}>
                    <label className="auth-label">เหตุผล</label>
                    <textarea
                      className="auth-input"
                      rows={2}
                      value={issueReason}
                      onChange={(e) => setIssueReason(e.target.value)}
                      placeholder="เช่น เพิ่มวาล์ว / ของแถมหน้างาน"
                      style={{ width: "100%", resize: "vertical", lineHeight: 1.5 }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                    <button className="btn btn-primary" onClick={addFieldIssue} disabled={issueSaving}>
                      {issueSaving ? "กำลังบันทึก..." : "บันทึกการเบิก"}
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>สินค้า</th>
                          <th style={{ width: 80 }}>จำนวน</th>
                          <th>เหตุผล</th>
                          <th style={{ width: 160 }}>เวลา</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fieldIssues.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ color: "var(--text3)" }}>
                              ยังไม่มีรายการเบิกเพิ่มหน้างาน
                            </td>
                          </tr>
                        ) : (
                          fieldIssues.map((issue) => (
                            <tr key={issue.id}>
                              <td>
                                {(issue.skus?.products?.brand ?? "")} {(issue.skus?.products?.name ?? "")} {issue.skus?.size_label ?? ""} ({issue.skus?.sku_code ?? "-"})
                              </td>
                              <td className="mono">{issue.quantity}</td>
                              <td>{issue.reason ?? "-"}</td>
                              <td style={{ fontSize: 12, color: "var(--text2)" }}>
                                {new Date(issue.created_at).toLocaleString("th-TH")}
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
            <div className="modal-actions">
              {/*    <button className="btn btn-ghost" onClick={exportExecutionPdf}>
                Export PDF
              </button> */}
              {/*   <button
                className="btn btn-ghost"
                onClick={() => void sendExecutionReportToLine()}
                disabled={savingExecute}
              >
                {savingExecute ? "กำลังส่ง..." : "ส่งให้ลูกค้าทาง LINE"}
              </button> */}
              <button
                className="btn btn-ghost"
                onClick={() => void saveAndExportExecutionPdf()}
                disabled={savingExecute}
              >
                {savingExecute ? "กำลังบันทึก..." : "บันทึกและออก PDF"}
              </button>
              {/*    <button
                className="btn btn-primary"
                onClick={() => void saveExecutionReport()}
                disabled={savingExecute}
              >
                {savingExecute ? "กำลังบันทึก..." : "บันทึกผลการติดตั้ง"}
              </button>   */}
              <button
                className="btn btn-primary"
                onClick={openClosePreview}
                disabled={savingExecute}
              >
                ปิดงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {closePreviewOpen && executeRow && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 560 }}>
            <div className="modal-head">
              <div className="modal-title">ตรวจสอบก่อนปิดงาน</div>
              <button className="btn btn-ghost" onClick={() => setClosePreviewOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
                ให้ลูกค้าตรวจรายการและลายเซ็นก่อนยืนยันปิดงาน
              </div>

              <div style={{ fontWeight: 600, marginBottom: 8 }}>เช็คลิสต์การติดตั้ง</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px" }}>
                {executeChecklist.map((item, idx) => {
                  const resultLabel = [item.selected_option, item.note].filter(Boolean).join(" — ");
                  return (
                    <li
                      key={`${item.source_id}-${idx}`}
                      style={{
                        display: "flex",
                        gap: 8,
                        padding: "6px 0",
                        borderBottom: "1px solid var(--border)"
                      }}
                    >
                      <span>{item.checked ? "✅" : "⬜"}</span>
                      <div>
                        <div>{item.label}</div>
                        {resultLabel && (
                          <div style={{ fontSize: 12, color: "var(--text3)" }}>{resultLabel}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {executeNotes.trim() && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>หมายเหตุช่าง</div>
                  <div style={{ fontSize: 13, color: "var(--text2)" }}>{executeNotes}</div>
                </div>
              )}

              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>ลายเซ็นลูกค้า</div>
                {inspectionForm.customer_sign.startsWith("data:image") ? (
                  <img
                    src={inspectionForm.customer_sign}
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
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setClosePreviewOpen(false)}
                disabled={savingExecute}
              >
                ย้อนกลับแก้ไข
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void confirmCloseJob()}
                disabled={savingExecute}
              >
                {savingExecute ? "กำลังปิดงาน..." : "ยืนยันปิดงาน"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-actions .btn {
          min-height: 46px;
          padding: 12px 20px;
          font-size: 15px;
        }
        .modal-actions {
          box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
          border-top: 1px solid var(--border2);
        }
        .filter-select,
        .search-bar,
        .create-input {
          min-height: 42px;
          padding: 9px 14px;
          font-size: 14px;
        }
        .card-title {
          font-size: 15px;
        }
        .card-head {
          padding-top: 18px;
          padding-bottom: 18px;
        }
        .field-info-cols {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .exec-photo-del {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          line-height: 1;
          background: rgba(0, 0, 0, 0.55);
          color: #fff;
          cursor: pointer;
        }
        @media (min-width: 768px) and (max-width: 1180px) {
          .modal-card {
            max-width: min(96vw, 900px);
          }
          .modal-body {
            max-height: 78vh;
          }
        }
        @media (max-width: 820px) {
          .field-info-cols {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
