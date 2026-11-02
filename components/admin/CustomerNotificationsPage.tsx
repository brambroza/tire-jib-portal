"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import AppDatePicker from "../ui/AppDatePicker";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

type SiteRow = { id: string; name: string };
type CustomerRow = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  line_user_id?: string | null;
  line_msg_user_id?: string | null;
  line_is_friend?: boolean | null;
};
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
type RenewalRow = {
  id: string;
  vehicle_id: string;
  renewal_type: "insurance" | "act" | "tax";
  insurance_class: string | null;
  provider: string | null;
  policy_no: string | null;
  start_date: string | null;
  expiry_date: string;
  remind_before_days: number;
  active: boolean;
};
type ServiceRow = {
  id: string;
  vehicle_id: string;
  service_type: "battery" | "tire" | "inspection";
  service_date: string | null;
  mileage_at_service: number | null;
  next_due_date: string | null;
  next_due_mileage: number | null;
  remind_before_days: number;
  note: string | null;
  active: boolean;
};
type NotificationRow = {
  id: string;
  site_id: string;
  customer_id: string;
  vehicle_id: string | null;
  source_type: "renewal" | "service" | "install_item";
  source_id: string;
  remind_days: number;
  due_date: string | null;
  title: string | null;
  message: string | null;
  status: "pending" | "sent" | "failed" | "skipped";
  channel: string;
  sent_at: string | null;
  updated_at: string | null;
};

type LineConversationRow = {
  line_user_id: string;
  customer_id: string | null;
};

type PendingNotificationItem = {
  source_type: "renewal" | "service";
  source_id: string;
  site_id: string;
  customer_id: string;
  vehicle_id: string | null;
  due_date: string | null;
  days_left: number | null;
  remind_days: number;
  title: string;
  message: string;
  customer_label: string;
  line_user_id: string | null;
  line_msg_user_id: string | null;
  vehicle_label: string;
  status: NotificationRow["status"] | "new";
};

type DueItem = {
  source_type: "install_item";
  source_id: string;
  site_id: string;
  customer_id: string;
  vehicle_id: string | null;
  start_date: string;
  due_date: string;
  days_left: number;
  type_label: string;
  customer_label: string;
  vehicle_label: string;
  item_label: string;
  lifecycle_years: number;
  title: string;
  message: string;
};

type InstallReportRow = {
  id: string;
  appointment_id: string;
  executed_at: string | null;
  created_at: string;
};

type InstallReportItemRow = {
  id: string;
  report_id: string;
  source_type: "order_item" | "extra";
  label: string;
  is_checked: boolean;
  created_at: string;
};

type InstallAppointmentRow = {
  id: string;
  order_id: string;
  scheduled_at: string | null;
};

type OrderBriefRow = {
  id: string;
  order_no: string;
  site_id: string;
  customer_id: string;
  created_at: string;
  datetrans: string | null;
};

type ReminderTableRow = {
  id: string;
  kind: "renewal" | "service";
  source_type: "renewal" | "service";
  source_id: string;
  remind_days: number;
  customer_id: string;
  site_id: string;
  vehicle_id: string | null;
  type_label: string;
  vehicle_label: string;
  customer_label: string;
  line_user_id: string | null;
  line_msg_user_id: string | null;
  start_date: string | null;
  due_date: string | null;
  due_mileage: number | null;
  message: string;
  active: boolean;
};

const RENEWAL_TYPE_OPTIONS: { value: RenewalRow["renewal_type"]; label: string }[] = [
  { value: "insurance", label: "แจ้งต่อประกัน" },
  { value: "act", label: "แจ้งต่อ พ.ร.บ." },
  { value: "tax", label: "แจ้งต่อภาษี" }
];
const INSURANCE_CLASS_OPTIONS = ["ชั้น 1", "ชั้น 2", "2+", "ชั้น 3", "3+"];
const SERVICE_TYPE_OPTIONS: { value: ServiceRow["service_type"]; label: string }[] = [
  { value: "battery", label: "แจ้งเปลี่ยนแบตเตอรี่" },
  { value: "tire", label: "แจ้งเปลี่ยนยาง" },
  { value: "inspection", label: "แจ้งเช็คสภาพรถ" }
];
const REMIND_WINDOWS = [7, 15, 30] as const;

const EMPTY_RENEWAL_FORM = {
  id: "",
  vehicle_id: "",
  customer_id: "",
  plate_no: "",
  car_model: "",
  renewal_type: "insurance" as RenewalRow["renewal_type"],
  insurance_class: "",
  provider: "",
  policy_no: "",
  start_date: "",
  expiry_date: "",
  insurance_expiry_date: "",
  act_expiry_date: "",
  tax_expiry_date: "",
  remind_before_days: "30",
  active: true
};

const EMPTY_SERVICE_FORM = {
  id: "",
  vehicle_id: "",
  service_type: "battery" as ServiceRow["service_type"],
  service_date: "",
  mileage_at_service: "",
  next_due_date: "",
  next_due_mileage: "",
  remind_before_days: "30",
  note: "",
  active: true
};

function dateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffDays(fromDate: Date, toDate: Date) {
  const ms = dateOnly(toDate).getTime() - dateOnly(fromDate).getTime();
  return Math.floor(ms / 86400000);
}

function addYears(isoDate: string, years: number) {
  const date = new Date(isoDate);
  date.setFullYear(date.getFullYear() + years);
  return date;
}

function canSendLineUserId(value: string | null | undefined) {
  return /^U[0-9a-f]{32}$/i.test((value ?? "").trim());
}

function getLineSendTarget(lineUserId: string | null | undefined, lineMsgUserId: string | null | undefined) {
  if (canSendLineUserId(lineUserId)) return lineUserId?.trim() ?? "";
  if (canSendLineUserId(lineMsgUserId)) return lineMsgUserId?.trim() ?? "";
  return "";
}

