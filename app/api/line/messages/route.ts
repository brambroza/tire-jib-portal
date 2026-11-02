import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lineUserId = url.searchParams.get("line_user_id");
    const lineGroupId = url.searchParams.get("line_group_id");
    const lineRoomId = url.searchParams.get("line_room_id");
    const limit = Number(url.searchParams.get("limit") || 50);

    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("line_messages")
      .select("id,direction,line_user_id,line_group_id,line_room_id,message_type,message,status,created_at")
      .order("created_at", { ascending: false })
      .limit(Number.isNaN(limit) ? 50 : limit);

    if (lineUserId) query = query.eq("line_user_id", lineUserId);
    if (lineGroupId) query = query.eq("line_group_id", lineGroupId);
    if (lineRoomId) query = query.eq("line_room_id", lineRoomId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ messages: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
