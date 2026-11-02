import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "../../../../lib/supabaseAdmin";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const bucket = process.env.SUPABASE_LINE_UPLOAD_BUCKET || "line-chat";
    const supabase = createSupabaseAdminClient();

    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = (buckets ?? []).some((row) => row.name === bucket);
    if (!exists) {
      await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: "20MB" });
    }

    const bytes = await file.arrayBuffer();
    const safeName = sanitizeFileName(file.name || "upload.bin");
    const objectPath = `line/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    const url = publicUrlData.publicUrl;

    return NextResponse.json({
      url,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream"
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
