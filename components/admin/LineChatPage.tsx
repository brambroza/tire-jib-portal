"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import ActionFeedback from "../ui/ActionFeedback";

type ConversationRow = {
  line_user_id: string;
  latest_message_text: string | null;
  latest_message_type: string | null;
  latest_message_at: string | null;
  unread_count: number;
  customer_id: string | null;
  customer_display_name: string | null;
  customer_profile_image_url: string | null;
  customer_full_name: string | null;
  customer_phone: string | null;
  customer_is_friend: boolean | null;
};

type ChatMessageRow = {
  id: string;
  direction: "in" | "out";
  message_type: string | null;
  message: string | null;
  created_at: string;
  status: string | null;
};

type LineProfile = {
  displayName: string;
  pictureUrl: string;
  statusMessage?: string;
};

type StickerPreset = {
  emoji: string;
  label: string;
  packageId: string;
  stickerId: string;
};

type ParsedMessage = {
  kind: "text" | "sticker" | "image" | "video" | "audio" | "file" | "flex" | "other";
  text: string;
  url?: string;
  stickerUrl?: string;
};

const STICKER_PRESETS: StickerPreset[] = [
  { emoji: "😀", label: "Happy", packageId: "11537", stickerId: "52002734" },
  { emoji: "😍", label: "Love", packageId: "11537", stickerId: "52002735" },
  { emoji: "🙏", label: "Thanks", packageId: "11537", stickerId: "52002736" },
  { emoji: "👍", label: "OK", packageId: "11537", stickerId: "52002737" },
  { emoji: "🎉", label: "Congrats", packageId: "11537", stickerId: "52002739" },
  { emoji: "😅", label: "Sorry", packageId: "11537", stickerId: "52002740" }
];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function formatDateSep(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatConvTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);

  if (isToday) return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  if (isYesterday) return "เมื่อวาน";
  if (diffDays < 7) return d.toLocaleDateString("th-TH", { weekday: "short" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function avatarInitial(label: string): string {
  const t = label.trim();
  return t ? t.slice(0, 1).toUpperCase() : "?";
}

function parseMessageForDisplay(row: ChatMessageRow): ParsedMessage {
  const raw = row.message ?? "";
  const messageType = row.message_type ?? "";
  const urlMatch = raw.match(/https?:\/\/[^\s"]+/);
  const url = urlMatch?.[0];

  // sticker — extract LINE CDN URL from stored "[sticker packageId/stickerId]"
  if (messageType === "sticker" || raw.startsWith("[sticker")) {
    const m = raw.match(/\[sticker\s+\d+\/(\d+)\]/);
    const stickerId = m?.[1];
    const stickerUrl = stickerId
      ? `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/iPhone/sticker@2x.png`
      : undefined;
    return { kind: "sticker", text: "สติ๊กเกอร์", stickerUrl };
  }

  // flex message (system notification)
  if (messageType === "flex" || raw.startsWith("[flex]")) {
    const label = raw.replace(/^\[flex\]\s*/, "") || "Flex Message";
    return { kind: "flex", text: label };
  }

  if (messageType === "image") return { kind: "image", text: "รูปภาพ", url };
  if (messageType === "video") return { kind: "video", text: "วิดีโอ", url };
  if (messageType === "audio") return { kind: "audio", text: "ไฟล์เสียง", url };
  if (raw.startsWith("ไฟล์แนบ:")) {
    const fileName = raw.replace("ไฟล์แนบ:", "").trim();
    return { kind: "file", text: fileName, url: url ?? fileName };
  }
  if (!raw && messageType) return { kind: "other", text: `[${messageType}]` };
  return { kind: "text", text: raw };
}

function Avatar({
  src,
  name,
  size = 42
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#c8e6d0",
        display: "grid",
        placeItems: "center",
        fontWeight: 700,
        color: "#1a7f3c",
        fontSize: size * 0.4,
        flexShrink: 0
      }}
    >
      {avatarInitial(name)}
    </div>
  );
}

function BubbleContent({ msg, isOut }: { msg: ParsedMessage; isOut: boolean }) {
  const bubbleStyle: CSSProperties = {
    maxWidth: 300,
    borderRadius: isOut ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
    background: isOut ? "#06c755" : "#fff",
    color: isOut ? "#fff" : "#111",
    fontSize: 14,
    lineHeight: 1.55,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
    overflow: "hidden"
  };

  // sticker — แสดงรูปจาก LINE CDN (ไม่มี background bubble)
  if (msg.kind === "sticker") {
    return msg.stickerUrl ? (
      <img
        src={msg.stickerUrl}
        alt="sticker"
        style={{ width: 100, height: 100, objectFit: "contain", display: "block" }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    ) : (
      <div style={{ ...bubbleStyle, padding: "9px 13px" }}>🎭 สติ๊กเกอร์</div>
    );
  }

  // flex (system notification)
  if (msg.kind === "flex") {
    return (
      <div style={{ ...bubbleStyle, padding: "9px 13px", fontStyle: "italic", opacity: 0.9 }}>
        📋 {msg.text}
      </div>
    );
  }

  // image — inline preview + คลิกเปิดเต็ม
  if (msg.kind === "image") {
    return msg.url ? (
      <a href={msg.url} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: isOut ? "18px 18px 4px 18px" : "18px 18px 18px 4px", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}>
        <img
          src={msg.url}
          alt="รูปภาพ"
          style={{ display: "block", maxWidth: 260, maxHeight: 220, objectFit: "cover" }}
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = "none";
            el.insertAdjacentHTML("afterend", '<div style="padding:10px;font-size:13px">🖼 ดูรูปภาพ</div>');
          }}
        />
      </a>
    ) : (
      <div style={{ ...bubbleStyle, padding: "9px 13px" }}>🖼 รูปภาพ</div>
    );
  }

  // video
  if (msg.kind === "video") {
    return msg.url ? (
      <div style={{ borderRadius: isOut ? "18px 18px 4px 18px" : "18px 18px 18px 4px", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.08)", background: "#000", maxWidth: 280 }}>
        <video
          controls
          style={{ display: "block", maxWidth: 280, maxHeight: 200 }}
        >
          <source src={msg.url} />
          <a href={msg.url} target="_blank" rel="noreferrer" style={{ color: "#fff", padding: 8, display: "block" }}>▶ เปิดวิดีโอ</a>
        </video>
      </div>
    ) : (
      <div style={{ ...bubbleStyle, padding: "9px 13px" }}>🎬 วิดีโอ</div>
    );
  }

  // audio
  if (msg.kind === "audio") {
    return msg.url ? (
      <div style={{ ...bubbleStyle, padding: "10px 12px", background: isOut ? "#06c755" : "#fff" }}>
        <audio controls style={{ width: 220, height: 36, display: "block" }}>
          <source src={msg.url} />
        </audio>
      </div>
    ) : (
      <div style={{ ...bubbleStyle, padding: "9px 13px" }}>🔊 ไฟล์เสียง</div>
    );
  }

  // file download
  if (msg.kind === "file") {
    const fileName = msg.text.split("/").pop() ?? msg.text;
    return msg.url ? (
      <a
        href={msg.url}
        target="_blank"
        rel="noreferrer"
        style={{ ...bubbleStyle, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
      >
        <span style={{ fontSize: 28, flexShrink: 0 }}>📄</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
            {fileName}
          </div>
          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>คลิกเพื่อดาวน์โหลด</div>
        </div>
      </a>
    ) : (
      <div style={{ ...bubbleStyle, padding: "9px 13px" }}>📄 {msg.text}</div>
    );
  }

  // text / other
  return (
    <div style={{ ...bubbleStyle, padding: "9px 13px" }}>
      {msg.text || `[${msg.kind}]`}
    </div>
  );
}

export default function LineChatPage() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedLineUserId, setSelectedLineUserId] = useState("");
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, LineProfile>>({});

  const [replyMessage, setReplyMessage] = useState("");
  const [composeType, setComposeType] = useState<"text" | "sticker" | "media">("text");
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [stickerPackageId, setStickerPackageId] = useState("11537");
  const [stickerId, setStickerId] = useState("52002734");
  const [mediaKind, setMediaKind] = useState<"image" | "video" | "audio" | "filelink">("image");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
  const [mediaDurationMs, setMediaDurationMs] = useState("3000");
  const [attachedFileName, setAttachedFileName] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConversation = useMemo(
    () => conversations.find((r) => r.line_user_id === selectedLineUserId) ?? null,
    [conversations, selectedLineUserId]
  );

  function getDisplayName(lineUserId: string, conv?: ConversationRow | null): string {
    return (
      profiles[lineUserId]?.displayName ||
      conv?.customer_display_name ||
      conv?.customer_full_name ||
      "ไม่ระบุชื่อ"
    );
  }

  function getProfilePic(lineUserId: string, conv?: ConversationRow | null): string | null {
    return profiles[lineUserId]?.pictureUrl ?? conv?.customer_profile_image_url ?? null;
  }

  const filteredConversations = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return conversations;
    return conversations.filter((r) =>
      [
        r.line_user_id,
        r.customer_display_name,
        r.customer_full_name,
        r.customer_phone,
        r.latest_message_text,
        profiles[r.line_user_id]?.displayName
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(kw)
    );
  }, [conversations, search, profiles]);

  async function fetchProfile(lineUserId: string) {
    if (profiles[lineUserId]) return;
    try {
      const res = await fetch(`/api/line/profile/${encodeURIComponent(lineUserId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as LineProfile;
      setProfiles((prev) => ({ ...prev, [lineUserId]: data }));
    } catch {
      // ignore
    }
  }

  async function loadConversations() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/line/conversations");
      const payload = (await res.json()) as { conversations?: ConversationRow[]; error?: string };
      if (!res.ok) throw new Error(payload.error || "โหลดรายการแชทไม่สำเร็จ");
      const rows = payload.conversations ?? [];
      setConversations(rows);
      // fetch profiles for users without stored profile pic
      rows.filter((r) => !r.customer_profile_image_url).forEach((r) => void fetchProfile(r.line_user_id));
      if (!selectedLineUserId && rows[0]?.line_user_id) {
        setSelectedLineUserId(rows[0].line_user_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดรายการแชทไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(lineUserId: string) {
    if (!lineUserId) { setMessages([]); return; }
    setError(null);
    try {
      const res = await fetch(`/api/line/conversations/${encodeURIComponent(lineUserId)}/messages`);
      const payload = (await res.json()) as { messages?: ChatMessageRow[]; error?: string };
      if (!res.ok) throw new Error(payload.error || "โหลดข้อความไม่สำเร็จ");
      setMessages(payload.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อความไม่สำเร็จ");
    }
  }

  async function handleSend() {
    const to = selectedLineUserId.trim();
    if (!to) { setError("กรุณาเลือกห้องแชทก่อน"); return; }
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      let body: Record<string, unknown>;
      if (composeType === "text") {
        const msg = replyMessage.trim();
        if (!msg) throw new Error("กรุณากรอกข้อความ");
        body = { to, type: "user", message: msg };
      } else if (composeType === "sticker") {
        if (!stickerPackageId.trim() || !stickerId.trim()) throw new Error("กรุณาระบุ packageId และ stickerId");
        body = { to, type: "user", messages: [{ type: "sticker", packageId: stickerPackageId.trim(), stickerId: stickerId.trim() }] };
      } else {
        const url = mediaUrl.trim();
        if (!url) throw new Error("กรุณาระบุ URL ไฟล์");
        if (mediaKind === "filelink") {
          body = { to, type: "user", message: `ไฟล์แนบ: ${url}` };
        } else if (mediaKind === "audio") {
          body = { to, type: "user", messages: [{ type: "audio", originalContentUrl: url, duration: Number(mediaDurationMs) || 3000 }] };
        } else {
          body = { to, type: "user", messages: [{ type: mediaKind, originalContentUrl: url, previewImageUrl: mediaPreviewUrl.trim() || url }] };
        }
      }

      const res = await fetch("/api/line/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const resData = (await res.json().catch(() => ({}))) as { error?: string };

      // 207 = ส่ง LINE สำเร็จ แต่ DB บันทึกไม่ได้ (ยังถือว่าส่งได้)
      if (!res.ok && res.status !== 207) throw new Error(resData.error || "ส่งข้อความไม่สำเร็จ");

      setReplyMessage("");
      setComposeType("text");
      if (composeType === "media") { setMediaUrl(""); setMediaPreviewUrl(""); setAttachedFileName(""); }
      setSuccess(res.status === 207 ? `⚠ ${resData.error ?? "ส่งสำเร็จ แต่บันทึกประวัติไม่ได้"}` : "ส่งข้อความเรียบร้อย");
      await loadMessages(to);
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/line/upload", { method: "POST", body: formData });
      const payload = (await res.json()) as { url?: string; fileName?: string; contentType?: string; error?: string };
      if (!res.ok || !payload.url) throw new Error(payload.error || "อัปโหลดไฟล์ไม่สำเร็จ");
      setMediaUrl(payload.url);
      setAttachedFileName(payload.fileName || file.name);
      const ct = payload.contentType || "";
      if (ct.startsWith("image/")) { setMediaKind("image"); setMediaPreviewUrl(payload.url); }
      else if (ct.startsWith("video/")) { setMediaKind("video"); setMediaPreviewUrl(payload.url); }
      else if (ct.startsWith("audio/")) { setMediaKind("audio"); }
      else { setMediaKind("filelink"); }
      setSuccess("อัปโหลดไฟล์เรียบร้อย");
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไฟล์ไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => { void loadConversations(); }, []);

  useEffect(() => {
    if (!selectedLineUserId) return;
    void loadMessages(selectedLineUserId);
    void fetchProfile(selectedLineUserId);
  }, [selectedLineUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selName = getDisplayName(selectedLineUserId, selectedConversation);
  const selPic = getProfilePic(selectedLineUserId, selectedConversation);

  return (
    <div className="page active">
      {/* Toolbar */}
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="search-bar" style={{ width: 280 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา LINE ID / ชื่อลูกค้า"
          />
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={() => void loadConversations()} disabled={loading}>
          {loading ? "กำลังโหลด..." : "รีเฟรช"}
        </button>
      </div>

      <ActionFeedback
        error={error}
        success={success}
        onClearError={() => setError(null)}
        onClearSuccess={() => setSuccess(null)}
      />

      {/* Main chat layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          height: "calc(100vh - 200px)",
          minHeight: 500,
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          overflow: "hidden"
        }}
      >
        {/* ===== LEFT: Conversation list ===== */}
        <div style={{ background: "#fff", display: "flex", flexDirection: "column", borderRight: "1px solid #e5e7eb", overflow: "hidden", minHeight: 0 }}>
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid #f3f4f6",
              fontWeight: 700,
              fontSize: 15,
              color: "#111",
              background: "#fff"
            }}
          >
            แชท ({filteredConversations.length})
          </div>

          <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
            {filteredConversations.map((row) => {
              const isActive = row.line_user_id === selectedLineUserId;
              const name = getDisplayName(row.line_user_id, row);
              const pic = getProfilePic(row.line_user_id, row);
              const timeStr = formatConvTime(row.latest_message_at);

              return (
                <button
                  key={row.line_user_id}
                  type="button"
                  onClick={() => setSelectedLineUserId(row.line_user_id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderBottom: "1px solid #f3f4f6",
                    background: isActive ? "#e8f7ef" : "transparent",
                    color: "inherit",
                    padding: "10px 14px",
                    cursor: "pointer",
                    display: "flex",
                    gap: 10,
                    alignItems: "center"
                  }}
                >
                  <Avatar src={pic} name={name} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: "#111",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {name}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{timeStr}</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flex: 1
                        }}
                      >
                        {row.latest_message_text || (row.latest_message_type ? `[${row.latest_message_type}]` : "-")}
                      </div>
                      {row.unread_count > 0 && (
                        <div
                          style={{
                            background: "#06c755",
                            color: "#fff",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            minWidth: 20,
                            height: 20,
                            display: "grid",
                            placeItems: "center",
                            paddingInline: 5,
                            marginLeft: 6,
                            flexShrink: 0
                          }}
                        >
                          {row.unread_count}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredConversations.length === 0 && (
              <div style={{ padding: 24, color: "#9ca3af", textAlign: "center", fontSize: 14 }}>
                ยังไม่พบบทสนทนา
              </div>
            )}
          </div>
        </div>

        {/* ===== RIGHT: Chat window ===== */}
        <div style={{ display: "flex", flexDirection: "column", background: "#f0f0f0", overflow: "hidden", minHeight: 0 }}>
          {/* Chat header */}
          <div
            style={{
              padding: "10px 16px",
              background: "#fff",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              gap: 10
            }}
          >
            <Avatar src={selPic} name={selName} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>
                {selectedConversation ? selName : "เลือกห้องแชท"}
              </div>
              {selectedConversation?.customer_phone && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>
                  {selectedConversation.customer_phone}
                </div>
              )}
            </div>
          </div>

          {/* Messages area */}
          <div
            className="scrollbar-thin"
            style={{ flex: 1, overflow: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", minHeight: 0 }}
          >
            {messages.map((row, idx) => {
              const isOut = row.direction === "out";
              const prev = messages[idx - 1];
              const showDate = !prev || !isSameDay(prev.created_at, row.created_at);
              const displayMessage = parseMessageForDisplay(row);

              return (
                <div key={row.id}>
                  {showDate && (
                    <div
                      style={{
                        textAlign: "center",
                        margin: "14px 0 10px",
                        fontSize: 12,
                        color: "#9ca3af",
                        display: "flex",
                        alignItems: "center",
                        gap: 8
                      }}
                    >
                      <div style={{ flex: 1, height: 1, background: "#d1d5db" }} />
                      {formatDateSep(row.created_at)}
                      <div style={{ flex: 1, height: 1, background: "#d1d5db" }} />
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: isOut ? "row-reverse" : "row",
                      alignItems: "flex-end",
                      gap: 6,
                      marginBottom: 6
                    }}
                  >
                    {/* Avatar for incoming */}
                    {!isOut && <Avatar src={selPic} name={selName} size={32} />}

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isOut ? "flex-end" : "flex-start",
                        gap: 3
                      }}
                    >
                      {/* Bubble */}
                      <BubbleContent msg={displayMessage} isOut={isOut} />

                      {/* Timestamp + status */}
                      <div
                        style={{
                          fontSize: 11,
                          color: "#9ca3af",
                          display: "flex",
                          gap: 4,
                          alignItems: "center"
                        }}
                      >
                        {isOut && row.status === "read" && (
                          <span style={{ color: "#06c755" }}>อ่านแล้ว</span>
                        )}
                        {formatTime(row.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {messages.length === 0 && selectedConversation && (
              <div style={{ color: "#9ca3af", textAlign: "center", marginTop: 60, fontSize: 14 }}>
                ยังไม่มีข้อความ
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", padding: "8px 12px", flexShrink: 0 }}>
            {/* Sticker panel */}
            {showStickerPanel && (
              <div
                style={{
                  marginBottom: 8,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#fafafa",
                  padding: 10
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                  {STICKER_PRESETS.map((s) => (
                    <button
                      key={`${s.packageId}-${s.stickerId}`}
                      type="button"
                      title={s.label}
                      onClick={() => {
                        setStickerPackageId(s.packageId);
                        setStickerId(s.stickerId);
                        setComposeType("sticker");
                        setShowStickerPanel(false);
                      }}
                      style={{
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        padding: "8px 0",
                        fontSize: 24,
                        background: "#fff",
                        cursor: "pointer"
                      }}
                    >
                      {s.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Media compose area */}
            {composeType === "media" && (
              <div style={{ marginBottom: 8, display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    className="filter-select"
                    value={mediaKind}
                    onChange={(e) => setMediaKind(e.target.value as "image" | "video" | "audio" | "filelink")}
                  >
                    <option value="image">image</option>
                    <option value="video">video</option>
                    <option value="audio">audio</option>
                    <option value="filelink">file-link (text)</option>
                  </select>
                  {attachedFileName && (
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: "#374151", alignSelf: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {attachedFileName}
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setComposeType("text");
                      setMediaUrl("");
                      setMediaPreviewUrl("");
                      setAttachedFileName("");
                    }}
                  >
                    ยกเลิกไฟล์
                  </button>
                </div>
                <input
                  className="auth-input"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://... URL ไฟล์สาธารณะ"
                />
                {(mediaKind === "image" || mediaKind === "video") && (
                  <input
                    className="auth-input"
                    value={mediaPreviewUrl}
                    onChange={(e) => setMediaPreviewUrl(e.target.value)}
                    placeholder="previewImageUrl (ว่างได้ จะใช้ URL เดิม)"
                  />
                )}
                {mediaKind === "audio" && (
                  <input
                    className="auth-input"
                    type="number"
                    value={mediaDurationMs}
                    onChange={(e) => setMediaDurationMs(e.target.value)}
                    placeholder="duration (ms)"
                  />
                )}
              </div>
            )}

            {composeType === "sticker" && (
              <div
                style={{
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "8px 10px",
                  background: "#f9fafb"
                }}
              >
                <div style={{ fontSize: 13, color: "#374151" }}>
                  พร้อมส่งสติ๊กเกอร์ packageId {stickerPackageId}, stickerId {stickerId}
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => setComposeType("text")}>
                  ยกเลิก
                </button>
              </div>
            )}

            {/* Compose bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Attach */}
              <label
                title="แนบไฟล์"
                style={{
                  cursor: uploading ? "not-allowed" : "pointer",
                  fontSize: 22,
                  opacity: uploading ? 0.4 : 1,
                  padding: "4px 6px",
                  lineHeight: 1
                }}
              >
                📎
                <input
                  type="file"
                  style={{ display: "none" }}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setComposeType("media");
                    void handleUpload(file);
                  }}
                />
              </label>

              {/* Sticker toggle */}
              <button
                type="button"
                title="สติกเกอร์"
                onClick={() => {
                  setComposeType("sticker");
                  setShowStickerPanel((v) => !v);
                }}
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "4px 6px",
                  fontSize: 22,
                  background: showStickerPanel ? "#e8f7ef" : "transparent",
                  cursor: "pointer",
                  lineHeight: 1
                }}
              >
                😊
              </button>

              {/* Text input */}
              <input
                value={replyMessage}
                onChange={(e) => { setReplyMessage(e.target.value); setComposeType("text"); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !sending && !uploading) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={uploading ? "กำลังอัปโหลด..." : "พิมพ์ข้อความ..."}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 20,
                  border: "1px solid #e5e7eb",
                  padding: "0 16px",
                  fontSize: 14,
                  background: "#f9fafb",
                  outline: "none"
                }}
              />

              {/* Send button */}
              <button
                type="button"
                disabled={!selectedLineUserId || sending || uploading}
                onClick={() => void handleSend()}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: "none",
                  background: !selectedLineUserId || sending || uploading ? "#d1d5db" : "#06c755",
                  color: "#fff",
                  cursor: !selectedLineUserId || sending || uploading ? "not-allowed" : "pointer",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 16,
                  flexShrink: 0,
                  transition: "background 0.15s"
                }}
              >
                {sending ? "·" : "▶"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
