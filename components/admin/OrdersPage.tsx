"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabaseClient";
import AppDatePicker from "../ui/AppDatePicker";
import ActionFeedback from "../ui/ActionFeedback";

type OrdersPageProps = {
  activeFilter?: string;
  onFilterChange?: (label: string) => void;
  onConfirmOrder?: (id: string) => void;
  confirmedOrders?: Set<string>;
};

type SiteRow = {
  id: string;
  code: string | null;
  name: string | null;
};

type CustomerRow = {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  group_id?: string | null;
};

type CustomerGroupRow = {
  id: string;
  name: string | null;
};

type OrderRow = {
  id: string;
  order_no: string;
  status: "pending" | "processing" | "shipping" | "completed" | "cancelled";
  payment_status: "unpaid" | "pending" | "paid" | "failed" | "refunded";
  payment_option?: "full" | "deposit" | null;
  subtotal?: number;
  discount?: number;
  shipping_fee?: number;
  deposit_amount?: number;
  pay_now_amount?: number;
  total_amount: number;
  created_at: string;
  site_id: string | null;
  customer_id: string | null;
  sites?: SiteRow | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  customer_group_name?: string | null;
  items: string;
  itemCount: number;
  source: "order" | "cart";
  cart_id?: string | null;
  slip_url?: string | null;
  datetrans?: string | null;
  timetrans?: string | null;
};

type OrderDetailLine = {
  id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sku_code: string | null;
  size_label: string | null;
  brand: string | null;
  name: string | null;
};

type OrderItemRow = {
  order_id: string;
  quantity: number;
  skus?: {
    sku_code: string | null;
    size_label: string | null;
    products?: { brand: string | null; name: string | null } | null;
  } | null;
};

type CartRow = {
  id: string;
  status?: string | null;
  scheduled_at?: string | null;
  service_fee?: number | null;
  shipping_fee?: number | null;
  created_at?: string | null;
  customer_id?: string | null;
  slip_url?: string | null;
  payment_option?: "full" | "deposit" | null;
  datetrans?: string | null;
  timetrans?: string | null;
};

type CartItemRow = {
  cart_id: string;
  quantity: number;
  sku_id?: string | null;
  skus?:
  | {
    sku_code: string | null;
    size_label: string | null;
    products?: { brand: string | null; name: string | null } | null;
    prices?: { price: number | null; group_id: string | null }[] | null;
  }
  | {
    sku_code: string | null;
    size_label: string | null;
    products?: { brand: string | null; name: string | null }[] | null;
    prices?: { price: number | null; group_id: string | null }[] | null;
  }[]
  | null;
};

type PaymentRow = {
  order_id: string;
  slip_url: string | null;
  created_at: string;
};

type SlipFetchResult = {
  urls: string[];
  debug: string;
};

type SkuOption = {
  id: string;
  sku_code: string | null;
  size_label: string | null;
  products?: { brand: string | null; name: string | null } | null;
  prices?: { price: number | null; group_id: string | null }[] | null;
};

type WorkSlotRow = {
  start_time: string;
  end_time: string;
  sort_order: number;
};

type CreateOrderItemDraft = {
  id: string;
  sku_id: string;
  quantity: string;
  unit_price: string;
};

type EditOrderItemDraft = {
  id: string;
  sku_id: string;
  quantity: string;
  unit_price: string;
};

const STATUS_LABEL: Record<OrderRow["status"], string> = {
  pending: "รอยืนยัน",
  processing: "กำลังดำเนินการ",
  shipping: "กำลังจัดส่ง",
  completed: "สำเร็จ",
  cancelled: "ยกเลิก"
};

const STATUS_CLASS: Record<OrderRow["status"], string> = {
  pending: "badge pending",
  processing: "badge process",
  shipping: "badge process",
  completed: "badge paid",
  cancelled: "badge cancel"
};

const PAYMENT_LABEL: Record<OrderRow["payment_status"], string> = {
  unpaid: "ยังไม่ชำระ",
  pending: "รอตรวจสอบ",
  paid: "ชำระแล้ว",
  failed: "ชำระไม่สำเร็จ",
  refunded: "คืนเงินแล้ว"
};

const PAYMENT_OPTION_LABEL: Record<"full" | "deposit", string> = {
  full: "ชำระเต็มจำนวน",
  deposit: "ชำระมัดจำ"
};

const TECH_LINE_GROUP_ID = "Cb0a83edbd2217e4b176992878f4efdd0";

