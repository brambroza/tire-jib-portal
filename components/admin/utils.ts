import type { OrderStatus } from "./types";

export function statusLabel(status: OrderStatus) {
  if (status === "pending") return "รอยืนยัน";
  if (status === "process") return "กำลังจัดส่ง";
  if (status === "paid") return "ชำระแล้ว";
  return "ยกเลิก";
}

export function statusClass(status: OrderStatus) {
  if (status === "pending") return "badge pending";
  if (status === "process") return "badge process";
  if (status === "paid") return "badge paid";
  return "badge cancel";
}
