import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabaseAdmin";

type LineSendMessage =
  | { type: "text"; text: string }
  | { type: "sticker"; packageId: string; stickerId: string }
  | { type: "image"; originalContentUrl: string; previewImageUrl: string }
  | { type: "video"; originalContentUrl: string; previewImageUrl: string }
  | { type: "audio"; originalContentUrl: string; duration: number }
  | { type: "flex"; altText: string; contents: Record<string, unknown> };

function isHttpsUrl(value: string) {
  return /^https:\/\//i.test(value);
}

function isLinePushTarget(value: string) {
  return /^[UCR][0-9a-f]{32}$/i.test(value);
}

function normalizeMessages(input: unknown, fallbackText?: string): LineSendMessage[] {
  if (Array.isArray(input) && input.length > 0) {
    return input
      .map((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const row = raw as Record<string, unknown>;
        const type = String(row.type ?? "");
        if (type === "text") {
          const text = String(row.text ?? "").trim();
          return text ? ({ type: "text", text } as LineSendMessage) : null;
        }
        if (type === "sticker") {
          const packageId = String(row.packageId ?? "").trim();
          const stickerId = String(row.stickerId ?? "").trim();
          return packageId && stickerId ? ({ type: "sticker", packageId, stickerId } as LineSendMessage) : null;
        }
        if (type === "image" || type === "video") {
          const originalContentUrl = String(row.originalContentUrl ?? "").trim();
          const previewImageUrl = String(row.previewImageUrl ?? "").trim();
          if (!isHttpsUrl(originalContentUrl) || !isHttpsUrl(previewImageUrl)) return null;
          return { type, originalContentUrl, previewImageUrl } as LineSendMessage;
        }
        if (type === "audio") {
          const originalContentUrl = String(row.originalContentUrl ?? "").trim();
          const duration = Number(row.duration ?? 0);
          if (!isHttpsUrl(originalContentUrl) || !Number.isFinite(duration) || duration <= 0) return null;
          return { type: "audio", originalContentUrl, duration } as LineSendMessage;
        }
        if (type === "flex") {
          const altText = String(row.altText ?? "").trim();
          const contents =
            row.contents && typeof row.contents === "object"
              ? (row.contents as Record<string, unknown>)
              : null;
          if (!altText || !contents) return null;
          return { type: "flex", altText, contents } as LineSendMessage;
        }
        return null;
      })
      .filter(Boolean) as LineSendMessage[];
  }

  const text = String(fallbackText ?? "").trim();
  return text ? [{ type: "text", text }] : [];
}

function getMessageLogText(message: LineSendMessage) {
  if (message.type === "text") return message.text;
  if (message.type === "sticker") return `[sticker ${message.packageId}/${message.stickerId}]`;
  if (message.type === "audio") return `[audio] ${message.originalContentUrl}`;
  if (message.type === "flex") return `[flex] ${message.altText}`;
  if (message.type === "image") return `[image] ${message.originalContentUrl}`;
  if (message.type === "video") return `[video] ${message.originalContentUrl}`;
  return "[unknown]";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, message, type, messages } = body as {
      to?: string;
      message?: string;
      type?: string;
      messages?: unknown;
    };
    const normalizedMessages = normalizeMessages(messages, message);

    if (!to || normalizedMessages.length === 0) {
      return NextResponse.json({ error: "Missing to or messages" }, { status: 400 });
    }

    if (!isLinePushTarget(to.trim())) {
      return NextResponse.json(
        { error: "LINE target ไม่ถูกต้อง ต้องใช้ LINE Msg User ID / groupId / roomId ที่ได้จาก webhook" },
        { status: 400 }
      );
    }

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "Missing LINE_CHANNEL_ACCESS_TOKEN" }, { status: 500 });
    }

    const target = to.trim();
    const resolvedType = type || (target.startsWith("U") ? "user" : target.startsWith("C") ? "group" : target.startsWith("R") ? "room" : undefined);

    const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        to: target,
        messages: normalizedMessages
      })
    });
 
    const supabase = createSupabaseAdminClient();
    const { data: insertedRows, error: dbError } = await supabase
      .from("line_messages")
      .insert(
        normalizedMessages.map((msg) => ({
          direction: "out",
          line_user_id: resolvedType === "user" ? target : null,
          line_group_id: resolvedType === "group" ? target : null,
          line_room_id: resolvedType === "room" ? target : null,
          message_type: msg.type,
          message: getMessageLogText(msg),
          status: lineResponse.ok ? "sent" : "failed"
        }))
      )
      .select("id,line_user_id,direction,message");

    if (dbError) {
      console.error("[line/send] DB insert error:", dbError.message, dbError.details);
    }

    if (!lineResponse.ok) {
      const errorBody = await lineResponse.text();
      let detail = errorBody;
      try {
        const parsed = JSON.parse(errorBody) as { message?: string; details?: unknown };
        const detailsText = Array.isArray(parsed.details)
          ? parsed.details
              .map((item) => {
                if (!item || typeof item !== "object") return String(item);
                const row = item as Record<string, unknown>;
                return [row.message, row.property].filter(Boolean).join(" ");
              })
              .filter(Boolean)
              .join("; ")
          : "";
        detail = [parsed.message, detailsText].filter(Boolean).join(": ") || errorBody;
      } catch {
        // keep raw LINE response
      }
      return NextResponse.json({ error: `LINE API error: ${detail}` }, { status: 502 });
    }

    if (dbError) {
      return NextResponse.json(
        { error: `ส่งสำเร็จแต่บันทึกประวัติไม่ได้: ${dbError.message}` },
        { status: 207 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