function maskLineTarget(value: string) {
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function buildReminderFlexMessage(item: PendingNotificationItem): Record<string, unknown> {
  const dueText = item.due_date ? new Date(item.due_date).toLocaleDateString("th-TH") : "-";
  const daysText = item.days_left === null ? "-" : `${item.days_left} วัน`;
  const statusColor =
    item.days_left !== null && item.days_left <= 7
      ? "#dc2626"
      : item.days_left !== null && item.days_left <= 15
        ? "#d97706"
        : "#059669";

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      backgroundColor: "#06C755",
      contents: [
        {
          type: "text",
          text: "แจ้งเตือนลูกค้า",
          color: "#ffffff",
          weight: "bold",
          size: "lg"
        },
        {
          type: "text",
          text: item.title,
          color: "#eafff2",
          size: "sm",
          wrap: true,
          margin: "sm"
        }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            { type: "text", text: "ลูกค้า", size: "xs", color: "#6b7280" },
            { type: "text", text: item.customer_label || "-", size: "md", weight: "bold", color: "#111827", wrap: true }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          spacing: "md",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 1,
              contents: [
                { type: "text", text: "ทะเบียนรถ", size: "xs", color: "#6b7280" },
                { type: "text", text: item.vehicle_label || "-", size: "md", weight: "bold", color: "#111827", wrap: true }
              ]
            },
            {
              type: "box",
              layout: "vertical",
              flex: 1,
              contents: [
                { type: "text", text: "ครบกำหนด", size: "xs", color: "#6b7280" },
                { type: "text", text: dueText, size: "md", weight: "bold", color: "#111827", wrap: true }
              ]
            }
          ]
        },
        {
          type: "box",
          layout: "vertical",
          paddingAll: "14px",
          cornerRadius: "10px",
          backgroundColor: "#f9fafb",
          contents: [
            { type: "text", text: "เหลือเวลา", size: "xs", color: "#6b7280" },
            { type: "text", text: daysText, size: "xl", weight: "bold", color: statusColor }
          ]
        },
        {
          type: "separator",
          margin: "md"
        },
        {
          type: "text",
          text: item.message,
          size: "sm",
          color: "#374151",
          wrap: true
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: "กรุณาติดต่อร้านเพื่อดำเนินการต่ออายุ",
          size: "xs",
          color: "#6b7280",
          align: "center",
          wrap: true
        }
      ]
    }
  };
}

