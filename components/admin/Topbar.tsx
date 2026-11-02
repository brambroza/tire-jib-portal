"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PageId } from "./types";
import { pageTitles } from "./types";
import ThemeToggle from "../ThemeToggle";
import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";

type TopbarProps = {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  onToggleSidebar: () => void;
};

type CartNotification = {
  id: string;
  created_at: string | null;
  status: string | null;
  read: boolean;
};

type TaxInvoiceNotification = {
  id: string;
  status: "pending" | "processing" | "approved" | "rejected" | "cancelled";
  created_at: string | null;
  updated_at: string | null;
  order_no: string | null;
};

type ReadRow = { cart_id: string };

function playNotificationSound() {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(960, audioContext.currentTime);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.1, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.2);
  void audioContext.close();
}

export default function Topbar({ activePage, onNavigate, onToggleSidebar }: TopbarProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<CartNotification[]>([]);
  const [taxNotifications, setTaxNotifications] = useState<TaxInvoiceNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);
  const notifWrapRef = useRef<HTMLDivElement | null>(null);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );
  const taxUnreadCount = useMemo(
    () =>
      taxNotifications.filter(
        (item) => item.status === "pending" || item.status === "processing"
      ).length,
    [taxNotifications]
  );
  const bellCount = unreadCount + taxUnreadCount;

  function pushNotificationOnce(row: { id: string; created_at?: string | null; status?: string | null }) {
    if (notifiedIdsRef.current.has(row.id)) return;

    notifiedIdsRef.current.add(row.id);
    setNotifications((prev) => {
      if (prev.some((item) => item.id === row.id)) return prev;
      const next: CartNotification = {
        id: row.id,
        created_at: row.created_at ?? null,
        status: row.status ?? null,
        read: false
      };
      return [next, ...prev].slice(0, 50);
    });

    playNotificationSound();
    setNotificationToast(`มีรายการ Checkout ใหม่ รอยืนยัน (Cart: ${row.id.slice(0, 8)})`);
  }

  async function loadWaitingConfirmNotifications(currentUserId: string | null) {
    if (!supabase || !currentUserId) return;
    setLoadingNotifications(true);
    const { data, error } = await supabase
      .from("carts")
      .select("id,created_at,status")
      .eq("status", "waitingconfirm")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error) {
      const rows = (data ?? []) as { id: string; created_at: string | null; status: string | null }[];
      const cartIds = rows.map((row) => row.id);
      let readSet = new Set<string>();
      if (cartIds.length > 0) {
        const { data: readData, error: readError } = await supabase
          .from("cart_notification_reads")
          .select("cart_id")
          .eq("user_id", currentUserId)
          .in("cart_id", cartIds);
        if (!readError) {
          readSet = new Set(((readData ?? []) as ReadRow[]).map((row) => row.cart_id));
        }
      }
      setNotifications(
        rows.map((row) => ({
          id: row.id,
          created_at: row.created_at,
          status: row.status,
          read: readSet.has(row.id)
        }))
      );
      rows.forEach((row) => notifiedIdsRef.current.add(row.id));
    }
    setLoadingNotifications(false);
  }

  async function loadTaxInvoiceNotifications() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("tax_invoice_requests")
      .select("id,status,created_at,updated_at,orders(order_no)")
      .in("status", ["pending", "processing"])
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) return;
    const mapped = ((data ?? []) as Array<{
      id: string;
      status: TaxInvoiceNotification["status"];
      created_at: string | null;
      updated_at: string | null;
      orders?: { order_no: string | null } | { order_no: string | null }[] | null;
    }>).map((row) => {
      const orderRef = Array.isArray(row.orders) ? row.orders[0] : row.orders;
      return {
        id: row.id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        order_no: orderRef?.order_no ?? null
      };
    });
    setTaxNotifications(mapped);
  }

  function removeNotification(id: string) {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }

  async function markNotificationAsRead(cartId: string) {
    if (!supabase || !userId) return;
    await supabase.from("cart_notification_reads").upsert(
      {
        user_id: userId,
        cart_id: cartId,
        read_at: new Date().toISOString()
      },
      { onConflict: "user_id,cart_id" }
    );
    setNotifications((prev) =>
      prev.map((row) => (row.id === cartId ? { ...row, read: true } : row))
    );
  }

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    let mounted = true;
    async function init() {
      const { data } = await client.auth.getUser();
      const nextUserId = data.user?.id ?? null;
      if (!mounted || !nextUserId) return;
      setUserId(nextUserId);
      await Promise.all([
        loadWaitingConfirmNotifications(nextUserId),
        loadTaxInvoiceNotifications()
      ]);
    }
    void init();

    const channel = client
      .channel("carts-waitingconfirm-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "carts",
          filter: "status=eq.waitingconfirm"
        },
        (payload) => {
          const next = payload.new as { id?: string; created_at?: string | null; status?: string | null };
          if (!next.id) return;
          pushNotificationOnce({ id: next.id, created_at: next.created_at ?? null, status: next.status ?? null });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "carts"
        },
        (payload) => {
          const next = payload.new as { id?: string; created_at?: string | null; status?: string | null };
          const prev = payload.old as { status?: string | null };
          if (!next.id) return;
          if (next.status === "waitingconfirm" && prev.status !== "waitingconfirm") {
            pushNotificationOnce({
              id: next.id,
              created_at: next.created_at ?? null,
              status: next.status ?? null
            });
            return;
          }
          if (next.status && next.status !== "waitingconfirm") {
            removeNotification(next.id);
          }
        }
      )
      .subscribe();

    const taxChannel = client
      .channel("tax-invoice-request-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tax_invoice_requests"
        },
        () => {
          void loadTaxInvoiceNotifications();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void client.removeChannel(channel);
      void client.removeChannel(taxChannel);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!notifWrapRef.current) return;
      if (!notifWrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function formatCreatedAt(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return (
    <div className="topbar">
      <button className="menu-btn" onClick={onToggleSidebar} aria-label="Show menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div className="page-title">{pageTitles[activePage]}</div>
      <div className="topbar-sep" />
      <div className="search-bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input placeholder="ค้นหายาง, ออร์เดอร์, ลูกค้า…" />
      </div>
      <div className="notif-wrap" ref={notifWrapRef}>
        <button
          className="notif-btn"
          aria-label="Notifications"
          onClick={() => {
            setOpen((prev) => !prev);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {bellCount > 0 ? <span className="notif-count">{bellCount}</span> : null}
        </button>
        {open ? (
          <div className="notif-panel">
            <div className="notif-panel-head">
              <span>รายการแจ้งเตือน</span>
              <button
                className="notif-link"
                onClick={() => {
                  onNavigate("orders");
                  setOpen(false);
                }}
              >
                ไปหน้าคำสั่งซื้อ
              </button>
            </div>
            <div className="notif-list">
              {loadingNotifications ? <div className="notif-empty">กำลังโหลด...</div> : null}
              {!loadingNotifications && notifications.length === 0 && taxNotifications.length === 0 ? (
                <div className="notif-empty">ยังไม่มีรายการแจ้งเตือน</div>
              ) : null}
              {taxNotifications.map((item) => (
                <button
                  key={`tax-${item.id}`}
                  className="notif-item"
                  onClick={() => {
                    onNavigate("tax-invoice-requests");
                    setOpen(false);
                  }}
                >
                  <div className="notif-item-title">คำขอใบกำกับภาษี {item.status === "pending" ? "รอดำเนินการ" : "กำลังดำเนินการ"}</div>
                  <div className="notif-item-sub">
                    {item.order_no ? `Order: ${item.order_no}` : `Request: ${item.id.slice(0, 8)}`}
                  </div>
                  <div className="notif-item-time">{formatCreatedAt(item.updated_at ?? item.created_at)}</div>
                </button>
              ))}
              {!loadingNotifications
                ? notifications.map((item) => (
                    <button
                      key={item.id}
                      className={`notif-item ${item.read ? "read" : ""}`}
                      onClick={async () => {
                        if (!item.read) await markNotificationAsRead(item.id);
                        onNavigate("orders");
                        setOpen(false);
                      }}
                    >
                      <div className="notif-item-title">Checkout ใหม่ รอยืนยัน</div>
                      <div className="notif-item-sub">Cart: {item.id.slice(0, 8)}</div>
                      <div className="notif-item-time">{formatCreatedAt(item.created_at)}</div>
                    </button>
                  ))
                : null}
            </div>
          </div>
        ) : null}
      </div>
      <ThemeToggle />
      <ActionFeedback success={notificationToast} onClearSuccess={() => setNotificationToast(null)} />

    </div>
  );
}
 
