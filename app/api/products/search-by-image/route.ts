import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabaseAdmin";
import {
  buildImageVectorFromBuffer,
  cosineSimilarity,
  parseVectorValue
} from "../_lib/image-vector";

type MatchRow = {
  sku_id: string;
  image_url: string;
  embedding?: unknown;
  skus?: {
    id: string;
    sku_code: string | null;
    size_label: string | null;
    products?: { brand: string | null; name: string | null } | null;
  } | null;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing image file" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const queryEmbedding = buildImageVectorFromBuffer(arrayBuffer);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("sku_image_embeddings")
      .select("sku_id,image_url,embedding,skus(id,sku_code,size_label,products(brand,name))")
      .limit(1000);

    if (error) throw error;

    const matches = ((data ?? []) as unknown as MatchRow[])
      .map((row) => {
        const embedding = parseVectorValue(row.embedding);
        return {
          sku_id: row.sku_id,
          image_url: row.image_url,
          sku_code: row.skus?.sku_code ?? null,
          size_label: row.skus?.size_label ?? null,
          brand: row.skus?.products?.brand ?? null,
          name: row.skus?.products?.name ?? null,
          score: cosineSimilarity(queryEmbedding, embedding),
          match_type: "vector_cosine_phase1" as const
        };
      })
      .filter((item) => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return NextResponse.json({
      mode: "phase1_vector_cosine",
      matches,
      message:
        matches.length > 0
          ? "พบผลลัพธ์จากการเทียบความคล้ายของภาพ"
          : "ยังไม่พบรูปที่ใกล้เคียง"
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