function buildGoogleMapRoute(address: string | null | undefined) {
  if (!address) return null;
  const normalizedAddress = address.trim();
  if (!normalizedAddress) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(normalizedAddress)}&travelmode=driving`;
}

const MAX_INSTALL_JOBS_PER_DAY = 4;
const MAX_INSTALL_MINUTES_PER_DAY = 8 * 60;
const DEFAULT_INSTALL_DURATION_MINUTES = 120;
const INSTALL_TIME_SLOTS = [
  { label: "09:00-11:00", startHour: 9, startMinute: 0 },
  { label: "13:00-15:00", startHour: 13, startMinute: 0 },
  { label: "15:00-17:00", startHour: 15, startMinute: 0 }
] as const;
const PAGE_SIZE_OPTIONS = [10, 20, 25] as const;
const DEFAULT_PAGE_SIZE = 10;

export default function OrdersPage({
  activeFilter,
  onFilterChange,
  onConfirmOrder,
  confirmedOrders
}: OrdersPageProps) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroupRow[]>([]);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<{ orderNo: string; urls: string[] } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusOrder, setBonusOrder] = useState<OrderRow | null>(null);
  const [bonusSkuId, setBonusSkuId] = useState("");
  const [bonusQty, setBonusQty] = useState("1");
  const [bonusReason, setBonusReason] = useState("");
  const [bonusSaving, setBonusSaving] = useState(false);
  const [skuOptions, setSkuOptions] = useState<SkuOption[]>([]);
  const [skuLoading, setSkuLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionMenuOrderId, setActionMenuOrderId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<CustomerRow | null>(null);
  const [detailLines, setDetailLines] = useState<OrderDetailLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [localFilter, setLocalFilter] = useState("ทั้งหมด");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [appointmentDrafts, setAppointmentDrafts] = useState<Record<string, { date: string; time: string }>>({});
  const [savingAppointmentId, setSavingAppointmentId] = useState<string | null>(null);
  const [timeSlotOptions, setTimeSlotOptions] = useState<string[]>([]);
  const [formStatus, setFormStatus] = useState<OrderRow["status"]>("pending");
  const [formPayment, setFormPayment] = useState<OrderRow["payment_status"]>("unpaid");
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editSiteId, setEditSiteId] = useState("");
  const [editShippingFee, setEditShippingFee] = useState("0");
  const [editDiscount, setEditDiscount] = useState("0");
  const [editPaidAmountInput, setEditPaidAmountInput] = useState("0");
  const [editItems, setEditItems] = useState<EditOrderItemDraft[]>([]);
  const [createForm, setCreateForm] = useState({
    customer_mode: "select" as "select" | "manual",
    customer_id: "",
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    site_id: "",
    shipping_fee: "0",
    discount: "0",
    payment_option: "full" as "full" | "deposit"
  });
  const [createPaidAmountInput, setCreatePaidAmountInput] = useState("0");
  const [createItems, setCreateItems] = useState<CreateOrderItemDraft[]>([
    { id: crypto.randomUUID(), sku_id: "", quantity: "1", unit_price: "0" }
  ]);
  const [createItemSearch, setCreateItemSearch] = useState<Record<string, string>>({});
  const [activeCreateItemSearchId, setActiveCreateItemSearchId] = useState<string | null>(null);

  const hasSupabase = useMemo(() => Boolean(supabase), []);

  const activeFilterLabel = activeFilter ?? localFilter;

  const filterCounts = useMemo(() => {
    return {
      all: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      processing: orders.filter((o) => o.status === "processing" || o.status === "shipping").length,
      paid: orders.filter((o) => o.payment_status === "paid" || o.status === "completed").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length
    };
  }, [orders]);

  const filterLabels = [
    { key: "all", label: `ทั้งหมด (${filterCounts.all})`, match: "ทั้งหมด" },
    { key: "pending", label: `รอยืนยัน (${filterCounts.pending})`, match: "รอยืนยัน" },
    { key: "processing", label: `กำลังดำเนินการ (${filterCounts.processing})`, match: "กำลังดำเนินการ" },
    { key: "paid", label: `ชำระแล้ว (${filterCounts.paid})`, match: "ชำระแล้ว" },
    { key: "cancelled", label: `ยกเลิก (${filterCounts.cancelled})`, match: "ยกเลิก" }
  ];

  const selectedCreateCustomer = useMemo(
    () => customers.find((customer) => customer.id === createForm.customer_id) ?? null,
    [customers, createForm.customer_id]
  );

  const createSubtotal = useMemo(
    () =>
      createItems.reduce((sum, item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unit_price);
        if (!Number.isFinite(quantity) || quantity <= 0) return sum;
        if (!Number.isFinite(unitPrice) || unitPrice < 0) return sum;
        return sum + quantity * unitPrice;
      }, 0),
    [createItems]
  );

  const createShippingFee = Number(createForm.shipping_fee || "0");
  const createDiscount = Number(createForm.discount || "0");
  const createTotal = Math.max(
    0,
    createSubtotal +
    (Number.isFinite(createShippingFee) ? createShippingFee : 0) -
    (Number.isFinite(createDiscount) ? createDiscount : 0)
  );
  const createPaymentTypeLabel = PAYMENT_OPTION_LABEL[createForm.payment_option];
  const createPaidAmount = Math.min(createTotal, Math.max(0, Number(createPaidAmountInput || 0)));
  const createOutstandingAmount = Math.max(0, createTotal - createPaidAmount);

  function getPaidAmount(order: OrderRow) {
    if (order.source === "cart") return 0;
    const payNowAmount = Number(order.pay_now_amount ?? 0);
    const depositAmount = Number(order.deposit_amount ?? 0);
    const totalAmount = Number(order.total_amount ?? 0);
    if (order.payment_option === "deposit") {
      return Math.max(0, payNowAmount > 0 ? payNowAmount : depositAmount);
    }
    if (payNowAmount > 0) return Math.max(0, payNowAmount);
    if (order.payment_status === "paid") return Math.max(0, totalAmount);
    return 0;
  }

  function getOutstandingAmount(order: OrderRow) {
    const totalAmount = Math.max(0, Number(order.total_amount ?? 0));
    const paidAmount = getPaidAmount(order);
    return Math.max(0, totalAmount - paidAmount);
  }

  function formatOrderDatePart(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }

  function normalizeTimeText(value: string | null | undefined) {
    if (!value) return null;
    const text = value.trim();
    if (!text) return null;
    const match = text.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  }

  function toHHMM(value: string | null | undefined) {
    const normalized = normalizeTimeText(value);
    return normalized ? normalized.slice(0, 5) : null;
  }

  function formatSlotLabel(start: string, end: string) {
    const startText = toHHMM(start);
    const endText = toHHMM(end);
    if (!startText || !endText) return "";
    return `${startText}-${endText}`;
  }

  async function loadTimeSlotOptions() {
    if (!supabase) return;
    const { data, error: slotError } = await supabase
      .from("technician_work_slots")
      .select("start_time,end_time,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("start_time", { ascending: true });
    if (slotError) {
      setError(slotError.message);
      return;
    }
    const labels = Array.from(
      new Set(
        ((data ?? []) as WorkSlotRow[])
          .map((row) => formatSlotLabel(row.start_time, row.end_time))
          .filter(Boolean)
      )
    );
    setTimeSlotOptions(labels);
  }

  function buildScheduledAtFromTrans(
    dateText: string | null | undefined,
    timeText: string | null | undefined,
    fallbackDate: Date
  ) {
    const datePart = dateText?.trim()
      ? dateText.trim()
      : `${fallbackDate.getFullYear()}-${String(fallbackDate.getMonth() + 1).padStart(2, "0")}-${String(
        fallbackDate.getDate()
      ).padStart(2, "0")}`;
    const timePart = normalizeTimeText(timeText) ?? "09:00:00";
    const parsed = new Date(`${datePart}T${timePart}`);
    if (Number.isNaN(parsed.getTime())) return fallbackDate;
    return parsed;
  }

  async function generateOrderNo(date = new Date()) {
    if (!supabase) throw new Error("ยังไม่ได้ตั้งค่า Supabase env");
    const prefix = `JIB-${formatOrderDatePart(date)}`;
    const { data, error: orderNoError } = await supabase
      .from("orders")
      .select("order_no")
      .ilike("order_no", `${prefix}%`)
      .order("order_no", { ascending: false })
      .limit(200);
    if (orderNoError) {
      throw new Error(orderNoError.message);
    }
    const maxRunning = (data ?? []).reduce((max, row) => {
      const value = typeof row.order_no === "string" ? row.order_no : "";
      const match = value.match(/(\d{4})$/);
      if (!match) return max;
      const parsed = Number(match[1]);
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, 0);
    const nextRunning = String(maxRunning + 1).padStart(4, "0");
    return `${prefix}${nextRunning}`;
  }

  async function getCartSlipUrlsFromStorage(cartId: string): Promise<SlipFetchResult> {
    if (!supabase || !cartId) return { urls: [], debug: "supabase/cartId missing" };
    const candidates = [
      { bucket: "slips", folder: cartId }, // Files > Buckets > slips/<cart_id>
      { bucket: "slips", folder: `slips/${cartId}` } // fallback if nested
    ];
    const debugLogs: string[] = [];

    for (const candidate of candidates) {
      const storage = supabase.storage.from(candidate.bucket);
      const { data: listData, error: listError } = await storage.list(candidate.folder, {
        limit: 100,
        sortBy: { column: "name", order: "asc" }
      });
      if (listError) {
        debugLogs.push(`${candidate.bucket}/${candidate.folder}: list error: ${listError.message}`);
        continue;
      }
      if (!listData || listData.length === 0) {
        debugLogs.push(`${candidate.bucket}/${candidate.folder}: empty`);
        continue;
      }

      const objectPaths = listData
        .filter((file) => Boolean(file?.name))
        .map((file) => `${candidate.folder}/${file.name}`);

      const { data: signedData, error: signedError } = await storage.createSignedUrls(
        objectPaths,
        60 * 60
      );
      if (!signedError && signedData && signedData.length > 0) {
        const signedUrls = signedData
          .map((item) => item.signedUrl)
          .filter((url): url is string => Boolean(url));
        if (signedUrls.length > 0) {
          return { urls: signedUrls, debug: `${candidate.bucket}/${candidate.folder}: signed` };
        }
      } else if (signedError) {
        debugLogs.push(`${candidate.bucket}/${candidate.folder}: signed error: ${signedError.message}`);
      }

      const publicUrls = objectPaths
        .map((path) => storage.getPublicUrl(path).data.publicUrl)
        .filter((url): url is string => Boolean(url));
      if (publicUrls.length > 0) {
        return { urls: publicUrls, debug: `${candidate.bucket}/${candidate.folder}: public` };
      }
    }

    return { urls: [], debug: debugLogs.join(" | ") };
  }

  async function resolveSlipUrl(raw: string | null | undefined): Promise<string | null> {
    if (!supabase || !raw) return null;
    const value = raw.trim();
    if (!value) return null;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;

    const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (value.startsWith("/storage/") && supabaseBase) {
      return `${supabaseBase}${value}`;
    }

    const normalizedPath = value.startsWith("slips/") ? value.slice("slips/".length) : value;

    const { data: signedData, error: signedError } = await supabase
      .storage
      .from("slips")
      .createSignedUrl(normalizedPath, 60 * 60);
    if (!signedError && signedData?.signedUrl) {
      return signedData.signedUrl;
    }

    return supabase.storage.from("slips").getPublicUrl(normalizedPath).data.publicUrl ?? null;
  }

  async function loadMeta() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return { sites: [], customers: [], customerGroups: [] };
    }
    const [siteRes, customerRes, groupRes] = await Promise.all([
      supabase.from("sites").select("id,code,name").order("name"),
      supabase
        .from("customes")
        .select("id,display_name,full_name,email,phone,address,group_id")
        .order("created_at", { ascending: false }),
      supabase.from("customer_groups").select("id,name")
    ]);
    const nextSites = (!siteRes.error && siteRes.data ? siteRes.data : []) as SiteRow[];
    const nextCustomers = (!customerRes.error && customerRes.data ? customerRes.data : []) as CustomerRow[];
    const nextGroups = (!groupRes.error && groupRes.data ? groupRes.data : []) as CustomerGroupRow[];
    setSites(nextSites);
    setCustomers(nextCustomers);
    setCustomerGroups(nextGroups);
    return { sites: nextSites, customers: nextCustomers, customerGroups: nextGroups };
  }

  async function loadOrders(meta?: {
    sites: SiteRow[];
    customers: CustomerRow[];
    customerGroups: CustomerGroupRow[];
  }) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setLoading(true);
    setError(null);
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        "id,order_no,status,payment_status,payment_option,subtotal,discount,shipping_fee,total_amount,deposit_amount,pay_now_amount,created_at,site_id,customer_id,customer_name,customer_phone,customer_address,cart_id,slip_url,datetrans,timetrans,sites(id,code,name)"
      )
      .order("created_at", { ascending: false });
    if (orderError) {
      setError(orderError.message);
      setLoading(false);
      return;
    }

    const orderIds = (orderData ?? []).map((row) => row.id);
    let itemRows: OrderItemRow[] = [];
    let paymentRows: PaymentRow[] = [];
    if (orderIds.length) {
      const [{ data: itemData, error: itemError }, { data: paymentData, error: paymentError }] =
        await Promise.all([
          supabase
            .from("order_items")
            .select("order_id,quantity,skus(sku_code,size_label,products(brand,name))")
            .in("order_id", orderIds),
          supabase
            .from("payments")
            .select("order_id,slip_url,created_at")
            .in("order_id", orderIds)
            .order("created_at", { ascending: false })
        ]);
      if (itemError) {
        setError(itemError.message);
      } else {
        itemRows = (itemData ?? []) as unknown as OrderItemRow[];
      }
      if (paymentError) {
        setError(paymentError.message);
      } else {
        paymentRows = (paymentData ?? []) as PaymentRow[];
      }
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
      const newLabel = existing.label || label || item.skus?.sku_code || "";
      itemMap.set(item.order_id, {
        count: existing.count + (item.quantity ?? 0),
        label: newLabel
      });
    });

    const customerList = meta?.customers ?? customers;
    const groupList = meta?.customerGroups ?? customerGroups;
    const slipByOrder = new Map<string, string | null>();
    paymentRows.forEach((payment) => {
      if (
        !slipByOrder.has(payment.order_id) ||
        (!slipByOrder.get(payment.order_id) && payment.slip_url)
      ) {
        slipByOrder.set(payment.order_id, payment.slip_url);
      }
    });

    const mapped = (orderData ?? []).map((row) => {
      const itemInfo = itemMap.get(row.id);
      const customer = customerList.find((item) => item.id === row.customer_id) ?? null;
      const groupName = customer?.group_id
        ? groupList.find((group) => group.id === customer.group_id)?.name ?? null
        : null;
      return {
        id: row.id,
        order_no: row.order_no,
        status: row.status,
        payment_status: row.payment_status,
        payment_option: (row as { payment_option?: "full" | "deposit" | null }).payment_option ?? null,
        subtotal: Number((row as { subtotal?: number | null }).subtotal ?? 0),
        discount: Number((row as { discount?: number | null }).discount ?? 0),
        shipping_fee: Number((row as { shipping_fee?: number | null }).shipping_fee ?? 0),
        total_amount: Number(row.total_amount ?? 0),
        deposit_amount: Number((row as { deposit_amount?: number | null }).deposit_amount ?? 0),
        pay_now_amount: Number((row as { pay_now_amount?: number | null }).pay_now_amount ?? 0),
        created_at: row.created_at,
        site_id: row.site_id,
        customer_id: row.customer_id,
        cart_id: (row as { cart_id?: string | null }).cart_id ?? null,
        sites: row.sites ?? null,
        customer_name:
          (row as { customer_name?: string | null }).customer_name ??
          customer?.display_name ??
          customer?.full_name ??
          customer?.email ??
          null,
        customer_phone:
          (row as { customer_phone?: string | null }).customer_phone ?? customer?.phone ?? null,
        customer_address:
          (row as { customer_address?: string | null }).customer_address ?? customer?.address ?? null,
        customer_group_name: groupName,
        items: itemInfo?.label || "-",
        itemCount: itemInfo?.count ?? 0,
        slip_url:
          (row as { slip_url?: string | null }).slip_url ??
          slipByOrder.get(row.id) ??
          null,
        datetrans: (row as { datetrans?: string | null }).datetrans ?? null,
        timetrans: (row as { timetrans?: string | null }).timetrans ?? null,
        source: "order"
      } as unknown as OrderRow;
    });

    const combined = [...mapped].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );

    setOrders(combined);
    setLoading(false);
  }

  useEffect(() => {
    void (async () => {
      const meta = await loadMeta();
      await loadTimeSlotOptions();


      await loadOrders(meta);
    })();
  }, []);

  useEffect(() => {
    setAppointmentDrafts((prev) => {
      const next = { ...prev };
      orders.forEach((order) => {
        if (!next[order.id]) {
          next[order.id] = { date: order.datetrans ?? "", time: order.timetrans ?? "" };
        }
      });
      return next;
    });
  }, [orders]);

  useEffect(() => {
    if (!createOpen) return;
    if (createForm.site_id) return;
    const defaultSiteId = sites[0]?.id ?? "";
    if (!defaultSiteId) return;
    setCreateForm((prev) => ({ ...prev, site_id: defaultSiteId }));
  }, [createOpen, createForm.site_id, sites]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const filterOk =
        activeFilterLabel.includes("ทั้งหมด") ||
        (activeFilterLabel.includes("รอยืนยัน") && order.status === "pending") ||
        (activeFilterLabel.includes("กำลังดำเนินการ") &&
          (order.status === "processing" || order.status === "shipping")) ||
        (activeFilterLabel.includes("ชำระแล้ว") &&
          (order.payment_status === "paid" || order.status === "completed")) ||
        (activeFilterLabel.includes("ยกเลิก") && order.status === "cancelled");

      const searchOk =
        search.trim().length === 0 ||
        [order.order_no, order.customer_name, order.items]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
      const orderDate = new Date(order.created_at);
      const startOk = !startDate || orderDate >= new Date(`${startDate}T00:00:00`);
      const endOk = !endDate || orderDate <= new Date(`${endDate}T23:59:59.999`);
      return filterOk && searchOk && startOk && endOk;
    });
  }, [orders, activeFilterLabel, search, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilterLabel, search, startDate, endDate]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);


  function setFilter(label: string) {
    setLocalFilter(label);
    onFilterChange?.(label);
  }

  async function sendAppointmentFlexMessage(
    order: OrderRow,
    nextDate: string | null,
    nextTime: string | null
  ) {
    if (!supabase || !order.customer_id || !nextDate || !normalizeTimeText(nextTime)) {
      return { sent: false, reason: "missing-data" as const };
    }

    const { data: customer, error: customerError } = await supabase
      .from("customes")
      .select("line_msg_user_id,line_user_id,display_name,full_name")
      .eq("id", order.customer_id)
      .maybeSingle();

    if (customerError) throw new Error(customerError.message);

    const to = ((customer as { line_msg_user_id?: string | null })?.line_msg_user_id ?? "").trim()
      || ((customer as { line_user_id?: string | null })?.line_user_id ?? "").trim();
    if (!to || to.startsWith("nolineid-")) {
      return { sent: false, reason: "missing-line-id" as const };
    }

    const customerName =
      ((customer as { display_name?: string | null })?.display_name ??
        (customer as { full_name?: string | null })?.full_name ??
        order.customer_name ??
        "ลูกค้า") as string;
    const scheduledText = `${nextDate} ${normalizeTimeText(nextTime)}`;
    const addressText = order.customer_address?.trim() || "-";
    const altText = `ยืนยันนัดหมายออร์เดอร์ ${order.order_no} วันที่ ${scheduledText}`;

    const outstandingAmount = Math.max(0, Number(getOutstandingAmount(order) ?? 0));
    const outstandingText = `฿${outstandingAmount.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;

    const response = await fetch("/api/line/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        type: "user",
        messages: [
          {
            type: "flex",
            altText,
            contents: {
              type: "bubble",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#1db3e5",
                paddingAll: "12px",
                contents: [
                  {
                    type: "text",
                    text: "ยืนยันนัดหมายติดตั้ง",
                    weight: "bold",
                    color: "#FFFFFF",
                    size: "md"
                  }
                ]
              },
              body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                  {
                    type: "text",
                    text: customerName,
                    weight: "bold",
                    size: "lg"
                  },
                  {
                    type: "separator",
                    margin: "sm"
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    spacing: "sm",
                    contents: [
                      { type: "text", text: `เลขที่สั่งซื้อ: ${order.order_no}`, size: "sm", wrap: true },
                      { type: "text", text: `วัน-เวลา: ${scheduledText}`, size: "sm", wrap: true },
                      { type: "text", text: `ที่อยู่: ${addressText}`, size: "sm", wrap: true }
                    ]
                  }
                ]
              },
              footer: {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: "หากต้องการเปลี่ยนเวลานัด กรุณาตอบกลับแชทนี้",
                    size: "xs",
                    color: "#6B7280",
                    wrap: true
                  }
                ]
              }
            }
          }
        ]
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "ส่ง Flex message ไม่สำเร็จ");
    }
    return { sent: true, reason: null as null };
  }

  async function sendPaymentConfirmedFlexMessage(order: OrderRow) {
    if (!supabase || !order.customer_id) {
      return { sent: false, reason: "missing-data" as const };
    }

    const { data: customer, error: customerError } = await supabase
      .from("customes")
      .select("line_msg_user_id,line_user_id,display_name,full_name")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (customerError) throw new Error(customerError.message);

    const to = ((customer as { line_msg_user_id?: string | null })?.line_msg_user_id ?? "").trim()
      || ((customer as { line_user_id?: string | null })?.line_user_id ?? "").trim();
    if (!to || to.startsWith("nolineid-")) {
      return { sent: false, reason: "missing-line-id" as const };
    }

    const customerName =
      ((customer as { display_name?: string | null })?.display_name ??
        (customer as { full_name?: string | null })?.full_name ??
        order.customer_name ??
        "ลูกค้า") as string;

    const paymentType =
      order.payment_option && PAYMENT_OPTION_LABEL[order.payment_option]
        ? PAYMENT_OPTION_LABEL[order.payment_option]
        : "ชำระเงิน";
    const paidAmount =
      order.payment_option === "deposit"
        ? Number(order.pay_now_amount ?? order.deposit_amount ?? 0)
        : Number(order.total_amount ?? 0);
    const paidAmountText = `฿${paidAmount.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
    const altText = `ยืนยันการชำระเงินออร์เดอร์ ${order.order_no} (${paymentType} ${paidAmountText})`;
    const outstandingAmount = Math.max(0, Number(getOutstandingAmount(order) ?? 0));
    const outstandingText = `฿${outstandingAmount.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;


    const response = await fetch("/api/line/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        type: "user",
        messages: [
          {
            type: "flex",
            altText,
            contents: {
              type: "bubble",
              header: {
                type: "box",
                layout: "vertical",
                backgroundColor: "#3fc55a",
                paddingAll: "12px",
                contents: [
                  { type: "text", text: "ยืนยันการชำระเงินแล้ว", weight: "bold", color: "#FFFFFF", size: "md" }
                ]
              },
              body: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  { type: "text", text: customerName, weight: "bold", size: "lg" },
                  { type: "separator", margin: "sm" },
                  { type: "text", text: `เลขที่สั่งซื้อ: ${order.order_no}`, size: "sm", wrap: true },
                  { type: "text", text: `ประเภทชำระ: ${paymentType}`, size: "sm", wrap: true },
                  { type: "text", text: `ยอดที่ชำระ: ${paidAmountText}`, size: "sm", wrap: true },
                  ...(outstandingAmount > 0
                    ? [{ type: "text", text: `ยอดที่ค้างชำระ: ${outstandingText}`, size: "sm", wrap: true }]
                    : [])
                ]
              }
            }
          }
        ]
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "ส่ง Flex ยืนยันชำระเงินไม่สำเร็จ");
    }
    return { sent: true, reason: null as null };
  }

  async function sendTechGroupFlexMessage(
    order: OrderRow,
    nextDate: string | null,
    nextTime: string | null
  ) {
    if (!nextDate || !supabase) return;

    // ดึงข้อมูลช่างที่ได้รับมอบหมาย
    let technicianName: string | null = null;
    if (order.source === "order") {
      const { data: appointData } = await supabase
        .from("install_appointments")
        .select("technicians(id,full_name)")
        .eq("order_id", order.id)
        .neq("status", "cancelled")
        .limit(1)
        .maybeSingle();
      if (appointData) {
        const tech = Array.isArray((appointData as { technicians?: unknown }).technicians)
          ? (appointData as { technicians: { full_name?: string | null }[] }).technicians[0]
          : (appointData as { technicians?: { full_name?: string | null } | null }).technicians;
        technicianName = (tech as { full_name?: string | null } | null)?.full_name ?? null;
      }
    }

    // ดึงรายการสินค้า
    const itemLines: string[] = [];
    if (order.source === "order") {
      const { data: itemData } = await supabase
        .from("order_items")
        .select("quantity,skus(sku_code,size_label,products(brand,name))")
        .eq("order_id", order.id);
      (itemData ?? []).forEach((item) => {
        const sku = Array.isArray((item as { skus?: unknown }).skus)
          ? (item as { skus: { sku_code?: string | null; size_label?: string | null; products?: unknown }[] }).skus[0]
          : (item as { skus?: { sku_code?: string | null; size_label?: string | null; products?: unknown } | null }).skus;
        const product = Array.isArray(sku?.products)
          ? (sku.products as { brand?: string | null; name?: string | null }[])[0]
          : (sku?.products as { brand?: string | null; name?: string | null } | null | undefined);
        const parts: string[] = [];
        if (product?.brand) parts.push(product.brand);
        if (product?.name) parts.push(product.name);
        if (sku?.size_label) parts.push(sku.size_label);
        itemLines.push(`${Number(item.quantity)}x ${parts.join(" ") || sku?.sku_code || "-"}`);
      });
    }

    const scheduledText = `${nextDate}${nextTime ? ` ${nextTime}` : ""}`;
    const customerName = order.customer_name ?? "ไม่ระบุชื่อ";
    const addressText = order.customer_address?.trim() || "-";
    const phoneText = order.customer_phone?.trim() || "-";
    const mapRouteUrl = buildGoogleMapRoute(order.customer_address);
    const altText = `🔧 งานใหม่ ${order.order_no} — ${customerName} ${scheduledText}`;

    // สร้าง body contents แบบ dynamic
    const infoRows: { type: string; text: string; size: string; wrap: boolean; weight?: string; color?: string }[] = [];
    if (technicianName) {
      infoRows.push({ type: "text", text: `ทีมช่าง: ${technicianName}`, size: "sm", wrap: true, weight: "bold" });
    }
    infoRows.push({ type: "text", text: `เลขออร์เดอร์: ${order.order_no}`, size: "sm", wrap: true });
    infoRows.push({ type: "text", text: `วัน-เวลา: ${scheduledText}`, size: "sm", wrap: true, weight: "bold", color: "#dc2626" });
    infoRows.push({ type: "text", text: `ชื่อลูกค้า: ${customerName}`, size: "sm", wrap: true });
    infoRows.push({ type: "text", text: `โทร: ${phoneText}`, size: "sm", wrap: true });
    infoRows.push({ type: "text", text: `ที่อยู่: ${addressText}`, size: "sm", wrap: true });

    const itemContents: object[] = itemLines.length > 0
      ? [
          { type: "separator", margin: "md" },
          { type: "text", text: "รายการสินค้าที่ต้องติดตั้ง:", size: "sm", weight: "bold", margin: "md" },
          ...itemLines.map((line) => ({ type: "text", text: `• ${line}`, size: "sm", wrap: true }))
        ]
      : [];

    try {
      const response = await fetch("/api/line/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: TECH_LINE_GROUP_ID,
          type: "group",
          messages: [
            {
              type: "flex",
              altText,
              contents: {
                type: "bubble",
                header: {
                  type: "box",
                  layout: "vertical",
                  backgroundColor: "#f59e0b",
                  paddingAll: "12px",
                  contents: [
                    { type: "text", text: "🔧 มีงานนัดติดตั้งใหม่", weight: "bold", color: "#FFFFFF", size: "md" }
                  ]
                },
                body: {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",
                  contents: [
                    {
                      type: "box",
                      layout: "vertical",
                      spacing: "sm",
                      contents: infoRows
                    },
                    ...itemContents
                  ]
                },
                footer: {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",
                  contents: [
                    { type: "text", text: "กรุณาเตรียมพร้อมตามวันเวลาที่นัด", size: "xs", color: "#6B7280", wrap: true },
                    ...(mapRouteUrl
                      ? [
                          {
                            type: "button",
                            style: "primary",
                            color: "#2563eb",
                            action: {
                              type: "uri",
                              label: "เปิด Google Maps",
                              uri: mapRouteUrl
                            }
                          }
                        ]
                      : [])
                  ]
                }
              }
            }
          ]
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        console.warn("[sendTechGroupFlexMessage] failed:", payload.error);
      }
    } catch (err) {
      console.warn("[sendTechGroupFlexMessage] error:", err);
    }
  }

  async function saveAppointmentPlan(order: OrderRow) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    const draft = appointmentDrafts[order.id] ?? { date: order.datetrans ?? "", time: order.timetrans ?? "" };
    const nextDate = draft.date.trim() || null;
    const nextTime = draft.time.trim() || null;

    setSavingAppointmentId(order.id);
    setError(null);
    setSuccess(null);
    try {
      if (order.source === "cart" && order.cart_id) {
        const { error: cartUpdateError } = await supabase
          .from("carts")
          .update({ datetrans: nextDate, timetrans: nextTime })
          .eq("id", order.cart_id);
        if (cartUpdateError) throw new Error(cartUpdateError.message);
      } else {
        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({ datetrans: nextDate, timetrans: nextTime })
          .eq("id", order.id);
        if (orderUpdateError) throw new Error(orderUpdateError.message);

        if (nextDate && normalizeTimeText(nextTime)) {
          const scheduledAt = buildScheduledAtFromTrans(nextDate, nextTime, new Date()).toISOString();
          let { data: updatedAppointments, error: appointUpdateError } = await supabase
            .from("install_appointments")
            .update({ scheduled_at: scheduledAt, datetrans: nextDate, timetrans: nextTime })
            .eq("order_id", order.id)
            .select("id");
          if (
            appointUpdateError &&
            (appointUpdateError.message.toLowerCase().includes("datetrans") ||
              appointUpdateError.message.toLowerCase().includes("timetrans"))
          ) {
            const legacyUpdate = await supabase
              .from("install_appointments")
              .update({ scheduled_at: scheduledAt })
              .eq("order_id", order.id)
              .select("id");
            updatedAppointments = legacyUpdate.data as { id: string }[] | null;
            appointUpdateError = legacyUpdate.error;
          }
          if (appointUpdateError) throw new Error(appointUpdateError.message);

          if (!updatedAppointments || updatedAppointments.length === 0) {
            await ensureInstallAppointmentForOrder({
              ...order,
              datetrans: nextDate,
              timetrans: nextTime
            });

            let { error: secondUpdateError } = await supabase
              .from("install_appointments")
              .update({ scheduled_at: scheduledAt, datetrans: nextDate, timetrans: nextTime })
              .eq("order_id", order.id);
            if (
              secondUpdateError &&
              (secondUpdateError.message.toLowerCase().includes("datetrans") ||
                secondUpdateError.message.toLowerCase().includes("timetrans"))
            ) {
              const legacySecondUpdate = await supabase
                .from("install_appointments")
                .update({ scheduled_at: scheduledAt })
                .eq("order_id", order.id);
              secondUpdateError = legacySecondUpdate.error;
            }
            if (secondUpdateError) throw new Error(secondUpdateError.message);
          }
        }
      }
      const [lineResult] = await Promise.all([
        sendAppointmentFlexMessage(order, nextDate, nextTime),
        sendTechGroupFlexMessage(order, nextDate, nextTime)
      ]);
      if (lineResult.sent) {
        setSuccess(`บันทึกวันเวลานัดหมาย ${order.order_no} เรียบร้อย และส่งแจ้งลูกค้า + ทีมช่างทาง LINE แล้ว`);
      } else if (lineResult.reason === "missing-line-id") {
        setSuccess(`บันทึกวันเวลานัดหมาย ${order.order_no} เรียบร้อย — แจ้งทีมช่างแล้ว (ยังไม่ได้ส่งลูกค้า: ไม่พบ LINE ID)`);
      } else {
        setSuccess(`บันทึกวันเวลานัดหมาย ${order.order_no} เรียบร้อย — แจ้งทีมช่างแล้ว`);
      }
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกวันเวลานัดหมายไม่สำเร็จ");
    } finally {
      setSavingAppointmentId(null);
    }
  }

  async function openSlipModal(order: OrderRow) {
    const resolvedOrderSlip = await resolveSlipUrl(order.slip_url);
    const fallbackResult =
      order.source === "cart" && order.cart_id
        ? await getCartSlipUrlsFromStorage(order.cart_id)
        : { urls: [], debug: "" };
    const fallbackCartSlipUrls = fallbackResult.urls;
    const slipUrls = resolvedOrderSlip
      ? [resolvedOrderSlip]
      : fallbackCartSlipUrls.length > 0
        ? fallbackCartSlipUrls
        : [];

    if (slipUrls.length === 0) {
      const cartIdText = order.cart_id ? `cart=${order.cart_id}` : "no cart_id";
      const debugText = fallbackResult.debug ? ` (${fallbackResult.debug})` : "";
      setError(`ไม่พบสลิปของออร์เดอร์ ${order.order_no} [${cartIdText}]${debugText}`);
      return;
    }

    setSelectedSlip({ orderNo: order.order_no, urls: slipUrls });
    setSlipModalOpen(true);
  }

  async function openModal(id: string) {
    const order = orders.find((item) => item.id === id);
    if (order) {
      setFormStatus(order.status);
      setFormPayment(order.payment_status);
      setEditCustomerId(order.customer_id ?? "");
      setEditSiteId(order.site_id ?? "");
      setEditShippingFee(String(Number(order.shipping_fee ?? 0)));
      setEditDiscount(String(Number(order.discount ?? 0)));
      setEditPaidAmountInput(String(getPaidAmount(order)));
      if (supabase && order.source === "order") {
        const { data: lineData, error: lineError } = await supabase
          .from("order_items")
          .select("id,sku_id,quantity,unit_price")
          .eq("order_id", order.id);
        if (lineError) {
          setError(lineError.message);
        } else {
          const mappedItems = (lineData ?? []).map((line) => ({
            id: String(line.id ?? crypto.randomUUID()),
            sku_id: String((line as { sku_id?: string | null }).sku_id ?? ""),
            quantity: String(Number(line.quantity ?? 0)),
            unit_price: String(Number(line.unit_price ?? 0))
          }));
          setEditItems(
            mappedItems.length > 0
              ? mappedItems
              : [{ id: crypto.randomUUID(), sku_id: "", quantity: "1", unit_price: "0" }]
          );
        }
      }
    }
    await loadSkuOptions();
    setSelectedId(id);
    setModalOpen(true);
  }

  async function openDetailModal(order: OrderRow) {
    if (!supabase) return;
    if (order.source !== "order") {
      setError("ดูรายละเอียดได้เฉพาะคำสั่งซื้อที่ยืนยันแล้ว");
      return;
    }

    setDetailOpen(true);
    setDetailLoading(true);
    setDetailOrder(order);
    setDetailLines([]);
    setDetailCustomer(null);
    setError(null);

    try {
      const [{ data: customerData, error: customerError }, { data: lineData, error: lineError }] =
        await Promise.all([
          supabase
            .from("customes")
            .select("id,display_name,full_name,email,phone,address,group_id")
            .eq("id", order.customer_id)
            .maybeSingle(),
          supabase
            .from("order_items")
            .select("id,quantity,unit_price,line_total,skus(sku_code,size_label,products(brand,name))")
            .eq("order_id", order.id)
        ]);

      if (customerError) throw new Error(customerError.message);
      if (lineError) throw new Error(lineError.message);

      const mappedLines = (lineData ?? []).map((line) => {
        const sku = Array.isArray((line as { skus?: unknown }).skus)
          ? (line as { skus?: any[] }).skus?.[0]
          : (line as { skus?: any }).skus;
        const product = Array.isArray(sku?.products) ? sku.products[0] : sku?.products;
        return {
          id: line.id,
          quantity: Number(line.quantity ?? 0),
          unit_price: Number(line.unit_price ?? 0),
          line_total: Number(line.line_total ?? 0),
          sku_code: sku?.sku_code ?? null,
          size_label: sku?.size_label ?? null,
          brand: product?.brand ?? null,
          name: product?.name ?? null
        } as OrderDetailLine;
      });

      setDetailCustomer((customerData as CustomerRow | null) ?? null);
      setDetailLines(mappedLines);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดรายละเอียดคำสั่งซื้อไม่สำเร็จ");
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadSkuOptions() {
    if (!supabase) return;
    if (skuOptions.length > 0) return;
    setSkuLoading(true);
    const { data, error: skuError } = await supabase
      .from("skus")
      .select("id,sku_code,size_label,products(brand,name),prices(price,group_id)")
      .order("sku_code", { ascending: true })
      .limit(2000);
    if (skuError) {
      setError(skuError.message);
    } else {
      setSkuOptions((data ?? []) as unknown as SkuOption[]);
    }
    setSkuLoading(false);
  }

  function addCreateItemRow() {
    const id = crypto.randomUUID();
    setCreateItems((prev) => [...prev, { id, sku_id: "", quantity: "1", unit_price: "0" }]);
  }

  function removeCreateItemRow(id: string) {
    setCreateItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
    setCreateItemSearch((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeCreateItemSearchId === id) {
      setActiveCreateItemSearchId(null);
    }
  }

  function updateCreateItem(id: string, patch: Partial<CreateOrderItemDraft>) {
    setCreateItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function getDefaultSkuPrice(skuId: string) {
    const sku = skuOptions.find((item) => item.id === skuId);
    if (!sku) return 0;
    const matchedPrice =
      sku.prices?.find((price) => String(price.group_id) === String(selectedCreateCustomer?.group_id)) ??
      sku.prices?.[0];
    return Number(matchedPrice?.price ?? 0);
  }

  function getSkuDisplayName(sku: SkuOption) {
    return `${sku.products?.brand ?? ""} ${sku.products?.name ?? ""} ${sku.size_label ?? ""} (${sku.sku_code ?? "-"})`.trim();
  }

  function addEditItemRow() {
    setEditItems((prev) => [...prev, { id: crypto.randomUUID(), sku_id: "", quantity: "1", unit_price: "0" }]);
  }

  function removeEditItemRow(id: string) {
    setEditItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  }

  function updateEditItem(id: string, patch: Partial<EditOrderItemDraft>) {
    setEditItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function openBonusModal(order: OrderRow) {
    setError(null);
    setBonusOrder(order);
    setBonusOpen(true);
    setBonusQty("1");
    setBonusReason("");
    if (!bonusSkuId) setBonusSkuId("");
    await loadSkuOptions();
  }

  async function submitBonusIssue() {
    if (!supabase || !bonusOrder) return;
    const qty = Number(bonusQty);
    if (!bonusSkuId) {
      setError("กรุณาเลือกรายการสินค้า");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("จำนวนสินค้าไม่ถูกต้อง");
      return;
    }

    setBonusSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const createdBy = authData.user?.id ?? null;

      const { data: bonusData, error: bonusError } = await supabase
        .from("order_bonus_items")
        .insert({
          order_id: bonusOrder.id,
          sku_id: bonusSkuId,
          quantity: qty,
          source: "manual",
          reason: bonusReason.trim() || null,
          created_by: createdBy
        })
        .select("id")
        .single();
      if (bonusError) throw new Error(bonusError.message);

      const { data: invData, error: invError } = await supabase
        .from("inventory")
        .select("sku_id,qty_on_hand,qty_reserved,min_stock")
        .eq("sku_id", bonusSkuId)
        .maybeSingle();
      if (invError || !invData) {
        throw new Error(invError?.message ?? "ไม่พบสต๊อกสินค้านี้");
      }

      const nextOnHand = Math.max(0, Number(invData.qty_on_hand ?? 0) - qty);
      const { error: invUpdateError } = await supabase.from("inventory").upsert({
        sku_id: bonusSkuId,
        qty_on_hand: nextOnHand,
        qty_reserved: invData.qty_reserved ?? 0,
        min_stock: invData.min_stock ?? 0
      });
      if (invUpdateError) throw new Error(invUpdateError.message);

      const { error: movementError } = await supabase.from("inventory_movements").insert({
        sku_id: bonusSkuId,
        movement_type: "bonus",
        qty_change: -qty,
        ref_type: "order",
        ref_id: bonusOrder.id,
        note: bonusReason.trim() || "เบิกฟรี/ของแถมจากหน้าออเดอร์",
        order_bonus_item_id: bonusData?.id ?? null,
        created_by: createdBy
      });
      if (movementError) throw new Error(movementError.message);

      setSuccess("เพิ่มของแถม/เบิกฟรีเรียบร้อย");
      setBonusOpen(false);
      setBonusOrder(null);
      setBonusSkuId("");
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกของแถมไม่สำเร็จ");
    } finally {
      setBonusSaving(false);
    }
  }

  async function confirmCart(order: OrderRow) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }

    if (order.source !== "cart" || !order.cart_id) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1) ดึง cart
      const { data: cartInfo, error: cartInfoError } = await supabase
        .from("carts")
        .select("id, scheduled_at, datetrans, timetrans, service_fee, shipping_fee, customer_id, status, payment_option")
        .eq("id", order.cart_id)
        .maybeSingle();

      if (cartInfoError) {
        throw new Error(cartInfoError.message);
      }

      if (!cartInfo) {
        throw new Error("ไม่พบข้อมูล cart");
      }





      if (cartInfo.status === "confirm") {
        throw new Error("cart นี้ถูกยืนยันแล้ว");
      }

      const fallbackScheduledDate = cartInfo.scheduled_at
        ? new Date(cartInfo.scheduled_at)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const scheduledDate = buildScheduledAtFromTrans(
        (cartInfo as { datetrans?: string | null }).datetrans ?? null,
        (cartInfo as { timetrans?: string | null }).timetrans ?? null,
        fallbackScheduledDate
      );

      // auto default: งานละ 2 ชั่วโมง (ปรับได้ในหน้า Install)
      const installDurationMinutes = DEFAULT_INSTALL_DURATION_MINUTES;

      // ตรวจทีมช่างที่ว่างล่วงหน้า ก่อนสร้าง order
      let technicians: { id: string; full_name: string | null }[] = [];
      const { data: activeTechData, error: activeTechError } = await supabase
        .from("technicians")
        .select("id,full_name")
        .eq("active", true)
        .order("full_name", { ascending: true });
      if (!activeTechError) {
        technicians = (activeTechData ?? []) as { id: string; full_name: string | null }[];
      } else if (activeTechError.message.toLowerCase().includes("active")) {
        // fallback for old schema that does not have "active" column
        const { data: legacyTechData, error: legacyTechError } = await supabase
          .from("technicians")
          .select("id,full_name")
          .order("full_name", { ascending: true });
        if (legacyTechError) {
          throw new Error(legacyTechError.message);
        }
        technicians = (legacyTechData ?? []) as { id: string; full_name: string | null }[];
      } else {
        throw new Error(activeTechError.message);
      }
      if (technicians.length === 0) {
        throw new Error("ยังไม่มีทีมช่างที่พร้อมใช้งาน");
      }

      const dayStart = new Date(scheduledDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      dayEnd.setMilliseconds(dayEnd.getMilliseconds() - 1);

      const technicianIds = technicians.map((tech) => tech.id);
      const { data: dayAppointments, error: dayAppointmentsError } = await supabase
        .from("install_appointments")
        .select("id,technician_id,status,job_duration_minutes,scheduled_at")
        .gte("scheduled_at", dayStart.toISOString())
        .lte("scheduled_at", dayEnd.toISOString())
        .in("technician_id", technicianIds);
      if (dayAppointmentsError) {
        throw new Error(dayAppointmentsError.message);
      }

      const loadByTech = new Map<string, { jobs: number; minutes: number }>();
      technicians.forEach((tech) => loadByTech.set(tech.id, { jobs: 0, minutes: 0 }));
      const occupiedSlotsByTech = new Map<string, Set<number>>();
      technicians.forEach((tech) => occupiedSlotsByTech.set(tech.id, new Set<number>()));
      ((dayAppointments ?? []) as {
        technician_id: string | null;
        status: string | null;
        job_duration_minutes: number | null;
        scheduled_at?: string | null;
      }[]).forEach((appointment) => {
        if (!appointment.technician_id) return;
        if (appointment.status === "cancelled") return;
        const current = loadByTech.get(appointment.technician_id) ?? { jobs: 0, minutes: 0 };
        current.jobs += 1;
        current.minutes += Number(
          appointment.job_duration_minutes ?? DEFAULT_INSTALL_DURATION_MINUTES
        );
        loadByTech.set(appointment.technician_id, current);

        if (appointment.scheduled_at) {
          const appointmentDate = new Date(appointment.scheduled_at);
          const slotIdx = INSTALL_TIME_SLOTS.findIndex(
            (slot) =>
              appointmentDate.getHours() === slot.startHour &&
              appointmentDate.getMinutes() === slot.startMinute
          );
          if (slotIdx >= 0) {
            const slotSet = occupiedSlotsByTech.get(appointment.technician_id) ?? new Set<number>();
            slotSet.add(slotIdx);
            occupiedSlotsByTech.set(appointment.technician_id, slotSet);
          }
        }
      });

      const scheduleCandidates = technicians
        .flatMap((tech) => {
          const load = loadByTech.get(tech.id) ?? { jobs: 0, minutes: 0 };
          const occupied = occupiedSlotsByTech.get(tech.id) ?? new Set<number>();
          return INSTALL_TIME_SLOTS.map((slot, slotIndex) => ({
            tech,
            load,
            slot,
            slotIndex,
            available:
              !occupied.has(slotIndex) &&
              load.jobs < MAX_INSTALL_JOBS_PER_DAY &&
              load.minutes + installDurationMinutes <= MAX_INSTALL_MINUTES_PER_DAY
          }));
        })
        .filter((candidate) => candidate.available)
        .sort((a, b) => {
          if (a.load.jobs !== b.load.jobs) return a.load.jobs - b.load.jobs;
          if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
          return (a.tech.full_name ?? "").localeCompare(b.tech.full_name ?? "");
        });

      if (scheduleCandidates.length === 0) {
        throw new Error("ไม่มีทีมช่างว่างในช่วงเวลา 09:00-11:00, 13:00-15:00, 15:00-17:00");
      }
      const selected = scheduleCandidates[0];
      const selectedTech = selected.tech;
      const selectedSlot = selected.slot;
      const scheduledAt = new Date(dayStart);
      scheduledAt.setHours(selectedSlot.startHour, selectedSlot.startMinute, 0, 0);

      // 2) ดึง cart items พร้อม price
      const { data: cartItems, error: cartItemError } = await supabase
        .from("cart_items")
        .select("sku_id, quantity, skus(id, prices(price, group_id))")
        .eq("cart_id", order.cart_id);



      if (cartItemError) {
        throw new Error(cartItemError.message);
      }

      if (!cartItems || cartItems.length === 0) {
        throw new Error("ไม่พบรายการสินค้าใน cart");
      }

      // 3) ดึง customer เพื่อหา group_id
      const { data: customerInfo, error: customerError } = await supabase
        .from("customes")
        .select("id, group_id")
        .eq("id", cartInfo.customer_id)
        .maybeSingle();

      if (customerError) {
        throw new Error(customerError.message);
      }

      const groupId = customerInfo?.group_id ?? null;

      // helper หา price ตาม group
      const normalizedItems = (cartItems ?? []).map((item) => {
        const skuObj =
          item.skus && Array.isArray(item.skus) ? item.skus[0] : item.skus;

        const prices = Array.isArray(skuObj?.prices) ? skuObj.prices : [];

        const matchedPrice =
          prices.find((price) => String(price.group_id) === String(groupId)) ??
          prices[0] ??
          null;

        const unitPrice = Number(matchedPrice?.price ?? 0);
        const quantity = Number(item.quantity ?? 0);
        const lineTotal = unitPrice * quantity;

        return {
          sku_id: item.sku_id ?? null,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
        };
      });

      if (normalizedItems.length === 0) {
        throw new Error("ไม่สามารถคำนวณรายการสินค้าได้");
      }

      const subtotal = normalizedItems.reduce((sum, item) => sum + item.line_total, 0);
      const discount = 0;
      const shippingFee = Number(cartInfo.shipping_fee ?? 0);
      const serviceFee = Number(cartInfo.service_fee ?? 0);
      const totalAmount = subtotal - discount + shippingFee + serviceFee;
      const nextOrderNo = await generateOrderNo(scheduledDate);

      // 4) สร้าง order
      const { data: createdOrder, error: createError } = await supabase
        .from("orders")
        .insert({
          order_no: nextOrderNo,
          customer_id: cartInfo.customer_id,
          site_id: "1df52c4e-2178-400f-9cd6-cb38cf8549a7",
          subtotal,
          discount,
          shipping_fee: shippingFee,
          total_amount: totalAmount,
          status: "processing",
          payment_status: "paid",
          payment_option: cartInfo.payment_option ?? "full",
          datetrans: (cartInfo as { datetrans?: string | null }).datetrans ?? null,
          timetrans: (cartInfo as { timetrans?: string | null }).timetrans ?? null,
          cart_id: order.cart_id,
        })
        .select("id")
        .single();

      if (createError) {
        throw new Error(createError.message);
      }

      if (!createdOrder?.id) {
        throw new Error("ไม่สามารถสร้างออร์เดอร์ได้");
      }

      // 5) สร้าง order items
      const orderItems = normalizedItems
        .filter((item) => item.sku_id && item.quantity > 0)
        .map((item) => ({
          order_id: createdOrder.id,
          sku_id: item.sku_id as string,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        }));

      if (orderItems.length === 0) {
        throw new Error("ไม่มีรายการสินค้าที่พร้อมบันทึก");
      }

      const { error: itemInsertError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemInsertError) {
        throw new Error(itemInsertError.message);
      }

      // 6) จองสต๊อก (qty_reserved)
      for (const item of orderItems) {
        const { data: invData, error: invError } = await supabase
          .from("inventory")
          .select("sku_id,qty_reserved,qty_on_hand,min_stock")
          .eq("sku_id", item.sku_id)
          .maybeSingle();
        if (invError || !invData) {
          throw new Error(invError?.message ?? "ไม่พบสต๊อก");
        }
        const nextReserved = (invData.qty_reserved ?? 0) + item.quantity;
        const { error: updateError } = await supabase.from("inventory").upsert({
          sku_id: invData.sku_id,
          qty_reserved: nextReserved,
          qty_on_hand: invData.qty_on_hand ?? 0,
          min_stock: invData.min_stock ?? 0
        });
        if (updateError) {
          throw new Error(updateError.message);
        }
      }

      // 7) สร้างนัดติดตั้ง

      const installPayload = {
        order_id: createdOrder.id,
        scheduled_at: scheduledAt.toISOString(),
        datetrans: (cartInfo as { datetrans?: string | null }).datetrans ?? null,
        timetrans: (cartInfo as { timetrans?: string | null }).timetrans ?? null,
        technician_id: selectedTech.id,
        job_duration_minutes: installDurationMinutes,
        status: "waiting" as const
      };
      let { error: installError } = await supabase
        .from("install_appointments")
        .insert(installPayload);
      if (
        installError &&
        (installError.message.toLowerCase().includes("datetrans") ||
          installError.message.toLowerCase().includes("timetrans"))
      ) {
        const legacyInsert = await supabase
          .from("install_appointments")
          .insert({
            order_id: createdOrder.id,
            scheduled_at: scheduledAt.toISOString(),
            technician_id: selectedTech.id,
            job_duration_minutes: installDurationMinutes,
            status: "waiting" as const
          });
        installError = legacyInsert.error;
      }

      if (installError) {
        if (installError.message.toLowerCase().includes("job_duration_minutes")) {
          const { error: legacyInstallError } = await supabase
            .from("install_appointments")
            .insert({
              order_id: createdOrder.id,
              scheduled_at: scheduledAt.toISOString(),
              technician_id: selectedTech.id,
              status: "waiting"
            });
          if (legacyInstallError) {
            throw new Error(legacyInstallError.message);
          }
        } else {
          throw new Error(installError.message);
        }
      }

      // 8) update cart status
      const { error: cartUpdateError } = await supabase
        .from("carts")
        .update({ status: "confirm" })
        .eq("id", order.cart_id);
      if (cartUpdateError) {
        throw new Error(cartUpdateError.message);
      }

      setSuccess(
        `ยืนยันออร์เดอร์เรียบร้อย (ทีม: ${selectedTech.full_name ?? selectedTech.id}, เวลา: ${selectedSlot.label})`
      );
      await loadOrders();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: OrderRow["status"]) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("อัปเดตสถานะออร์เดอร์เรียบร้อย");
      await loadOrders();
    }
  }

  async function updatePayment(id: string, status: OrderRow["payment_status"]) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    const { error: updateError } = await supabase
      .from("orders")
      .update({ payment_status: status })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("อัปเดตสถานะการชำระเงินเรียบร้อย");
      await loadOrders();
    }
  }

  async function ensureInstallAppointmentForOrder(order: OrderRow) {
    if (!supabase) {
      throw new Error("ยังไม่ได้ตั้งค่า Supabase env");
    }

    const { data: existingAppointment, error: existingAppointmentError } = await supabase
      .from("install_appointments")
      .select("id,status")
      .eq("order_id", order.id)
      .neq("status", "cancelled")
      .limit(1)
      .maybeSingle();
    if (existingAppointmentError) {
      throw new Error(existingAppointmentError.message);
    }
    let orderTransDate = order.datetrans ?? null;
    let orderTransTime = order.timetrans ?? null;
    if (!orderTransDate || !orderTransTime) {
      const { data: orderTransData } = await supabase
        .from("orders")
        .select("datetrans,timetrans,cart_id")
        .eq("id", order.id)
        .maybeSingle();
      orderTransDate =
        orderTransDate ??
        ((orderTransData as { datetrans?: string | null } | null)?.datetrans ?? null);
      orderTransTime =
        orderTransTime ??
        ((orderTransData as { timetrans?: string | null } | null)?.timetrans ?? null);
      const cartId = (orderTransData as { cart_id?: string | null } | null)?.cart_id ?? null;
      if ((!orderTransDate || !orderTransTime) && cartId) {
        const { data: cartTransData } = await supabase
          .from("carts")
          .select("datetrans,timetrans")
          .eq("id", cartId)
          .maybeSingle();
        orderTransDate =
          orderTransDate ??
          ((cartTransData as { datetrans?: string | null } | null)?.datetrans ?? null);
        orderTransTime =
          orderTransTime ??
          ((cartTransData as { timetrans?: string | null } | null)?.timetrans ?? null);
      }
    }

    const fallbackDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const scheduledDate = buildScheduledAtFromTrans(orderTransDate, orderTransTime, fallbackDate);
    const installDurationMinutes = DEFAULT_INSTALL_DURATION_MINUTES;

    let technicians: { id: string; full_name: string | null }[] = [];
    const { data: activeTechData, error: activeTechError } = await supabase
      .from("technicians")
      .select("id,full_name")
      .eq("active", true)
      .order("full_name", { ascending: true });
    if (!activeTechError) {
      technicians = (activeTechData ?? []) as { id: string; full_name: string | null }[];
    } else if (activeTechError.message.toLowerCase().includes("active")) {
      const { data: legacyTechData, error: legacyTechError } = await supabase
        .from("technicians")
        .select("id,full_name")
        .order("full_name", { ascending: true });
      if (legacyTechError) throw new Error(legacyTechError.message);
      technicians = (legacyTechData ?? []) as { id: string; full_name: string | null }[];
    } else {
      throw new Error(activeTechError.message);
    }

    if (technicians.length === 0) {
      throw new Error("ยังไม่มีทีมช่างที่พร้อมใช้งาน");
    }

    const dayStart = new Date(scheduledDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setMilliseconds(dayEnd.getMilliseconds() - 1);

    const technicianIds = technicians.map((tech) => tech.id);
    const { data: dayAppointments, error: dayAppointmentsError } = await supabase
      .from("install_appointments")
      .select("id,technician_id,status,job_duration_minutes,scheduled_at")
      .gte("scheduled_at", dayStart.toISOString())
      .lte("scheduled_at", dayEnd.toISOString())
      .in("technician_id", technicianIds);
    if (dayAppointmentsError) {
      throw new Error(dayAppointmentsError.message);
    }

    const loadByTech = new Map<string, { jobs: number; minutes: number }>();
    technicians.forEach((tech) => loadByTech.set(tech.id, { jobs: 0, minutes: 0 }));
    const occupiedSlotsByTech = new Map<string, Set<number>>();
    technicians.forEach((tech) => occupiedSlotsByTech.set(tech.id, new Set<number>()));
    ((dayAppointments ?? []) as {
      technician_id: string | null;
      status: string | null;
      job_duration_minutes: number | null;
      scheduled_at?: string | null;
    }[]).forEach((appointment) => {
      if (!appointment.technician_id) return;
      if (appointment.status === "cancelled") return;
      const current = loadByTech.get(appointment.technician_id) ?? { jobs: 0, minutes: 0 };
      current.jobs += 1;
      current.minutes += Number(
        appointment.job_duration_minutes ?? DEFAULT_INSTALL_DURATION_MINUTES
      );
      loadByTech.set(appointment.technician_id, current);

      if (appointment.scheduled_at) {
        const appointmentDate = new Date(appointment.scheduled_at);
        const slotIdx = INSTALL_TIME_SLOTS.findIndex(
          (slot) =>
            appointmentDate.getHours() === slot.startHour &&
            appointmentDate.getMinutes() === slot.startMinute
        );
        if (slotIdx >= 0) {
          const slotSet = occupiedSlotsByTech.get(appointment.technician_id) ?? new Set<number>();
          slotSet.add(slotIdx);
          occupiedSlotsByTech.set(appointment.technician_id, slotSet);
        }
      }
    });

    const scheduleCandidates = technicians
      .flatMap((tech) => {
        const load = loadByTech.get(tech.id) ?? { jobs: 0, minutes: 0 };
        const occupied = occupiedSlotsByTech.get(tech.id) ?? new Set<number>();
        return INSTALL_TIME_SLOTS.map((slot, slotIndex) => ({
          tech,
          load,
          slot,
          slotIndex,
          available:
            !occupied.has(slotIndex) &&
            load.jobs < MAX_INSTALL_JOBS_PER_DAY &&
            load.minutes + installDurationMinutes <= MAX_INSTALL_MINUTES_PER_DAY
        }));
      })
      .filter((candidate) => candidate.available)
      .sort((a, b) => {
        if (a.load.jobs !== b.load.jobs) return a.load.jobs - b.load.jobs;
        if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
        return (a.tech.full_name ?? "").localeCompare(b.tech.full_name ?? "");
      });

    if (scheduleCandidates.length === 0) {
      throw new Error("ไม่มีทีมช่างว่างในช่วงเวลา 09:00-11:00, 13:00-15:00, 15:00-17:00");
    }

    const selected = scheduleCandidates[0];
    const scheduledAt = new Date(dayStart);
    scheduledAt.setHours(selected.slot.startHour, selected.slot.startMinute, 0, 0);

    if (existingAppointment?.id) {
      let { error: updateError } = await supabase
        .from("install_appointments")
        .update({
          scheduled_at: scheduledAt.toISOString(),
          datetrans: orderTransDate,
          timetrans: orderTransTime
        })
        .eq("id", existingAppointment.id);
      if (
        updateError &&
        (updateError.message.toLowerCase().includes("datetrans") ||
          updateError.message.toLowerCase().includes("timetrans"))
      ) {
        const legacyUpdate = await supabase
          .from("install_appointments")
          .update({ scheduled_at: scheduledAt.toISOString() })
          .eq("id", existingAppointment.id);
        updateError = legacyUpdate.error;
      }
      if (updateError) throw new Error(updateError.message);
      return;
    }

    const installPayload = {
      order_id: order.id,
      scheduled_at: scheduledAt.toISOString(),
      datetrans: orderTransDate,
      timetrans: orderTransTime,
      technician_id: selected.tech.id,
      job_duration_minutes: installDurationMinutes,
      status: "waiting" as const
    };
    let { error: installError } = await supabase
      .from("install_appointments")
      .insert(installPayload);
    if (
      installError &&
      (installError.message.toLowerCase().includes("datetrans") ||
        installError.message.toLowerCase().includes("timetrans"))
    ) {
      const legacyInsert = await supabase
        .from("install_appointments")
        .insert({
          order_id: order.id,
          scheduled_at: scheduledAt.toISOString(),
          technician_id: selected.tech.id,
          job_duration_minutes: installDurationMinutes,
          status: "waiting" as const
        });
      installError = legacyInsert.error;
    }

    if (installError) {
      if (installError.message.toLowerCase().includes("job_duration_minutes")) {
        const { error: legacyInstallError } = await supabase
          .from("install_appointments")
          .insert({
            order_id: order.id,
            scheduled_at: scheduledAt.toISOString(),
            technician_id: selected.tech.id,
            status: "waiting"
          });
        if (legacyInstallError) throw new Error(legacyInstallError.message);
      } else {
        throw new Error(installError.message);
      }
    }
  }

  async function confirmPaymentAndProcess(order: OrderRow) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const draft = appointmentDrafts[order.id];
      const nextDate = (draft?.date ?? order.datetrans ?? "").trim() || null;
      const nextTime = (draft?.time ?? order.timetrans ?? "").trim() || null;

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          status: "processing",
          datetrans: nextDate,
          timetrans: nextTime
        })
        .eq("id", order.id);
      if (updateError) {
        throw new Error(updateError.message);
      }

      await ensureInstallAppointmentForOrder({
        ...order,
        datetrans: nextDate,
        timetrans: nextTime
      });
      const lineResult = await sendPaymentConfirmedFlexMessage({
        ...order,
        datetrans: nextDate,
        timetrans: nextTime
      });
      if (lineResult.sent) {
        setSuccess("ยืนยันชำระเงินและสร้างนัดติดตั้งเรียบร้อย พร้อมส่งแจ้งเตือนทาง LINE แล้ว");
      } else if (lineResult.reason === "missing-line-id") {
        setSuccess("ยืนยันชำระเงินและสร้างนัดติดตั้งเรียบร้อย (ยังไม่ได้ส่ง LINE: ไม่พบ LINE Msg User ID)");
      } else {
        setSuccess("ยืนยันชำระเงินและสร้างนัดติดตั้งเรียบร้อย");
      }
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยืนยันชำระเงินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedId) return;
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    const shippingFee = Number(editShippingFee);
    const discount = Number(editDiscount);
    const paidAmountInput = Number(editPaidAmountInput || 0);
    if (!Number.isFinite(shippingFee) || shippingFee < 0) {
      setError("ค่าจัดส่งไม่ถูกต้อง");
      return;
    }
    if (!Number.isFinite(discount) || discount < 0) {
      setError("ส่วนลดไม่ถูกต้อง");
      return;
    }
    if (!Number.isFinite(paidAmountInput) || paidAmountInput < 0) {
      setError("ยอดที่ชำระแล้วไม่ถูกต้อง");
      return;
    }
    if (!editCustomerId || !editSiteId) {
      setError("กรุณาเลือกลูกค้าและเว็บไซต์");
      return;
    }

    const normalizedItems = editItems
      .map((item) => ({
        sku_id: item.sku_id,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price)
      }))
      .filter((item) => item.sku_id && Number.isFinite(item.quantity) && item.quantity > 0);
    if (normalizedItems.length === 0) {
      setError("กรุณาระบุรายการสินค้าอย่างน้อย 1 รายการ");
      return;
    }
    if (normalizedItems.some((item) => !Number.isFinite(item.unit_price) || item.unit_price < 0)) {
      setError("ราคาสินค้าไม่ถูกต้อง");
      return;
    }
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const total = Math.max(0, subtotal + shippingFee - discount);
    const paidAmount = Math.min(total, Math.max(0, paidAmountInput));
    const paymentOption = selectedOrder?.payment_option ?? "full";

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          customer_id: editCustomerId,
          site_id: editSiteId,
          status: formStatus,
          payment_status: formPayment,
          shipping_fee: shippingFee,
          discount,
          subtotal,
          total_amount: total,
          pay_now_amount: paidAmount,
          deposit_amount: paymentOption === "deposit" ? paidAmount : 0
        })
        .eq("id", selectedId);
      if (updateError) throw new Error(updateError.message);

      const { error: deleteItemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", selectedId);
      if (deleteItemsError) throw new Error(deleteItemsError.message);

      const { error: insertItemsError } = await supabase.from("order_items").insert(
        normalizedItems.map((item) => ({
          order_id: selectedId,
          sku_id: item.sku_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.quantity * item.unit_price
        }))
      );
      if (insertItemsError) throw new Error(insertItemsError.message);

      setSuccess("บันทึกออร์เดอร์เรียบร้อย");
      setModalOpen(false);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกออร์เดอร์ไม่สำเร็จ");
    }
    setLoading(false);
  }

  async function handleDelete(order: OrderRow) {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!confirm(`ลบออร์เดอร์ ${order.order_no} ใช่หรือไม่`)) return;
    setLoading(true);
    setError(null);
    const { error: deleteError } = await supabase.from("orders").delete().eq("id", order.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("ลบออร์เดอร์เรียบร้อย");
      await loadOrders();
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    if (!createForm.site_id) {
      setError("กรุณาเลือกเว็บไซต์");
      return;
    }
    if (createForm.customer_mode === "select" && !createForm.customer_id) {
      setError("กรุณาเลือกลูกค้า");
      return;
    }
    if (createForm.customer_mode === "manual" && !createForm.customer_name.trim()) {
      setError("กรุณากรอกชื่อลูกค้า");
      return;
    }
    const shippingFee = Number(createForm.shipping_fee);
    const discount = Number(createForm.discount);
    const paidAmountInput = Number(createPaidAmountInput || 0);
    if (!Number.isFinite(shippingFee) || shippingFee < 0) {
      setError("ค่าจัดส่งไม่ถูกต้อง");
      return;
    }
    if (!Number.isFinite(discount) || discount < 0) {
      setError("ส่วนลดไม่ถูกต้อง");
      return;
    }
    if (!Number.isFinite(paidAmountInput) || paidAmountInput < 0) {
      setError("ยอดที่ชำระแล้วไม่ถูกต้อง");
      return;
    }

    const normalizedItems = createItems
      .map((item) => ({
        sku_id: item.sku_id,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price)
      }))
      .filter((item) => item.sku_id && Number.isFinite(item.quantity) && item.quantity > 0);

    if (normalizedItems.length === 0) {
      setError("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    if (normalizedItems.some((item) => !Number.isFinite(item.unit_price) || item.unit_price < 0)) {
      setError("ราคาสินค้าไม่ถูกต้อง");
      return;
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const total = Math.max(0, subtotal + shippingFee - discount);
    const paidAmount = Math.min(total, Math.max(0, paidAmountInput));

    setLoading(true);
    setError(null);
    try {
      const nextOrderNo = await generateOrderNo();
      const manualName = createForm.customer_name.trim();
      const manualPhone = createForm.customer_phone.trim();
      const manualAddress = createForm.customer_address.trim();
      let orderCustomerId = createForm.customer_id;
      if (createForm.customer_mode === "manual") {
        const normalizedLineUserId = `nolineid-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const { data: createdCustomer, error: customerInsertError } = await supabase
          .from("customes")
          .insert({
            line_user_id: normalizedLineUserId,
            display_name: manualName,
            full_name: manualName,
            phone: manualPhone || null,
            address: manualAddress || null
          })
          .select("id")
          .single();
        if (customerInsertError) {
          throw new Error(`สร้างข้อมูลลูกค้าไม่สำเร็จ: ${customerInsertError.message}`);
        }
        if (!createdCustomer?.id) {
          throw new Error("ไม่สามารถสร้างข้อมูลลูกค้าได้");
        }
        orderCustomerId = createdCustomer.id;
      }
      const snapshotName =
        createForm.customer_mode === "manual"
          ? manualName || null
          : selectedCreateCustomer?.display_name ??
          selectedCreateCustomer?.full_name ??
          selectedCreateCustomer?.email ??
          null;
      const snapshotPhone =
        createForm.customer_mode === "manual"
          ? manualPhone || null
          : selectedCreateCustomer?.phone ?? null;
      const snapshotAddress =
        createForm.customer_mode === "manual"
          ? manualAddress || null
          : selectedCreateCustomer?.address ?? null;
      const { data: createdOrder, error: insertError } = await supabase
        .from("orders")
        .insert({
          order_no: nextOrderNo,
          customer_id: orderCustomerId,
          customer_name: snapshotName,
          customer_phone: snapshotPhone,
          customer_address: snapshotAddress,
          site_id: createForm.site_id,
          subtotal,
          shipping_fee: shippingFee,
          discount,
          total_amount: total,
          status: "pending",
          payment_status: "unpaid",
          payment_option: createForm.payment_option,
          pay_now_amount: paidAmount,
          deposit_amount: createForm.payment_option === "deposit" ? paidAmount : 0
        })
        .select("id")
        .single();
      if (insertError) {
        throw new Error(insertError.message);
      }
      if (!createdOrder?.id) {
        throw new Error("ไม่สามารถสร้างออร์เดอร์ได้");
      }

      const orderItems = normalizedItems.map((item) => ({
        order_id: createdOrder.id,
        sku_id: item.sku_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.quantity * item.unit_price
      }));

      const { error: orderItemError } = await supabase.from("order_items").insert(orderItems);
      if (orderItemError) {
        throw new Error(orderItemError.message);
      }

      setSuccess("เพิ่มออร์เดอร์เรียบร้อย");
      setCreateOpen(false);
      const defaultSiteId = sites[0]?.id ?? "";
      setCreateForm({
        customer_mode: "select",
        customer_id: "",
        customer_name: "",
        customer_phone: "",
        customer_address: "",
        site_id: defaultSiteId,
        shipping_fee: "0",
        discount: "0",
        payment_option: "full"
      });
      setCreatePaidAmountInput("0");
      const freshId = crypto.randomUUID();
      setCreateItems([{ id: freshId, sku_id: "", quantity: "1", unit_price: "0" }]);
      setCreateItemSearch({});
      setActiveCreateItemSearchId(null);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เพิ่มออร์เดอร์ไม่สำเร็จ");
    }
    setLoading(false);
  }

  const selectedOrder = orders.find((o) => o.id === selectedId) || null;
  const selectedBonusSku = skuOptions.find((sku) => sku.id === bonusSkuId) ?? null;
  const editSubtotal = editItems.reduce(
    (sum, row) => sum + Number(row.quantity || 0) * Number(row.unit_price || 0),
    0
  );
  const editTotal = Math.max(0, editSubtotal + Number(editShippingFee || 0) - Number(editDiscount || 0));
const editPaymentTypeLabel =
  selectedOrder?.payment_option && PAYMENT_OPTION_LABEL[selectedOrder.payment_option]
    ? PAYMENT_OPTION_LABEL[selectedOrder.payment_option]
    : PAYMENT_OPTION_LABEL.full;
const editPaidAmount = Math.min(editTotal, Math.max(0, Number(editPaidAmountInput || 0)));
const editOutstandingAmount = Math.max(0, editTotal - editPaidAmount);

  return (
    <div className="page active" style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div className="order-filters">
        <div className="order-filters-top">
          <div className="search-bar order-search">
            <input
              placeholder="ค้นหาออร์เดอร์..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={async () => {
              const freshId = crypto.randomUUID();
              const defaultSiteId = sites[0]?.id ?? "";
            setCreateForm({
                customer_mode: "select",
                customer_id: "",
                customer_name: "",
                customer_phone: "",
                customer_address: "",
                site_id: defaultSiteId,
                shipping_fee: "0",
                discount: "0",
              payment_option: "full"
            });
            setCreatePaidAmountInput("0");
            setCreateItems([{ id: freshId, sku_id: "", quantity: "1", unit_price: "0" }]);
              setCreateItemSearch({});
              setActiveCreateItemSearchId(null);
              setCreateOpen(true);
              await loadSkuOptions();
            }}
          >
            เพิ่มออร์เดอร์
          </button>
        </div>
        <div className="order-filters-bottom">
          <div className="order-filter-tabs">
            {filterLabels.map((item) => (
              <div
                key={item.key}
                className={`filter-tab ${activeFilterLabel.includes(item.match) ? "active" : ""}`}
                onClick={() => setFilter(item.label)}
              >
                {item.label}
              </div>
            ))}
          </div>
          <div className="order-filter-controls">
            <div className="order-date-range order-date-range-sm">
              <AppDatePicker
                className="auth-input"
                value={startDate}
                onChange={setStartDate}
              />
              <span>-</span>
              <AppDatePicker
                className="auth-input"
                value={endDate}
                onChange={setEndDate}
              />
            </div>
          </div>
        </div>
      </div>

      <ActionFeedback
        error={error}
        success={success}
        onClearError={() => setError(null)}
        onClearSuccess={() => setSuccess(null)}
      />

      <div className="card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div className="table-wrap" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>วันที่</th>
                <th>ออร์เดอร์ #</th>
                <th>วันที่นัดหมาย</th>
                <th>เวลานัดหมาย</th>
                <th>ลูกค้า</th>
                <th>กลุ่ม</th>
                <th>Site</th>
                <th>สินค้า</th>
                <th>ยอดรวม</th>
                <th>รูปแบบชำระ</th>
                <th>ยอดค้างชำระ</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order) => {
                const isConfirmed = order.source === "order" && confirmedOrders?.has(order.id);
                const draft = appointmentDrafts[order.id] ?? { date: order.datetrans ?? "", time: order.timetrans ?? "" };
                return (
                  <tr key={order.id}>
                    <td style={{ color: "var(--text3)", fontSize: 12 }}>
                      {new Date(order.created_at).toLocaleDateString("th-TH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </td>
                    <td className="mono" style={{ color: "var(--accent)" }}>{order.order_no}</td>
                    <td style={{ minWidth: 148 }}>
                      <AppDatePicker
                        className="auth-input"
                        value={draft.date}
                        onChange={(value) =>
                          setAppointmentDrafts((prev) => ({
                            ...prev,
                            [order.id]: { date: value, time: prev[order.id]?.time ?? draft.time }
                          }))
                        }
                      />
                    </td>
                    <td style={{ minWidth: 118 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <select
                          className="filter-select"
                          style={{ width: 110, padding: "4px 6px", fontSize: 12 }}
                          value={draft.time}
                          onChange={(e) =>
                            setAppointmentDrafts((prev) => ({
                              ...prev,
                              [order.id]: { date: prev[order.id]?.date ?? draft.date, time: e.target.value }
                            }))
                          }
                        >
                          <option value="">เลือกเวลา</option>
                          {timeSlotOptions.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                          {draft.time && !timeSlotOptions.includes(draft.time) ? (
                            <option value={draft.time}>{draft.time}</option>
                          ) : null}
                        </select>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 8px", fontSize: 11, justifyContent: "center" }}
                          disabled={savingAppointmentId === order.id}
                          onClick={() => void saveAppointmentPlan(order)}
                        >
                          {savingAppointmentId === order.id ? "กำลังบันทึก..." : "บันทึกนัด"}
                        </button>
                      </div>
                    </td>
                    <td>{order.customer_name ?? "-"}</td>
                    <td>
                      <span
                        className={`tier-label ${order.customer_group_name === "สมาชิก" ? "t-member" :
                          order.customer_group_name === "ดีลเลอร์เล็ก" ? "t-small" :
                            order.customer_group_name === "ดีลเลอร์กลาง" ? "t-mid" :
                              order.customer_group_name === "ดีลเลอร์ใหญ่" ? "t-big" : "t-general"
                          }`}
                      >
                        {order.customer_group_name ?? "ทั่วไป"}
                      </span>
                    </td>
                    <td>
                      <span className={`site-dot ${order.sites?.code === "car_retail" ? "s1" : order.sites?.code === "truck_dealer" ? "s2" : "s3"}`} />
                      {order.sites?.name ?? "-"}
                    </td>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>
                      {order.items} {order.itemCount ? `×${order.itemCount}` : ""}
                    </td>
                    <td className="mono">
                      ฿{Number(order.total_amount ?? 0).toLocaleString("th-TH")}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text2)" }}>
                      {order.payment_option ? PAYMENT_OPTION_LABEL[order.payment_option] : "-"}
                    </td>
                    <td className="mono" style={{ color: getOutstandingAmount(order) > 0 ? "var(--red)" : "var(--green)" }}>
                      ฿{getOutstandingAmount(order).toLocaleString("th-TH")}
                    </td>
                    <td>
                      <span className={STATUS_CLASS[order.status]}>
                        {isConfirmed ? "ยืนยันแล้ว" : STATUS_LABEL[order.status]}
                      </span>
                    </td>
                    <td>
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <button
                          className="btn btn-ghost"
                          style={{
                            padding: "6px 10px",
                            fontSize: 12,
                            minWidth: 94,
                            borderRadius: 999,
                            borderColor: actionMenuOrderId === order.id ? "var(--border2)" : "var(--border)",
                            background: actionMenuOrderId === order.id ? "var(--bg3)" : "transparent",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8
                          }}
                          onClick={() => setActionMenuOrderId((prev) => (prev === order.id ? null : order.id))}
                        >
                          <span>เมนู</span>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{
                              width: 12,
                              height: 12,
                              opacity: 0.7,
                              transform: actionMenuOrderId === order.id ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform .15s ease"
                            }}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        {actionMenuOrderId === order.id && (
                          <div
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "calc(100% + 6px)",
                              minWidth: 220,
                              background: "var(--bg2)",
                              border: "1px solid var(--border)",
                              borderRadius: 10,
                              boxShadow: "0 10px 24px rgba(0,0,0,.18)",
                              padding: 6,
                              zIndex: 20,
                              display: "flex",
                              flexDirection: "column",
                              gap: 4
                            }}
                          >
                            {order.source === "cart" ? (
                              <>
                                <button
                                  className="btn btn-ghost"
                                  style={{ padding: "8px 10px", fontSize: 12, justifyContent: "flex-start" }}
                                  onClick={async () => {
                                    await openSlipModal(order);
                                    setActionMenuOrderId(null);
                                  }}
                                >
                                  ดูสลิป
                                </button>
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: "8px 10px", fontSize: 12, justifyContent: "flex-start" }}
                                  onClick={() => {
                                    confirmCart(order);
                                    setActionMenuOrderId(null);
                                  }}
                                  disabled={loading}
                                >
                                  ยืนยัน
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="btn btn-ghost"
                                  style={{ padding: "8px 10px", fontSize: 12, justifyContent: "flex-start" }}
                                  onClick={async () => {
                                    await openModal(order.id);
                                    setActionMenuOrderId(null);
                                  }}
                                >
                                  แก้ไข
                                </button>
                                <button
                                  className="btn btn-ghost"
                                  style={{ padding: "8px 10px", fontSize: 12, justifyContent: "flex-start" }}
                                  onClick={() => {
                                    openBonusModal(order);
                                    setActionMenuOrderId(null);
                                  }}
                                >
                                  เพิ่มของแถม/เบิกฟรี
                                </button>
                                {order.payment_status !== "paid" ? (
                                  <>
                                    <button
                                      className="btn btn-ghost"
                                      style={{ padding: "8px 10px", fontSize: 12, justifyContent: "flex-start" }}
                                      onClick={async () => {
                                        await openSlipModal(order);
                                        setActionMenuOrderId(null);
                                      }}
                                    >
                                      ดูสลิป
                                    </button>
                                    <button
                                      className="btn btn-primary"
                                      style={{ padding: "8px 10px", fontSize: 12, justifyContent: "flex-start" }}
                                      onClick={async () => {
                                        await confirmPaymentAndProcess(order);
                                        onConfirmOrder?.(order.id);
                                        setActionMenuOrderId(null);
                                      }}
                                    >
                                      ยืนยันชำระ
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="btn btn-ghost"
                                    style={{ padding: "8px 10px", fontSize: 12, justifyContent: "flex-start" }}
                                    onClick={() => {
                                      openModal(order.id);
                                      setActionMenuOrderId(null);
                                    }}
                                  >
                                    จัดการ
                                  </button>
                                )}
                                <button
                                  className="btn btn-ghost"
                                  style={{ padding: "8px 10px", fontSize: 12, justifyContent: "flex-start" }}
                                  onClick={() => {
                                    updateStatus(order.id, "processing");
                                    setActionMenuOrderId(null);
                                  }}
                                >
                                  ดำเนินการ
                                </button>
                                <button
                                  className="btn btn-ghost"
                                  style={{ padding: "8px 10px", fontSize: 12, justifyContent: "flex-start" }}
                                  onClick={() => {
                                    updateStatus(order.id, "cancelled");
                                    setActionMenuOrderId(null);
                                  }}
                                >
                                  ยกเลิก
                                </button>
                                <button
                                  className="btn btn-ghost"
                                  style={{ padding: "8px 10px", fontSize: 12, color: "var(--red)", justifyContent: "flex-start" }}
                                  onClick={() => {
                                    handleDelete(order);
                                    setActionMenuOrderId(null);
                                  }}
                                >
                                  ลบ
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredOrders.length && !loading && (
                <tr>
                  <td colSpan={13} style={{ color: "var(--text3)", padding: 16 }}>
                    ยังไม่มีออร์เดอร์
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredOrders.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginTop: 12,
              padding: "10px 4px"
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text3)" }}>
              แสดง {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, filteredOrders.length)} จาก {filteredOrders.length} รายการ
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text3)" }}>
              แถว/หน้า
              <select
                className="filter-select"
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                style={{ minWidth: 74, height: 30, padding: "0 8px", fontSize: 12 }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                className="btn btn-ghost"
                style={{ padding: "6px 10px", fontSize: 12, minWidth: 64 }}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                ก่อนหน้า
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                const isActive = page === currentPage;
                if (
                  page !== 1 &&
                  page !== totalPages &&
                  Math.abs(page - currentPage) > 1
                ) {
                  if (page === currentPage - 2 || page === currentPage + 2) {
                    return (
                      <span key={`dots-${page}`} style={{ color: "var(--text3)", padding: "0 2px" }}>
                        ...
                      </span>
                    );
                  }
                  return null;
                }
                return (
                  <button
                    key={page}
                    className="btn btn-ghost"
                    style={{
                      padding: "6px 10px",
                      fontSize: 12,
                      minWidth: 34,
                      borderRadius: 999,
                      borderColor: isActive ? "var(--border2)" : "var(--border)",
                      background: isActive ? "var(--bg3)" : "transparent",
                      fontWeight: isActive ? 600 : 500
                    }}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                className="btn btn-ghost"
                style={{ padding: "6px 10px", fontSize: 12, minWidth: 64 }}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>

      {detailOpen && detailOrder && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 980 }}>
            <div className="modal-head">
              <div>
                <div className="modal-title">รายละเอียดคำสั่งซื้อ {detailOrder.order_no}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                  วันที่สั่งซื้อ{" "}
                  {new Date(detailOrder.created_at).toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                  })}
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => setDetailOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <div style={{ color: "var(--text3)", padding: "8px 2px" }}>กำลังโหลดรายละเอียด...</div>
              ) : (
                <>
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: "var(--bg3)",
                      padding: 12,
                      marginBottom: 12
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>ข้อมูลลูกค้า</div>
                    <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                      <div>
                        <strong>ชื่อ:</strong>{" "}
                        {detailCustomer?.display_name ??
                          detailCustomer?.full_name ??
                          detailOrder.customer_name ??
                          "-"}
                      </div>
                      <div>
                        <strong>โทรศัพท์:</strong> {detailCustomer?.phone ?? "-"}
                      </div>
                      <div>
                        <strong>อีเมล:</strong> {detailCustomer?.email ?? "-"}
                      </div>
                      <div>
                        <strong>ที่อยู่:</strong> {detailCustomer?.address ?? "-"}
                      </div>
                    </div>
                  </div>

                  <div className="table-wrap" style={{ marginBottom: 12 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>รายการสินค้า</th>
                          <th>SKU</th>
                          <th>จำนวน (เส้น)</th>
                          <th>ราคาต่อหน่วย</th>
                          <th>จำนวนเงิน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailLines.map((line) => (
                          <tr key={line.id}>
                            <td>
                              {[line.brand, line.name, line.size_label].filter(Boolean).join(" ") || "-"}
                            </td>
                            <td className="mono">{line.sku_code ?? "-"}</td>
                            <td className="mono">{line.quantity.toLocaleString("th-TH")}</td>
                            <td className="mono">฿{line.unit_price.toLocaleString("th-TH")}</td>
                            <td className="mono">฿{line.line_total.toLocaleString("th-TH")}</td>
                          </tr>
                        ))}
                        {detailLines.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ color: "var(--text3)" }}>
                              ไม่พบรายการสินค้า
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      marginLeft: "auto",
                      maxWidth: 380,
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      background: "var(--bg3)",
                      padding: 12
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>สรุปท้ายบิล</div>
                    <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>ยอดรวมสินค้า</span>
                        <span className="mono">฿{Number(detailOrder.subtotal ?? 0).toLocaleString("th-TH")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>ส่วนลด</span>
                        <span className="mono">฿{Number(detailOrder.discount ?? 0).toLocaleString("th-TH")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>ค่าจัดส่ง</span>
                        <span className="mono">฿{Number(detailOrder.shipping_fee ?? 0).toLocaleString("th-TH")}</span>
                      </div>
                      {detailOrder.payment_option === "deposit" && (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>มัดจำ</span>
                            <span className="mono">฿{Number(detailOrder.deposit_amount ?? 0).toLocaleString("th-TH")}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>ยอดชำระตอนนี้</span>
                            <span className="mono">฿{Number(detailOrder.pay_now_amount ?? 0).toLocaleString("th-TH")}</span>
                          </div>
                        </>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>ยอดชำระแล้ว</span>
                        <span className="mono">฿{getPaidAmount(detailOrder).toLocaleString("th-TH")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--red)" }}>
                        <span>ยอดค้างชำระ</span>
                        <span className="mono">฿{getOutstandingAmount(detailOrder).toLocaleString("th-TH")}</span>
                      </div>
                      <div style={{ borderTop: "1px dashed var(--border2)", marginTop: 2, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                        <span>ยอดรวมสุทธิ</span>
                        <span className="mono">฿{Number(detailOrder.total_amount ?? 0).toLocaleString("th-TH")}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {modalOpen && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">จัดการออร์เดอร์ {selectedOrder.order_no}</div>
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-grid create-order-grid">
                <label>
                  <span className="auth-label">ลูกค้า</span>
                  <select className="create-input" value={editCustomerId} onChange={(e) => setEditCustomerId(e.target.value)}>
                    <option value="">เลือก</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.display_name ?? customer.full_name ?? customer.email ?? customer.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="auth-label">เว็บไซต์</span>
                  <select className="create-input" value={editSiteId} onChange={(e) => setEditSiteId(e.target.value)}>
                    <option value="">เลือก</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name ?? site.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="auth-label">สถานะ</span>
                  <select className="create-input" value={formStatus} onChange={(e) => setFormStatus(e.target.value as OrderRow["status"])}>
                    <option value="pending">รอยืนยัน</option>
                    <option value="processing">กำลังดำเนินการ</option>
                    <option value="shipping">กำลังจัดส่ง</option>
                    <option value="completed">สำเร็จ</option>
                    <option value="cancelled">ยกเลิก</option>
                  </select>
                </label>
                <label>
                  <span className="auth-label">สถานะชำระเงิน</span>
                  <select className="create-input" value={formPayment} onChange={(e) => setFormPayment(e.target.value as OrderRow["payment_status"])}>
                    {Object.entries(PAYMENT_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="create-order-lines">
                <div className="create-order-lines-title">รายการสินค้า</div>
                <div className="create-order-lines-list">
                  {editItems.map((item) => (
                    <div key={item.id} className="create-order-line-row">
                      <select className="create-input" value={item.sku_id} onChange={(e) => updateEditItem(item.id, { sku_id: e.target.value })}>
                        <option value="">เลือกสินค้า</option>
                        {skuOptions.map((sku) => (
                          <option key={sku.id} value={sku.id}>
                            {getSkuDisplayName(sku)}
                          </option>
                        ))}
                      </select>
                      <input className="create-input" type="number" min={1} value={item.quantity} onChange={(e) => updateEditItem(item.id, { quantity: e.target.value })} placeholder="จำนวน" />
                      <input className="create-input" type="number" min={0} value={item.unit_price} onChange={(e) => updateEditItem(item.id, { unit_price: e.target.value })} placeholder="ราคา/หน่วย" />
                      <button className="btn btn-ghost create-line-remove" type="button" onClick={() => removeEditItemRow(item.id)} disabled={editItems.length === 1}>
                        ลบ
                      </button>
                    </div>
                  ))}
                </div>
                <button className="btn btn-ghost create-line-add" type="button" onClick={addEditItemRow}>
                  + เพิ่มรายการสินค้า
                </button>
              </div>

              


              <div className="create-order-summary-grid">
                <div className="create-order-summary">
                  <div className="create-order-summary-row">
                    <span>ประเภทการชำระ</span>
                    <span>{editPaymentTypeLabel}</span>
                  </div>

                  <div className="create-order-summary-row">
                    <span>ยอดที่ชำระแล้ว</span>
                    <div className="create-order-summary-field">
                      <span className="mono">฿</span>
                      <input
                        className="create-input create-summary-input mono"
                        type="number"
                        min={0}
                        value={editPaidAmountInput}
                        onChange={(e) => setEditPaidAmountInput(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="create-order-summary-row">
                    <span>ยอดค้างชำระ</span>
                    <span
                      className="mono"
                      style={{
                        color: editOutstandingAmount > 0 ? "var(--red)" : "var(--green)",
                      }}
                    >
                      ฿{editOutstandingAmount.toLocaleString("th-TH")}
                    </span>
                  </div>
                </div>

                <div className="create-order-summary">
                  <div className="create-order-summary-row">
                    <span>ยอดสินค้า</span>
                    <span className="mono">฿{editSubtotal.toLocaleString("th-TH")}</span>
                  </div>

                  <div className="create-order-summary-row">
                    <span>ค่าจัดส่ง</span>
                    <div className="create-order-summary-field">
                      <span className="mono">฿</span>
                      <input
                        className="create-input create-summary-input mono"
                        type="number"
                        min={0}
                        value={editShippingFee}
                        onChange={(e) => setEditShippingFee(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="create-order-summary-row">
                    <span>ส่วนลดท้ายบิล</span>
                    <div className="create-order-summary-field">
                      <span className="mono">-฿</span>
                      <input
                        className="create-input create-summary-input mono"
                        type="number"
                        min={0}
                        value={editDiscount}
                        onChange={(e) => setEditDiscount(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="create-order-summary-row total">
                    <span>ยอดสุทธิ</span>
                    <span className="mono">฿{editTotal.toLocaleString("th-TH")}</span>
                  </div>
                </div>
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

      {slipModalOpen && selectedSlip && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 760 }}>
            <div className="modal-head">
              <div className="modal-title">สลิปการชำระเงิน {selectedSlip.orderNo}</div>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setSlipModalOpen(false);
                  setSelectedSlip(null);
                }}
              >
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text2)" }}>
                  ทั้งหมด {selectedSlip.urls.length} รูป
                </span>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {selectedSlip.urls.map((url, idx) => (
                  <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt={`slip-${selectedSlip.orderNo}-${idx + 1}`}
                      style={{
                        width: "100%",
                        maxHeight: "70vh",
                        objectFit: "contain",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "var(--bg3)"
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <div className="modal-title">เพิ่มออร์เดอร์</div>
              <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-grid create-order-grid">
                <label>
                  <span className="auth-label">ประเภทลูกค้า</span>
                  <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="radio"
                        name="create-customer-mode"
                        checked={createForm.customer_mode === "select"}
                        onChange={() =>
                          setCreateForm((prev) => ({
                            ...prev,
                            customer_mode: "select",
                            customer_name: "",
                            customer_phone: "",
                            customer_address: ""
                          }))
                        }
                      />
                      <span>เลือกลูกค้าในระบบ</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="radio"
                        name="create-customer-mode"
                        checked={createForm.customer_mode === "manual"}
                        onChange={() =>
                          setCreateForm((prev) => ({
                            ...prev,
                            customer_mode: "manual",
                            customer_id: ""
                          }))
                        }
                      />
                      <span>กรอกข้อมูลลูกค้าเอง</span>
                    </label>
                  </div>
                </label>
                {createForm.customer_mode === "select" ? (
                  <label>
                    <span className="auth-label">ลูกค้า</span>
                    <select
                      className="create-input"
                      value={createForm.customer_id}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, customer_id: e.target.value }))}
                    >
                      <option value="">เลือก</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.display_name ?? customer.full_name ?? customer.email ?? customer.id}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <>
                    <label>
                      <span className="auth-label">ชื่อลูกค้า</span>
                      <input
                        className="create-input"
                        value={createForm.customer_name}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                        placeholder="ชื่อลูกค้า"
                      />
                    </label>
                    <label>
                      <span className="auth-label">เบอร์โทรลูกค้า</span>
                      <input
                        className="create-input"
                        value={createForm.customer_phone}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, customer_phone: e.target.value }))}
                        placeholder="เช่น 08xxxxxxxx"
                      />
                    </label>
                    <label style={{ gridColumn: "1 / -1" }}>
                      <span className="auth-label">ที่อยู่ลูกค้า</span>
                      <textarea
                        className="create-input"
                        rows={2}
                        value={createForm.customer_address}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, customer_address: e.target.value }))}
                        placeholder="ที่อยู่สำหรับนัดหมาย/จัดส่ง"
                        style={{ resize: "vertical" }}
                      />
                    </label>
                  </>
                )}
                <label>
                  <span className="auth-label">เว็บไซต์</span>
                  <select
                    className="create-input"
                    value={createForm.site_id}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, site_id: e.target.value }))}
                  >
                    <option value="">เลือก</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name ?? site.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="auth-label">รูปแบบการชำระ</span>
                  <select
                    className="create-input"
                    value={createForm.payment_option}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        payment_option: e.target.value as "full" | "deposit"
                      }))
                    }
                  >
                    <option value="full">ชำระเต็มจำนวน</option>
                    <option value="deposit">ชำระมัดจำ</option>
                  </select>
                </label>
              </div>

              <div className="create-order-lines">
                <div className="create-order-lines-title">รายการสินค้า</div>
                <div className="create-order-lines-list">
                  {createItems.map((item) => {
                    const matchedSku = skuOptions.find((sku) => sku.id === item.sku_id);
                    const query = createItemSearch[item.id] ?? (matchedSku ? getSkuDisplayName(matchedSku) : "");
                    const normalizedQuery = query.trim().toLowerCase();
                    const suggestions = skuOptions
                      .filter((sku) => {
                        if (!normalizedQuery) return true;
                        return getSkuDisplayName(sku).toLowerCase().includes(normalizedQuery);
                      })
                      .slice(0, 10);
                    const isSearchOpen = activeCreateItemSearchId === item.id;
                    return (
                      <div key={item.id} className="create-order-line-row">
                        <div className="create-sku-autocomplete">
                          <input
                            className="create-input"
                            value={query}
                            onFocus={() => setActiveCreateItemSearchId(item.id)}
                            onBlur={() => {
                              setTimeout(() => setActiveCreateItemSearchId((prev) => (prev === item.id ? null : prev)), 120);
                            }}
                            onChange={(e) => {
                              setCreateItemSearch((prev) => ({ ...prev, [item.id]: e.target.value }));
                              updateCreateItem(item.id, { sku_id: "" });
                              setActiveCreateItemSearchId(item.id);
                            }}
                            placeholder={skuLoading ? "กำลังโหลดสินค้า..." : "ค้นหาสินค้า เช่น Michelin 195/65R15"}
                          />
                          {isSearchOpen && (
                            <div className="create-sku-dropdown">
                              {suggestions.length === 0 ? (
                                <div className="create-sku-option empty">ไม่พบสินค้า</div>
                              ) : (
                                suggestions.map((sku) => (
                                  <button
                                    key={sku.id}
                                    type="button"
                                    className="create-sku-option"
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      const defaultPrice = getDefaultSkuPrice(sku.id);
                                      setCreateItemSearch((prev) => ({ ...prev, [item.id]: getSkuDisplayName(sku) }));
                                      updateCreateItem(item.id, { sku_id: sku.id, unit_price: String(defaultPrice) });
                                      setActiveCreateItemSearchId(null);
                                    }}
                                  >
                                    {getSkuDisplayName(sku)}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                        <input
                          className="create-input"
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateCreateItem(item.id, { quantity: e.target.value })}
                          placeholder="จำนวน"
                        />
                        <input
                          className="create-input"
                          type="number"
                          min={0}
                          value={item.unit_price}
                          onChange={(e) => updateCreateItem(item.id, { unit_price: e.target.value })}
                          placeholder="ราคา/หน่วย"
                        />
                        <button
                          className="btn btn-ghost create-line-remove"
                          type="button"
                          onClick={() => removeCreateItemRow(item.id)}
                          disabled={createItems.length === 1}
                        >
                          ลบ
                        </button>
                        {matchedSku && (
                          <div className="create-line-meta">
                            {(matchedSku.products?.brand ?? "")} {(matchedSku.products?.name ?? "")} {matchedSku.size_label ?? ""} | รหัส: {matchedSku.sku_code ?? "-"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button className="btn btn-ghost create-line-add" type="button" onClick={addCreateItemRow}>
                  + เพิ่มรายการสินค้า
                </button>
              </div>

              <div className="create-order-summary-grid">
                <div className="create-order-summary">
                  <div className="create-order-summary-row">
                    <span>ประเภทการชำระ</span>
                    <span>{createPaymentTypeLabel}</span>
                  </div>
                  <div className="create-order-summary-row">
                    <span>ยอดที่ชำระแล้ว</span>
                    <div className="create-order-summary-field">
                      <span className="mono">฿</span>
                      <input
                        className="create-input create-summary-input mono"
                        type="number"
                        min={0}
                        value={createPaidAmountInput}
                        onChange={(e) => setCreatePaidAmountInput(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="create-order-summary-row">
                    <span>ยอดค้างชำระ</span>
                    <span className="mono" style={{ color: createOutstandingAmount > 0 ? "var(--red)" : "var(--green)" }}>
                      ฿{createOutstandingAmount.toLocaleString("th-TH")}
                    </span>
                  </div>
                </div>

                <div className="create-order-summary">
                  <div className="create-order-summary-row">
                    <span>ยอดสินค้า</span>
                    <span className="mono">฿{createSubtotal.toLocaleString("th-TH")}</span>
                  </div>
                  <div className="create-order-summary-row">
                    <span>ค่าจัดส่ง</span>
                    <div className="create-order-summary-field">
                      <span className="mono">฿</span>
                      <input
                        className="create-input create-summary-input mono"
                        type="number"
                        min={0}
                        value={createForm.shipping_fee}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, shipping_fee: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="create-order-summary-row">
                    <span>ส่วนลดท้ายบิล</span>
                    <div className="create-order-summary-field">
                      <span className="mono">-฿</span>
                      <input
                        className="create-input create-summary-input mono"
                        type="number"
                        min={0}
                        value={createForm.discount}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, discount: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="create-order-summary-row total">
                    <span>ยอดสุทธิ</span>
                    <span className="mono">฿{createTotal.toLocaleString("th-TH")}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
                ยกเลิก
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!hasSupabase || loading}>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {bonusOpen && bonusOrder && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 820 }}>
            <div className="modal-head">
              <div>
                <div className="modal-title">เพิ่มของแถม / เบิกฟรี</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                  ออร์เดอร์: {bonusOrder.order_no}
                </div>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setBonusOpen(false);
                  setBonusOrder(null);
                }}
              >
                ปิด
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  background: "var(--bg3)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12
                }}
              >
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>ลูกค้า</div>
                <div style={{ fontWeight: 600 }}>{bonusOrder.customer_name ?? "-"}</div>
                <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 6 }}>
                  สถานะออร์เดอร์: {STATUS_LABEL[bonusOrder.status]} | ชำระเงิน:{" "}
                  {PAYMENT_LABEL[bonusOrder.payment_status]}
                </div>
              </div>

              <div className="modal-grid" style={{ gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className="auth-label">สินค้าที่เบิก</span>
                  <select
                    className="filter-select"
                    value={bonusSkuId}
                    onChange={(e) => setBonusSkuId(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="">{skuLoading ? "กำลังโหลด..." : "เลือกสินค้า"}</option>
                    {skuOptions.map((sku) => (
                      <option key={sku.id} value={sku.id}>
                        {(sku.products?.brand ?? "")} {(sku.products?.name ?? "")}{" "}
                        {sku.size_label ?? ""} ({sku.sku_code ?? "-"})
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
                    value={bonusQty}
                    onChange={(e) => setBonusQty(e.target.value)}
                    placeholder="เช่น 1"
                  />
                </label>

              </div>

              {selectedBonusSku && (
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
                  {(selectedBonusSku.products?.brand ?? "")}{" "}
                  {(selectedBonusSku.products?.name ?? "")} {selectedBonusSku.size_label ?? ""} (
                  {selectedBonusSku.sku_code ?? "-"})
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <label className="auth-label">เหตุผล</label>
                <textarea
                  className="auth-input"
                  rows={3}
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  placeholder="เช่น ของแถมโปรโมชัน / goodwill ลูกค้า"
                  style={{ width: "100%", resize: "vertical", lineHeight: 1.5 }}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setBonusOpen(false);
                  setBonusOrder(null);
                }}
              >
                ยกเลิก
              </button>
              <button className="btn btn-primary" onClick={submitBonusIssue} disabled={bonusSaving}>
                {bonusSaving ? "กำลังบันทึก..." : "บันทึกรายการเบิก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
