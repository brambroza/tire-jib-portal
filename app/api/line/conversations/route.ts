export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabaseAdmin";

type EventRow = {
  id: number;
  line_user_id: string | null;
  message_text: string | null;
  message_type: string | null;
  created_at: string;
};

type CustomerRow = {
  id: string;
  line_user_id: string | null;
  display_name: string | null;
  profile_image_url: string | null;
  full_name: string | null;
  phone: string | null;
  line_is_friend: boolean | null;
  line_msg_user_id: string | null;
};

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    // ดึง latest event ต่อ user ผ่าน view (DISTINCT ON) — ไม่มีปัญหา limit
    const { data: latestEvents, error: latestError } = await supabase
      .from("latest_line_events_per_user")
      .select("id,line_user_id,message_text,message_type,created_at");

    if (latestError) throw latestError;

    if (!latestEvents || latestEvents.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    const lineUserIds = (latestEvents as EventRow[])
      .map((r) => r.line_user_id)
      .filter((id): id is string => !!id);

    // นับ unread แยก — ไม่ผูกกับ limit ของ latest query
    const { data: countRows, error: countError } = await supabase
      .from("line_webhook_events")
      .select("line_user_id")
      .in("line_user_id", lineUserIds);

    if (countError) throw countError;

    const unreadByUser = new Map<string, number>();
    (countRows ?? []).forEach((row) => {
      if (!row.line_user_id) return;
      unreadByUser.set(row.line_user_id, (unreadByUser.get(row.line_user_id) ?? 0) + 1);
    });

    const latestByUser = new Map<string, EventRow>(
      (latestEvents as EventRow[])
        .filter((r) => r.line_user_id)
        .map((r) => [r.line_user_id as string, r])
    );

    let customerByLine = new Map<string, CustomerRow>();

    if (lineUserIds.length > 0) {
      const { data: customerRows, error: customerError } = await supabase
        .from("customes")
        .select("id,line_user_id,line_msg_user_id, full_name, display_name,profile_image_url,phone,line_is_friend")
        .in("line_msg_user_id", lineUserIds);
      if (customerError) throw customerError;
      customerByLine = new Map(
        (customerRows ?? [])
          .filter((row) => row.line_msg_user_id)
          .map((row) => [row.line_msg_user_id as string, row as CustomerRow])
      );
    }

    const conversations = lineUserIds
      .map((lineUserId) => {
        const latest = latestByUser.get(lineUserId);
        const customer = customerByLine.get(lineUserId);
        return {
          line_user_id: lineUserId,
          latest_message_text: latest?.message_text ?? null,
          latest_message_type: latest?.message_type ?? null,
          latest_message_at: latest?.created_at ?? null,
          unread_count: unreadByUser.get(lineUserId) ?? 0,
          customer_id: customer?.id ?? null,
          customer_display_name: customer?.display_name ?? null,
          customer_profile_image_url: customer?.profile_image_url ?? null,
          customer_full_name: customer?.full_name ?? null,
          customer_phone: customer?.phone ?? null,
          customer_is_friend: customer?.line_is_friend ?? null
        };
      })
      .sort((a, b) => (b.latest_message_at ?? "").localeCompare(a.latest_message_at ?? ""));

    return NextResponse.json({ conversations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
