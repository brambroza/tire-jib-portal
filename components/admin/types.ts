export type PageId =
  | "dashboard"
  | "tire-catalog"
  | "car-catalog"
  | "sites"
  | "shipping-rates"
  | "extra-fee-configs"
  | "hero-content"
  | "customer-notifications"
  | "stock"
  | "pricing"
  | "sales-summary"
  | "orders"
  | "install"
  | "install-checklist"
  | "field-install"
  | "technicians"
  | "promotions"
  | "tax-invoice-requests"
  | "members"
  | "line-chat"
  | "line-search-test"
  | "line-reply-settings"
  | "users";

export type OrderStatus = "pending" | "process" | "paid" | "cancel";

export type Order = {
  id: string;
  customer: string;
  group: string;
  site: "s1" | "s2" | "s3";
  product: string;
  total: string;
  status: OrderStatus;
  dateLabel: string;
  confirmable?: boolean;
};

export const pageTitles: Record<PageId, string> = {
  dashboard: "Dashboard",
  "tire-catalog": "จัดการยี่ห้อ/ลายยาง",
  "car-catalog": "จัดการยี่ห้อ/รุ่น/ปีรถ",
  sites: "จัดการเว็บไซต์",
  "shipping-rates": "จัดการค่าจัดส่งจังหวัด",
  "extra-fee-configs": "จัดการ ค่าบริการเพิ่ม",
  "hero-content": "จัดการ Hero Section/Ads",
  "customer-notifications": "แจ้งเตือนลูกค้า",
  stock: "จัดการยาง",
  pricing: "ปรับปรุงยอดคงคลัง",
  "sales-summary": "สรุปยอดขาย",
  orders: "คำสั่งซื้อ",
  install: "นัดติดตั้ง",
  "install-checklist": "จัดการ Checklist ติดตั้ง",
  "field-install": "งานติดตั้ง",
  technicians: "ทีมช่าง",
  promotions: "โปรโมชัน",
  "tax-invoice-requests": "รายการขอใบกำกับภาษี",
  members: "สมาชิก & ดีลเลอร์",
  "line-chat": "แชทลูกค้า LINE",
  "line-search-test": "ทดสอบค้นหา LINE",
  "line-reply-settings": "ตั้งค่าปุ่มข้อความ LINE",
  users: "จัดการผู้ใช้งาน"
};
