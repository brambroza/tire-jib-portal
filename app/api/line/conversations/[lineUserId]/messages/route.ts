export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../../lib/supabaseAdmin";

type IncomingRow = {
  id: number;
  message_type: string | null;
  message_text: string | null;
  created_at: string;
};

type OutgoingRow = {
  id: string;
  direction: string;
  message_type: string | null;
  message: string | null;
  status: string | null;
  created_at: string;
};

type CustomerRow = {
  display_name: string | null;
  profile_image_url: string | null;
};

export async function GET(_: Request, context: { params: { lineUserId: string } }) {
  try {
    const lineUserId = decodeURIComponent(context.params.lineUserId || "").trim();
 
     console.log("lineUserId" ,lineUserId);
    if (!lineUserId) {
      return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const [incomingRes, outgoingRes, customerRes] = await Promise.all([
      supabase
        .from("line_webhook_events")
        .select("id,message_type,message_text,created_at")
        .eq("line_user_id", lineUserId)
        .order("created_at", { ascending: true })
        .limit(500),
      supabase
        .from("line_messages")
        .select("id,direction,message_type,message,status,created_at")
        .eq("line_user_id", lineUserId)
        .order("created_at", { ascending: true })
        .limit(500),
      supabase
        .from("customes")
        .select("display_name,profile_image_url")
        .eq("line_msg_user_id", lineUserId)
        .maybeSingle()
    ]);


    if (incomingRes.error) throw incomingRes.error;
    if (outgoingRes.error) throw outgoingRes.error;
    if (customerRes.error) throw customerRes.error;



    const incoming = (incomingRes.data ?? []).map((row) => ({
      id: `in-${row.id}`,
      direction: "in" as const,
      message_type: (row as IncomingRow).message_type ?? null,
      message: (row as IncomingRow).message_text ?? null,
      status: null,
      created_at: (row as IncomingRow).created_at
    }));

    // filter direction ใน JS แทน PostgREST เพราะ .eq("direction","out") มีปัญหา
    const outgoing = (outgoingRes.data ?? [])
      .filter((row) => (row as OutgoingRow).direction === "out")
      .map((row) => ({
        id: `out-${row.id}`,
        direction: "out" as const,
        message_type: (row as OutgoingRow).message_type ?? null,
        message: (row as OutgoingRow).message ?? null,
        status: (row as OutgoingRow).status ?? null,
        created_at: (row as OutgoingRow).created_at
      }));

    const messages = [...incoming, ...outgoing].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );

    return NextResponse.json({
      customer: {
        display_name: (customerRes.data as CustomerRow | null)?.display_name ?? null,
        profile_image_url: (customerRes.data as CustomerRow | null)?.profile_image_url ?? null
      },
      messages
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
