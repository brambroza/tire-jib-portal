import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabaseAdmin";
import { buildImageVectorFromBuffer } from "../_lib/image-vector";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    const skuId = String(formData.get("sku_id") ?? "").trim();
    const imageUrl = String(formData.get("image_url") ?? "").trim();
    const source = String(formData.get("source") ?? "manual").trim() || "manual";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing image file" }, { status: 400 });
    }
    if (!skuId) {
      return NextResponse.json({ error: "missing sku_id" }, { status: 400 });
    }
    if (!imageUrl) {
      return NextResponse.json({ error: "missing image_url" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const embedding = buildImageVectorFromBuffer(arrayBuffer);

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("sku_image_embeddings").upsert(
      {
        sku_id: skuId,
        image_url: imageUrl,
        source,
        embedding,
        updated_at: new Date().toISOString()
      },
      { onConflict: "sku_id,image_url" }
    );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
