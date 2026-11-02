import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "../../../../../lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    const siteId = String(formData.get("site_id") ?? "").trim();
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing image file" }, { status: 400 });
    }
    if (!siteId) {
      return NextResponse.json({ error: "missing site_id" }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${siteId}/${Date.now()}_${safeName}`;

    const supabase = createSupabaseAdminClient();
    const bucket = supabase.storage.from("websitebank");
    const { error: uploadError } = await bucket.upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;

    const { data } = bucket.getPublicUrl(path);
    return NextResponse.json({ path, image_url: data.publicUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "upload failed" },
      { status: 500 }
    );
  }
}