export default function CustomerNotificationsPage() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [siteId, setSiteId] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [renewals, setRenewals] = useState<RenewalRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [lineConversationByCustomer, setLineConversationByCustomer] = useState<Record<string, string>>({});
  const [installDueItems, setInstallDueItems] = useState<DueItem[]>([]);
  const [dueWindow, setDueWindow] = useState<(typeof REMIND_WINDOWS)[number]>(7);
  const [renewalForm, setRenewalForm] = useState(EMPTY_RENEWAL_FORM);
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderFormType, setReminderFormType] = useState<"renewal" | "service">("renewal");

  const hasSupabase = useMemo(() => Boolean(supabase), []);

  const vehicleMap = useMemo(() => new Map(vehicles.map((row) => [row.id, row])), [vehicles]);
  const customerMap = useMemo(() => new Map(customers.map((row) => [row.id, row])), [customers]);

  const siteVehicles = useMemo(() => {
    if (!siteId) return vehicles;
    return vehicles.filter((row) => row.site_id === siteId);
  }, [vehicles, siteId]);

  const siteRenewals = useMemo(() => {
    const allowed = new Set(siteVehicles.map((row) => row.id));
    return renewals.filter((row) => allowed.has(row.vehicle_id));
  }, [renewals, siteVehicles]);

  const siteServices = useMemo(() => {
    const allowed = new Set(siteVehicles.map((row) => row.id));
    return services.filter((row) => allowed.has(row.vehicle_id));
  }, [services, siteVehicles]);

  const siteNotifications = useMemo(() => {
    if (!siteId) return notifications;
    return notifications.filter((row) => row.site_id === siteId);
  }, [notifications, siteId]);

  const notificationMap = useMemo(() => {
    const map = new Map<string, NotificationRow>();
    siteNotifications.forEach((row) => {
      map.set(`${row.source_type}:${row.source_id}:${row.remind_days}`, row);
    });
    return map;
  }, [siteNotifications]);

  const reminderRows = useMemo(() => {
    const renewalRows: ReminderTableRow[] = siteRenewals.map((row) => {
      const vehicle = vehicleMap.get(row.vehicle_id);
      const customer = vehicle ? customerMap.get(vehicle.customer_id) : null;
      const customerLabel = customer?.full_name || customer?.display_name || customer?.phone || vehicle?.customer_id || "-";
      const typeLabel = [
        RENEWAL_TYPE_OPTIONS.find((item) => item.value === row.renewal_type)?.label ?? row.renewal_type,
        row.renewal_type === "insurance" && row.insurance_class ? row.insurance_class : ""
      ].filter(Boolean).join(" ");
      return {
        id: row.id,
        kind: "renewal",
        source_type: "renewal",
        source_id: row.id,
        remind_days: row.remind_before_days,
        customer_id: vehicle?.customer_id ?? "",
        site_id: vehicle?.site_id ?? "",
        vehicle_id: row.vehicle_id,
        type_label: typeLabel,
        vehicle_label: vehicle?.plate_no ?? "-",
        customer_label: customerLabel,
        line_user_id: lineConversationByCustomer[vehicle?.customer_id ?? ""] || customer?.line_user_id || null,
        line_msg_user_id: customer?.line_msg_user_id || null,
        start_date: row.start_date ?? null,
        due_date: row.expiry_date ?? null,
        due_mileage: null,
        message: [
          `เรียนคุณ${customerLabel}`,
          `${typeLabel} ของรถทะเบียน ${vehicle?.plate_no ?? "-"} จะหมดอายุวันที่ ${new Date(row.expiry_date).toLocaleDateString("th-TH")}`,
          "กรุณาติดต่อเพื่อต่ออายุ"
        ].join("\n"),
        active: row.active
      };
    });
    const serviceRows: ReminderTableRow[] = siteServices.map((row) => {
      const vehicle = vehicleMap.get(row.vehicle_id);
      const customer = vehicle ? customerMap.get(vehicle.customer_id) : null;
      const customerLabel = customer?.full_name || customer?.display_name || customer?.phone || vehicle?.customer_id || "-";
      const typeLabel = SERVICE_TYPE_OPTIONS.find((item) => item.value === row.service_type)?.label ?? row.service_type;
      return {
        id: row.id,
        kind: "service",
        source_type: "service",
        source_id: row.id,
        remind_days: row.remind_before_days,
        customer_id: vehicle?.customer_id ?? "",
        site_id: vehicle?.site_id ?? "",
        vehicle_id: row.vehicle_id,
        type_label: typeLabel,
        vehicle_label: vehicle?.plate_no ?? "-",
        customer_label: customerLabel,
        line_user_id: lineConversationByCustomer[vehicle?.customer_id ?? ""] || customer?.line_user_id || null,
        line_msg_user_id: customer?.line_msg_user_id || null,
        start_date: row.service_date ?? null,
        due_date: row.next_due_date ?? null,
        due_mileage: row.next_due_mileage ?? null,
        message: [
          `เรียนคุณ${customerLabel}`,
          `${typeLabel} ของรถทะเบียน ${vehicle?.plate_no ?? "-"} ครบกำหนดวันที่ ${row.next_due_date ? new Date(row.next_due_date).toLocaleDateString("th-TH") : "-"}`,
          "กรุณาติดต่อเพื่อนัดหมายบริการ"
        ].join("\n"),
        active: row.active
      };
    });
    return [...renewalRows, ...serviceRows].sort((a, b) => {
      const left = a.due_date ?? "";
      const right = b.due_date ?? "";
      return left.localeCompare(right);
    });
  }, [customerMap, lineConversationByCustomer, siteRenewals, siteServices, vehicleMap]);

  const pendingNotifications = useMemo(() => {
    const today = new Date();
    const rows: PendingNotificationItem[] = [];
    siteRenewals.forEach((row) => {
      if (!row.active) return;
      const vehicle = vehicleMap.get(row.vehicle_id);
      if (!vehicle) return;
      const dueDate = new Date(`${row.expiry_date}T00:00:00`);
      const daysLeft = diffDays(today, dueDate);
      if (daysLeft < 0 || daysLeft > row.remind_before_days) return;
      const customer = customerMap.get(vehicle.customer_id);
      const typeLabel = RENEWAL_TYPE_OPTIONS.find((item) => item.value === row.renewal_type)?.label ?? row.renewal_type;
      const detail = row.renewal_type === "insurance" && row.insurance_class ? ` (${row.insurance_class})` : "";
      const customerLabel = customer?.full_name || customer?.display_name || customer?.phone || vehicle.customer_id;
      const title = `${typeLabel}${detail} ใกล้หมดอายุ`;
      const message = [
        `เรียนคุณ${customerLabel}`,
        `${typeLabel}${detail} ของรถทะเบียน ${vehicle.plate_no} จะหมดอายุวันที่ ${new Date(row.expiry_date).toLocaleDateString("th-TH")}`,
        `เหลืออีก ${daysLeft} วัน กรุณาติดต่อเพื่อต่ออายุ`
      ].join("\n");
      const status = notificationMap.get(`renewal:${row.id}:${row.remind_before_days}`)?.status ?? "new";
      rows.push({
        source_type: "renewal",
        source_id: row.id,
        site_id: vehicle.site_id,
        customer_id: vehicle.customer_id,
        vehicle_id: vehicle.id,
        due_date: row.expiry_date,
        days_left: daysLeft,
        remind_days: row.remind_before_days,
        title,
        message,
        customer_label: customerLabel,
        line_user_id: lineConversationByCustomer[vehicle.customer_id] || customer?.line_user_id || null,
        line_msg_user_id: customer?.line_msg_user_id || null,
        vehicle_label: vehicle.plate_no,
        status
      });
    });
    siteServices.forEach((row) => {
      if (!row.active || !row.next_due_date) return;
      const vehicle = vehicleMap.get(row.vehicle_id);
      if (!vehicle) return;
      const dueDate = new Date(`${row.next_due_date}T00:00:00`);
      const daysLeft = diffDays(today, dueDate);
      if (daysLeft < 0 || daysLeft > row.remind_before_days) return;
      const customer = customerMap.get(vehicle.customer_id);
      const typeLabel = SERVICE_TYPE_OPTIONS.find((item) => item.value === row.service_type)?.label ?? row.service_type;
      const customerLabel = customer?.full_name || customer?.display_name || customer?.phone || vehicle.customer_id;
      const title = `${typeLabel} ใกล้ครบกำหนด`;
      const message = [
        `เรียนคุณ${customerLabel}`,
        `${typeLabel} ของรถทะเบียน ${vehicle.plate_no} ครบกำหนดวันที่ ${new Date(row.next_due_date).toLocaleDateString("th-TH")}`,
        `เหลืออีก ${daysLeft} วัน กรุณาติดต่อเพื่อนัดหมายบริการ`
      ].join("\n");
      const status = notificationMap.get(`service:${row.id}:${row.remind_before_days}`)?.status ?? "new";
      rows.push({
        source_type: "service",
        source_id: row.id,
        site_id: vehicle.site_id,
        customer_id: vehicle.customer_id,
        vehicle_id: vehicle.id,
        due_date: row.next_due_date,
        days_left: daysLeft,
        remind_days: row.remind_before_days,
        title,
        message,
        customer_label: customerLabel,
        line_user_id: lineConversationByCustomer[vehicle.customer_id] || customer?.line_user_id || null,
        line_msg_user_id: customer?.line_msg_user_id || null,
        vehicle_label: vehicle.plate_no,
        status
      });
    });
    return rows.sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999));
  }, [customerMap, lineConversationByCustomer, notificationMap, siteRenewals, siteServices, vehicleMap]);

  const dueItems = useMemo(() => installDueItems, [installDueItems]);
  const reminderPagination = useTablePagination(reminderRows, 10);
  const duePagination = useTablePagination(dueItems, 10);

  const loadData = useCallback(async (options?: { preserveFeedback?: boolean }) => {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setLoading(true);
    if (!options?.preserveFeedback) {
      setError(null);
      setSuccess(null);
    }
    const [
      { data: siteData, error: siteError },
      { data: customerData, error: customerError },
      { data: vehicleData, error: vehicleError },
      { data: renewalData, error: renewalError },
      { data: serviceData, error: serviceError },
      { data: notifyData, error: notifyError }
    ] = await Promise.all([
      supabase.from("sites").select("id,name").order("created_at", { ascending: true }),
      supabase
        .from("customes")
        .select("id,full_name,display_name,email,phone,line_user_id,line_msg_user_id,line_is_friend")
        .order("created_at", { ascending: false }),
      supabase
        .from("customer_vehicles")
        .select("id,customer_id,site_id,plate_no,brand,model,year,current_mileage,active,updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("vehicle_renewals")
        .select("id,vehicle_id,renewal_type,insurance_class,provider,policy_no,start_date,expiry_date,remind_before_days,active")
        .order("expiry_date", { ascending: true }),
      supabase
        .from("vehicle_service_records")
        .select("id,vehicle_id,service_type,service_date,mileage_at_service,next_due_date,next_due_mileage,remind_before_days,note,active")
        .order("next_due_date", { ascending: true }),
      supabase
        .from("customer_notifications")
        .select("id,site_id,customer_id,vehicle_id,source_type,source_id,remind_days,due_date,title,message,status,channel,sent_at,updated_at")
        .order("updated_at", { ascending: false })
    ]);

    const firstError =
      siteError ?? customerError ?? vehicleError ?? renewalError ?? serviceError ?? notifyError;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const nextSites = (siteData ?? []) as SiteRow[];
    setSites(nextSites);
    if (!siteId && nextSites.length > 0) {
      setSiteId(nextSites[0].id);
    }
    setCustomers((customerData ?? []) as CustomerRow[]);
    setVehicles((vehicleData ?? []) as VehicleRow[]);
    setRenewals((renewalData ?? []) as RenewalRow[]);
    setServices((serviceData ?? []) as ServiceRow[]);
    setNotifications((notifyData ?? []) as NotificationRow[]);
    try {
      const lineResponse = await fetch("/api/line/conversations");
      const linePayload = (await lineResponse.json().catch(() => ({}))) as {
        conversations?: LineConversationRow[];
      };
      const nextLineMap: Record<string, string> = {};
      (linePayload.conversations ?? []).forEach((row) => {
        if (row.customer_id && canSendLineUserId(row.line_user_id)) {
          nextLineMap[row.customer_id] = row.line_user_id;
        }
      });
      setLineConversationByCustomer(nextLineMap);
    } catch {
      setLineConversationByCustomer({});
    }
    setLoading(false);
  }, [siteId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadInstallDueItems = useCallback(async () => {
    if (!supabase) return;
    const [
      { data: reportData, error: reportError },
      { data: reportItemData, error: reportItemError }
    ] = await Promise.all([
      supabase
        .from("install_execution_reports")
        .select("id,appointment_id,executed_at,created_at"),
      supabase
        .from("install_execution_report_items")
        .select("id,report_id,source_type,label,is_checked,created_at")
        .eq("is_checked", true)
    ]);
    if (reportError || reportItemError) {
      setError(reportError?.message ?? reportItemError?.message ?? "โหลดรายการแจ้งเตือนไม่สำเร็จ");
      return;
    }

    const reports = (reportData ?? []) as InstallReportRow[];
    const reportItems = (reportItemData ?? []) as InstallReportItemRow[];
    if (reports.length === 0 || reportItems.length === 0) {
      setInstallDueItems([]);
      return;
    }

    const appointmentIds = Array.from(new Set(reports.map((row) => row.appointment_id)));
    const { data: appointmentData, error: appointmentError } = await supabase
      .from("install_appointments")
      .select("id,order_id,scheduled_at")
      .in("id", appointmentIds);
    if (appointmentError) {
      setError(appointmentError.message);
      return;
    }

    const appointments = (appointmentData ?? []) as InstallAppointmentRow[];
    const orderIds = Array.from(new Set(appointments.map((row) => row.order_id)));
    if (orderIds.length === 0) {
      setInstallDueItems([]);
      return;
    }
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id,order_no,site_id,customer_id,created_at,datetrans")
      .in("id", orderIds);
    if (orderError) {
      setError(orderError.message);
      return;
    }
    const orders = (orderData ?? []) as OrderBriefRow[];

    const reportMap = new Map(reports.map((row) => [row.id, row]));
    const appointmentMap = new Map(appointments.map((row) => [row.id, row]));
    const orderMap = new Map(orders.map((row) => [row.id, row]));
    const customerLookup = new Map(customers.map((row) => [row.id, row]));

    const today = new Date();
    const built = reportItems
      .map((item) => {
        const report = reportMap.get(item.report_id);
        if (!report) return null;
        const appointment = appointmentMap.get(report.appointment_id);
        if (!appointment) return null;
        const order = orderMap.get(appointment.order_id);
        if (!order) return null;
        if (siteId && order.site_id !== siteId) return null;

        const startCandidate =
          (order.datetrans ? `${order.datetrans}T09:00:00` : null) ??
          report.executed_at ??
          appointment.scheduled_at ??
          order.created_at ??
          report.created_at;
        const startDateObj = new Date(startCandidate);
        if (Number.isNaN(startDateObj.getTime())) return null;

        const lifecycleYears = item.source_type === "extra" ? 1 : 2;
        const dueDateObj = addYears(startDateObj.toISOString(), lifecycleYears);
        const daysLeft = diffDays(today, dueDateObj);
        if (daysLeft < 0 || daysLeft > dueWindow) return null;

        const customer = customerLookup.get(order.customer_id);
        const customerLabel =
          customer?.full_name?.trim() ||
          customer?.display_name?.trim() ||
          customer?.email ||
          customer?.phone ||
          order.customer_id;
        const startDate = startDateObj.toISOString().slice(0, 10);
        const dueDate = dueDateObj.toISOString().slice(0, 10);
        const typeLabel = lifecycleYears === 2 ? "สินค้าหลัก/ยาง (2 ปี)" : "งานเสริม (1 ปี)";

        return {
          source_type: "install_item" as const,
          source_id: item.id,
          site_id: order.site_id,
          customer_id: order.customer_id,
          vehicle_id: null,
          start_date: startDate,
          due_date: dueDate,
          days_left: daysLeft,
          type_label: typeLabel,
          customer_label: customerLabel,
          vehicle_label: order.order_no,
          item_label: item.label || "-",
          lifecycle_years: lifecycleYears,
          title: `${typeLabel} ${item.label || ""}`.trim(),
          message: `เริ่ม ${startDate} ครบกำหนด ${dueDate} (อีก ${daysLeft} วัน)`
        } as DueItem;
      })
      .filter((row): row is DueItem => Boolean(row))
      .sort((a, b) => a.days_left - b.days_left);
    setInstallDueItems(built);
  }, [customers, dueWindow, siteId]);

  useEffect(() => {
    void loadInstallDueItems();
  }, [loadInstallDueItems]);

  async function saveRenewal() {
    if (!supabase) return;
    if (!renewalForm.customer_id || !renewalForm.plate_no.trim()) {
      setError("กรุณาเลือกลูกค้าและกรอกทะเบียนรถ");
      return;
    }
    if (!renewalForm.insurance_expiry_date && !renewalForm.act_expiry_date && !renewalForm.tax_expiry_date) {
      setError("กรุณาระบุวันหมดอายุอย่างน้อย 1 รายการ");
      return;
    }
    const remind = Number(renewalForm.remind_before_days || 30);
    if (!Number.isFinite(remind) || remind <= 0) {
      setError("จำนวนวันแจ้งล่วงหน้าไม่ถูกต้อง");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const vehiclePayload = {
        customer_id: renewalForm.customer_id,
        site_id: siteId || sites[0]?.id,
        plate_no: renewalForm.plate_no.trim(),
        model: renewalForm.car_model.trim() || null,
        active: true,
        updated_at: new Date().toISOString()
      };
      if (!vehiclePayload.site_id) throw new Error("ไม่พบเว็บไซต์สำหรับบันทึกรถ");

      const { data: vehicleData, error: vehicleError } = await supabase
        .from("customer_vehicles")
        .upsert(vehiclePayload, { onConflict: "site_id,plate_no" })
        .select("id")
        .single();
      if (vehicleError || !vehicleData?.id) {
        throw new Error(vehicleError?.message ?? "บันทึกข้อมูลรถไม่สำเร็จ");
      }

      const rows = [
        {
          renewal_type: "insurance",
          insurance_class: renewalForm.insurance_class || null,
          expiry_date: renewalForm.insurance_expiry_date || null
        },
        {
          renewal_type: "act",
          insurance_class: null,
          expiry_date: renewalForm.act_expiry_date || null
        },
        {
          renewal_type: "tax",
          insurance_class: null,
          expiry_date: renewalForm.tax_expiry_date || null
        }
      ].filter((row) => Boolean(row.expiry_date));

      for (const row of rows) {
        const { error: upsertError } = await supabase
          .from("vehicle_renewals")
          .upsert(
            {
              vehicle_id: vehicleData.id,
              renewal_type: row.renewal_type,
              insurance_class: row.insurance_class,
              provider: renewalForm.provider.trim() || null,
              policy_no: renewalForm.policy_no.trim() || null,
              start_date: renewalForm.start_date || null,
              expiry_date: row.expiry_date,
              remind_before_days: remind,
              active: renewalForm.active,
              updated_at: new Date().toISOString()
            },
            { onConflict: "vehicle_id,renewal_type" }
          );
        if (upsertError) throw new Error(upsertError.message);
      }

      setSuccess("บันทึกรายการประกัน/พ.ร.บ./ภาษีเรียบร้อย");
      setRenewalForm(EMPTY_RENEWAL_FORM);
      setReminderDialogOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกรายการต่อทะเบียนไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRenewal(row: RenewalRow) {
    if (!supabase) return;
    if (!confirm("ลบรายการต่อทะเบียนนี้ใช่หรือไม่")) return;
    setSaving(true);
    setError(null);
    const { error: deleteError } = await supabase.from("vehicle_renewals").delete().eq("id", row.id);
    if (deleteError) setError(deleteError.message);
    else {
      setSuccess("ลบรายการต่อทะเบียนเรียบร้อย");
      if (renewalForm.id === row.id) setRenewalForm(EMPTY_RENEWAL_FORM);
      await loadData();
    }
    setSaving(false);
  }

  async function saveService() {
    if (!supabase) return;
    if (!serviceForm.vehicle_id) {
      setError("กรุณาเลือกรถ");
      return;
    }
    if (!serviceForm.next_due_date && !serviceForm.next_due_mileage) {
      setError("กรุณาระบุวันครบกำหนดถัดไป หรือเลขไมล์ครบกำหนดถัดไป");
      return;
    }
    const remind = Number(serviceForm.remind_before_days || 30);
    if (!Number.isFinite(remind) || remind <= 0) {
      setError("จำนวนวันแจ้งล่วงหน้าไม่ถูกต้อง");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const payload = {
      vehicle_id: serviceForm.vehicle_id,
      service_type: serviceForm.service_type,
      service_date: serviceForm.service_date || null,
      mileage_at_service: serviceForm.mileage_at_service ? Number(serviceForm.mileage_at_service) : null,
      next_due_date: serviceForm.next_due_date || null,
      next_due_mileage: serviceForm.next_due_mileage ? Number(serviceForm.next_due_mileage) : null,
      remind_before_days: remind,
      note: serviceForm.note.trim() || null,
      active: serviceForm.active,
      updated_at: new Date().toISOString()
    };
    if (serviceForm.id) {
      const { error: updateError } = await supabase.from("vehicle_service_records").update(payload).eq("id", serviceForm.id);
      if (updateError) setError(updateError.message);
      else {
        setSuccess("อัปเดตรายการบริการเรียบร้อย");
        setServiceForm(EMPTY_SERVICE_FORM);
        await loadData();
      }
    } else {
      const { error: insertError } = await supabase.from("vehicle_service_records").insert(payload);
      if (insertError) setError(insertError.message);
      else {
        setSuccess("เพิ่มรายการบริการเรียบร้อย");
        setServiceForm(EMPTY_SERVICE_FORM);
        await loadData();
      }
    }
    setSaving(false);
  }

  async function deleteService(row: ServiceRow) {
    if (!supabase) return;
    if (!confirm("ลบรายการบริการนี้ใช่หรือไม่")) return;
    setSaving(true);
    setError(null);
    const { error: deleteError } = await supabase.from("vehicle_service_records").delete().eq("id", row.id);
    if (deleteError) setError(deleteError.message);
    else {
      setSuccess("ลบรายการบริการเรียบร้อย");
      if (serviceForm.id === row.id) setServiceForm(EMPTY_SERVICE_FORM);
      await loadData();
    }
    setSaving(false);
  }

  async function updateNotificationStatus(item: DueItem, status: NotificationRow["status"]) {
    if (!supabase) return;
    const payload = {
      site_id: item.site_id,
      customer_id: item.customer_id,
      vehicle_id: item.vehicle_id,
      source_type: item.source_type,
      source_id: item.source_id,
      remind_days: dueWindow,
      due_date: item.due_date,
      title: item.title,
      message: item.message,
      status,
      channel: "line",
      sent_at: status === "sent" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
    setSaving(true);
    setError(null);
    const { error: upsertError } = await supabase
      .from("customer_notifications")
      .upsert(payload, { onConflict: "source_type,source_id,remind_days" });
    if (upsertError) setError(upsertError.message);
    else {
      setSuccess(status === "sent" ? "อัปเดตสถานะเป็นส่งแล้ว" : "อัปเดตสถานะเป็นรอส่ง");
      await loadData();
    }
    setSaving(false);
  }

  async function upsertPendingNotification(item: PendingNotificationItem, status: NotificationRow["status"]) {
    if (!supabase) return;
    const payload = {
      site_id: item.site_id,
      customer_id: item.customer_id,
      vehicle_id: item.vehicle_id,
      source_type: item.source_type,
      source_id: item.source_id,
      remind_days: item.remind_days,
      due_date: item.due_date,
      title: item.title,
      message: item.message,
      status,
      channel: "line",
      sent_at: status === "sent" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
    const { error: upsertError } = await supabase
      .from("customer_notifications")
      .upsert(payload, { onConflict: "source_type,source_id,remind_days" });
    if (upsertError) throw new Error(upsertError.message);
  }

  async function sendPendingNotificationToLine(item: PendingNotificationItem) {
    const primaryTarget = getLineSendTarget(item.line_user_id, null);
    const fallbackTarget = getLineSendTarget(null, item.line_msg_user_id);
    const targets = [
      primaryTarget ? { label: "line_user_id", value: primaryTarget } : null,
      fallbackTarget && fallbackTarget !== primaryTarget ? { label: "line_msg_user_id", value: fallbackTarget } : null
    ].filter((row): row is { label: string; value: string } => Boolean(row));
    if (targets.length === 0) {
      setError("ไม่พบ LINE User ID ที่ส่งได้ของลูกค้ารายนี้ ต้องขึ้นต้นด้วย U");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const flexMessage = buildReminderFlexMessage(item);
      const sendLine = (to: string) => fetch("/api/line/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          type: "user",
          messages: [
            {
              type: "flex",
              altText: item.title || "แจ้งเตือนลูกค้า",
              contents: flexMessage
            }
          ]
        })
      });

      const failures: string[] = [];
      let sent = false;
      for (const target of targets) {
        const response = await sendLine(target.value);
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (response.ok) {
          sent = true;
          break;
        }
        failures.push(`${target.label} ${maskLineTarget(target.value)}: ${payload.error || "LINE ส่งไม่สำเร็จ"}`);
      }

      await upsertPendingNotification(item, sent ? "sent" : "failed");
      if (!sent) {
        throw new Error(
          [
            "ส่ง LINE ไม่สำเร็จ",
            ...failures,
            "สาเหตุที่พบบ่อย: ลูกค้ายังไม่ได้เป็นเพื่อนกับ LINE OA, บล็อก OA, หรือ userId มาจากคนละ LINE channel"
          ].join("\n")
        );
      }
      setSuccess("ส่งข้อความแจ้งเตือนผ่าน LINE เรียบร้อย");
      await loadData({ preserveFeedback: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งข้อความ LINE ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function sendReminderRowToLine(row: ReminderTableRow) {
    await sendPendingNotificationToLine({
      source_type: row.source_type,
      source_id: row.source_id,
      site_id: row.site_id,
      customer_id: row.customer_id,
      vehicle_id: row.vehicle_id,
      due_date: row.due_date,
      days_left: row.due_date ? diffDays(new Date(), new Date(`${row.due_date}T00:00:00`)) : null,
      remind_days: row.remind_days,
      title: row.type_label,
      message: row.message,
      customer_label: row.customer_label,
      line_user_id: row.line_user_id,
      line_msg_user_id: row.line_msg_user_id,
      vehicle_label: row.vehicle_label,
      status: "new"
    });
  }

  function openCreateReminder() {
    setReminderFormType("renewal");
    setRenewalForm(EMPTY_RENEWAL_FORM);
    setServiceForm(EMPTY_SERVICE_FORM);
    setReminderDialogOpen(true);
  }

  function openEditReminder(row: ReminderTableRow) {
    if (row.kind === "renewal") {
      const source = siteRenewals.find((item) => item.id === row.id);
      if (!source) return;
      const vehicle = vehicleMap.get(source.vehicle_id);
      const vehicleRenewals = siteRenewals.filter((item) => item.vehicle_id === source.vehicle_id);
      const insurance = vehicleRenewals.find((item) => item.renewal_type === "insurance");
      const act = vehicleRenewals.find((item) => item.renewal_type === "act");
      const tax = vehicleRenewals.find((item) => item.renewal_type === "tax");
      setReminderFormType("renewal");
      setRenewalForm({
        id: source.id,
        vehicle_id: source.vehicle_id,
        customer_id: vehicle?.customer_id ?? "",
        plate_no: vehicle?.plate_no ?? "",
        car_model: vehicle?.model ?? "",
        renewal_type: "insurance",
        insurance_class: insurance?.insurance_class ?? "",
        provider: insurance?.provider ?? source.provider ?? "",
        policy_no: insurance?.policy_no ?? source.policy_no ?? "",
        start_date: source.start_date ?? "",
        expiry_date: source.expiry_date,
        insurance_expiry_date: insurance?.expiry_date ?? "",
        act_expiry_date: act?.expiry_date ?? "",
        tax_expiry_date: tax?.expiry_date ?? "",
        remind_before_days: String(source.remind_before_days ?? 30),
        active: source.active
      });
      setServiceForm(EMPTY_SERVICE_FORM);
    } else {
      const source = siteServices.find((item) => item.id === row.id);
      if (!source) return;
      setReminderFormType("service");
      setServiceForm({
        id: source.id,
        vehicle_id: source.vehicle_id,
        service_type: source.service_type,
        service_date: source.service_date ?? "",
        mileage_at_service: source.mileage_at_service ? String(source.mileage_at_service) : "",
        next_due_date: source.next_due_date ?? "",
        next_due_mileage: source.next_due_mileage ? String(source.next_due_mileage) : "",
        remind_before_days: String(source.remind_before_days ?? 30),
        note: source.note ?? "",
        active: source.active
      });
      setRenewalForm(EMPTY_RENEWAL_FORM);
    }
    setReminderDialogOpen(true);
  }

  async function deleteReminder(row: ReminderTableRow) {
    if (row.kind === "renewal") {
      const source = siteRenewals.find((item) => item.id === row.id);
      if (source) await deleteRenewal(source);
      return;
    }
    const source = siteServices.find((item) => item.id === row.id);
    if (source) await deleteService(source);
  }

  return (
    <div className="page active cnp-page">
      {/* <div className="toolbar" style={{ marginBottom: 18, gap: 10 }}>
        <label>
          <span className="auth-label">เว็บไซต์</span>
          <select className="filter-select" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="auth-label">รายการใกล้ครบกำหนด</span>
          <select
            className="filter-select"
            value={dueWindow}
            onChange={(event) => setDueWindow(Number(event.target.value) as (typeof REMIND_WINDOWS)[number])}
          >
            {REMIND_WINDOWS.map((day) => (
              <option key={day} value={day}>{day} วัน</option>
            ))}
          </select>
        </label>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={loadData} disabled={loading || saving}>รีเฟรช</button>
      </div> */}

      <ActionFeedback
        error={error}
        success={success}
        onClearError={() => setError(null)}
        onClearSuccess={() => setSuccess(null)}
      />

      {!hasSupabase ? (
        <div className="card"><div className="card-body" style={{ color: "var(--red)" }}>ยังไม่ได้ตั้งค่า Supabase env</div></div>
      ) : (
        <>


          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-head">
              <span className="card-title">รายการแจ้งเตือนลูกค้า</span>
              <button className="btn btn-primary" style={{ padding: "5px 12px", fontSize: 12 }} onClick={openCreateReminder}>
                เพิ่มรายการ
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>ประเภท</th><th>ลูกค้า</th><th>รถ</th><th>วันที่เริ่ม</th><th>ครบกำหนด</th><th>ไมล์ครบกำหนด</th><th>สถานะ</th><th></th></tr></thead>
                <tbody>
                  {reminderPagination.paginatedRows.map((row) => (
                    <tr key={`${row.kind}:${row.id}`}>
                      <td>{row.type_label}</td>
                      <td>{row.customer_label}</td>
                      <td className="mono">{row.vehicle_label}</td>
                      <td className="mono">{row.start_date ? new Date(row.start_date).toLocaleDateString("th-TH") : "-"}</td>
                      <td className="mono">{row.due_date ? new Date(row.due_date).toLocaleDateString("th-TH") : "-"}</td>
                      <td className="mono">{row.due_mileage?.toLocaleString("th-TH") ?? "-"}</td>
                      <td><span className={`badge ${row.active ? "paid" : "pending"}`}>{row.active ? "ใช้งาน" : "ไม่ใช้งาน"}</span></td>
                      <td style={{ display: "flex", gap: 6 }}>
                        {Boolean(getLineSendTarget(row.line_user_id, row.line_msg_user_id)) && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                            disabled={saving || !row.customer_id || !row.site_id}
                            onClick={() => void sendReminderRowToLine(row)}
                          >
                            ส่ง LINE
                          </button>
                        )}
                        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openEditReminder(row)}>แก้ไข</button>
                        <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12, color: "var(--red)" }} onClick={() => void deleteReminder(row)}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                  {!reminderRows.length && !loading && <tr><td colSpan={8} style={{ color: "var(--text3)", padding: 12 }}>ยังไม่มีรายการแจ้งเตือน</td></tr>}
                </tbody>
              </table>
            </div>
            <TablePaginationControls
              page={reminderPagination.page}
              totalPages={reminderPagination.totalPages}
              pageSize={reminderPagination.pageSize}
              totalItems={reminderPagination.totalItems}
              onPageChange={reminderPagination.setPage}
              onPageSizeChange={reminderPagination.setPageSize}
            />
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-head">
              <span className="card-title">รายการรอแจ้งเตือนผ่าน LINE</span>
              <button className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => void loadData()} disabled={loading || saving}>
                รีเฟรช
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>หัวข้อ</th>
                    <th>ลูกค้า</th>
                    <th>รถ</th>
                    <th>ครบกำหนด</th>
                    <th>เหลือ</th>
                    <th>สถานะ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingNotifications.map((row) => (
                    <tr key={`${row.source_type}:${row.source_id}:${row.remind_days}`}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text3)", whiteSpace: "pre-wrap" }}>{row.message}</div>
                      </td>
                      <td>{row.customer_label}</td>
                      <td className="mono">{row.vehicle_label}</td>
                      <td className="mono">{row.due_date ? new Date(row.due_date).toLocaleDateString("th-TH") : "-"}</td>
                      <td className="mono">{row.days_left ?? "-"} วัน</td>
                      <td>
                        <span className={`badge ${row.status === "sent" ? "paid" : row.status === "failed" ? "cancel" : "pending"}`}>
                          {row.status === "sent" ? "ส่งแล้ว" : row.status === "failed" ? "ส่งไม่สำเร็จ" : "รอแจ้ง"}
                        </span>
                      </td>
                      <td>
                        {Boolean(getLineSendTarget(row.line_user_id, row.line_msg_user_id)) && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                            disabled={saving}
                            onClick={() => void sendPendingNotificationToLine(row)}
                          >
                            ส่ง LINE
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!pendingNotifications.length && !loading && (
                    <tr>
                      <td colSpan={7} style={{ color: "var(--text3)", padding: 12 }}>ยังไม่มีรายการที่ถึงช่วงแจ้งเตือน</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {reminderDialogOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 760 }}>
            <div className="modal-head">
              <div className="modal-title">{reminderFormType === "renewal" ? (renewalForm.id ? "แก้ไขประกัน/พ.ร.บ./ภาษี" : "เพิ่มประกัน/พ.ร.บ./ภาษี") : (serviceForm.id ? "แก้ไขรายการบริการ" : "เพิ่มรายการบริการ")}</div>
              <button className="btn btn-ghost" onClick={() => setReminderDialogOpen(false)}>ปิด</button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 12, borderColor: reminderFormType === "renewal" ? "var(--accent)" : "var(--border)", color: reminderFormType === "renewal" ? "var(--accent)" : "var(--text2)" }} onClick={() => setReminderFormType("renewal")}>ประกัน/พ.ร.บ./ภาษี</button>
                <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 12, borderColor: reminderFormType === "service" ? "var(--accent)" : "var(--border)", color: reminderFormType === "service" ? "var(--accent)" : "var(--text2)" }} onClick={() => setReminderFormType("service")}>บริการรถ</button>
              </div>
              {reminderFormType === "renewal" ? (
                <div className="modal-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <label>
                    ลูกค้า
                    <select
                      className="search-bar"
                      style={{ width: "100%" }}
                      value={renewalForm.customer_id}
                      onChange={(event) => {
                        const customerId = event.target.value;
                        const firstVehicle = siteVehicles.find((item) => item.customer_id === customerId);
                        setRenewalForm((prev) => ({
                          ...prev,
                          customer_id: customerId,
                          vehicle_id: firstVehicle?.id ?? "",
                          plate_no: firstVehicle?.plate_no ?? prev.plate_no,
                          car_model: firstVehicle?.model ?? prev.car_model
                        }));
                      }}
                    >
                      <option value="">เลือกลูกค้า</option>
                      {customers.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.full_name || row.display_name || row.phone || row.email || row.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    ทะเบียนรถ
                    <input
                      className="search-bar"
                      style={{ width: "100%" }}
                      value={renewalForm.plate_no}
                      onChange={(event) => setRenewalForm((prev) => ({ ...prev, plate_no: event.target.value }))}
                      placeholder="เช่น กข1234"
                    />
                  </label>
                  <label>
                    รุ่นรถ
                    <input
                      className="search-bar"
                      style={{ width: "100%" }}
                      value={renewalForm.car_model}
                      onChange={(event) => setRenewalForm((prev) => ({ ...prev, car_model: event.target.value }))}
                      placeholder="เช่น NISSAN Almera"
                    />
                  </label>
                  <label>
                    แจ้งล่วงหน้า (วัน)
                    <input
                      className="search-bar"
                      style={{ width: "100%" }}
                      type="number"
                      value={renewalForm.remind_before_days}
                      onChange={(event) => setRenewalForm((prev) => ({ ...prev, remind_before_days: event.target.value }))}
                    />
                  </label>
                  <label>
                    ประกันภัย
                    <select
                      className="search-bar"
                      style={{ width: "100%" }}
                      value={renewalForm.insurance_class}
                      onChange={(event) => setRenewalForm((prev) => ({ ...prev, insurance_class: event.target.value }))}
                    >
                      <option value="">เลือกประเภท</option>
                      {INSURANCE_CLASS_OPTIONS.map((item) => (
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
                      value={renewalForm.insurance_expiry_date}
                      onChange={(event) => setRenewalForm((prev) => ({ ...prev, insurance_expiry_date: event.target.value }))}
                    />
                  </label>
                  <label>
                    วันหมดอายุ พ.ร.บ.
                    <input
                      className="search-bar"
                      style={{ width: "100%" }}
                      type="date"
                      value={renewalForm.act_expiry_date}
                      onChange={(event) => setRenewalForm((prev) => ({ ...prev, act_expiry_date: event.target.value }))}
                    />
                  </label>
                  <label>
                    วันหมดอายุภาษี
                    <input
                      className="search-bar"
                      style={{ width: "100%" }}
                      type="date"
                      value={renewalForm.tax_expiry_date}
                      onChange={(event) => setRenewalForm((prev) => ({ ...prev, tax_expiry_date: event.target.value }))}
                    />
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 20 }}>
                    <input type="checkbox" checked={renewalForm.active} onChange={(event) => setRenewalForm((prev) => ({ ...prev, active: event.target.checked }))} style={{ width: 16 }} />
                    เปิดใช้งานรายการนี้
                  </label>
                </div>
              ) : (
                <div className="modal-grid cnp-form">
                  <label className="cnp-field">รถ
                    <select value={serviceForm.vehicle_id} onChange={(event) => setServiceForm((prev) => ({ ...prev, vehicle_id: event.target.value }))}>
                      <option value="">เลือกรถ</option>
                      {siteVehicles.map((row) => <option key={row.id} value={row.id}>{row.plate_no}</option>)}
                    </select>
                  </label>
                  <label className="cnp-field">ประเภท
                    <select value={serviceForm.service_type} onChange={(event) => setServiceForm((prev) => ({ ...prev, service_type: event.target.value as ServiceRow["service_type"] }))}>
                      {SERVICE_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="cnp-field"><span className="auth-label">วันที่ทำบริการล่าสุด</span><AppDatePicker value={serviceForm.service_date} onChange={(value) => setServiceForm((prev) => ({ ...prev, service_date: value }))} /></label>
                  <label className="cnp-field"><span className="auth-label">เลขไมล์ตอนทำบริการ</span><input type="number" value={serviceForm.mileage_at_service} onChange={(event) => setServiceForm((prev) => ({ ...prev, mileage_at_service: event.target.value }))} /></label>
                  <label className="cnp-field"><span className="auth-label">วันครบกำหนดถัดไป</span><AppDatePicker value={serviceForm.next_due_date} onChange={(value) => setServiceForm((prev) => ({ ...prev, next_due_date: value }))} /></label>
                  <label className="cnp-field"><span className="auth-label">ไมล์ครบกำหนดถัดไป</span><input type="number" value={serviceForm.next_due_mileage} onChange={(event) => setServiceForm((prev) => ({ ...prev, next_due_mileage: event.target.value }))} /></label>
                  <label className="cnp-field"><span className="auth-label">แจ้งล่วงหน้า (วัน)</span><input type="number" value={serviceForm.remind_before_days} onChange={(event) => setServiceForm((prev) => ({ ...prev, remind_before_days: event.target.value }))} /></label>
                  <label className="cnp-field cnp-field-full"><span className="auth-label">หมายเหตุ</span><input value={serviceForm.note} onChange={(event) => setServiceForm((prev) => ({ ...prev, note: event.target.value }))} /></label>
                  <label className="cnp-check">
                    <input type="checkbox" checked={serviceForm.active} onChange={(event) => setServiceForm((prev) => ({ ...prev, active: event.target.checked }))} style={{ width: 16 }} />
                    เปิดใช้งานรายการนี้
                  </label>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setReminderDialogOpen(false)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={() => void (reminderFormType === "renewal" ? saveRenewal() : saveService())} disabled={saving || loading}>
                {reminderFormType === "renewal" ? "บันทึกประกัน/พ.ร.บ./ภาษี" : (serviceForm.id ? "อัปเดตรายการ" : "เพิ่มรายการ")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .cnp-page .card {
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
        }

        .cnp-form > .cnp-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
          color: var(--text2);
          font-weight: 500;
        }

        .cnp-form :is(input, select) {
          width: 100%;
          height: 38px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: linear-gradient(180deg, var(--bg2), var(--bg3));
          color: var(--text);
          padding: 0 12px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .cnp-form :is(input, select):focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-dim2);
        }

        .cnp-form :is(input, select):disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .cnp-field-full {
          grid-column: 1 / -1;
        }

        .cnp-check {
          display: flex;
          gap: 10px;
          align-items: center;
          min-height: 38px;
          margin-top: 22px;
          color: var(--text2);
          font-size: 12px;
          font-weight: 500;
        }

        .cnp-check input {
          width: 16px;
          height: 16px;
          accent-color: var(--accent);
        }

        .cnp-actions {
          margin-top: 12px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

      `}</style>
    </div>
  );
}
