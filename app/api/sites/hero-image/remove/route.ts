import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "../../../../../lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { paths?: string[] };
    const paths = Array.isArray(body?.paths)
      ? body.paths.map((path) => String(path).trim()).filter(Boolean)
      : [];

    if (paths.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage.from("hero").remove(paths);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "remove failed" },
      { status: 500 }
    );
  }
}
