import { NextResponse } from "next/server";
import crypto from "crypto";
import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";
import { createSupabaseAdminClient } from "../../../../lib/supabaseAdmin";

type Payload = {
  html?: string;
  baseUrl?: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  scheduleText: string;
  receiveTime: string;
  finishTime: string;
  plateNo: string;
  tireSummary: string;
  technicianNote: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtml(payload: Payload) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; color: #1f2937; margin: 24px; }
  .card { border: 1px solid #d1d5db; border-radius: 10px; overflow: hidden; }
  .head { background: #16a34a; color: white; padding: 12px 14px; font-weight: 700; font-size: 18px; }
  .body { padding: 14px; }
  .row { margin-bottom: 8px; font-size: 14px; }
  .label { color: #4b5563; display: inline-block; width: 130px; }
  .note { margin-top: 14px; border: 1px dashed #d1d5db; border-radius: 8px; padding: 10px; white-space: pre-wrap; }
</style>
</head>
<body>
  <div class="card">
    <div class="head">รายงานติดตั้งหน้างาน #${escapeHtml(payload.orderNo)}</div>
    <div class="body">
      <div class="row"><span class="label">ลูกค้า:</span>${escapeHtml(payload.customerName)}</div>
      <div class="row"><span class="label">เบอร์โทร:</span>${escapeHtml(payload.customerPhone)}</div>
      <div class="row"><span class="label">ที่อยู่:</span>${escapeHtml(payload.customerAddress)}</div>
      <div class="row"><span class="label">วันเวลา:</span>${escapeHtml(payload.scheduleText)}</div>
      <div class="row"><span class="label">เวลาเริ่ม-เสร็จ:</span>${escapeHtml(payload.receiveTime)} - ${escapeHtml(payload.finishTime)}</div>
      <div class="row"><span class="label">ทะเบียนรถ:</span>${escapeHtml(payload.plateNo)}</div>
      <div class="row"><span class="label">ลมยาง:</span>${escapeHtml(payload.tireSummary)}</div>
      <div class="note"><strong>หมายเหตุช่าง</strong>\n${escapeHtml(payload.technicianNote || "-")}</div>
    </div>
  </div>
</body>
</html>`;
}

function withBaseHref(html: string, baseUrl: string) {
  const safeBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const baseTag = `<base href="${safeBase}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }
  return `${baseTag}${html}`;
}

export async function POST(request: Request) {
  let browser: Browser | null = null;
  try {
    const payload = (await request.json()) as Partial<Payload>;
    const normalized: Payload = {
      orderNo: String(payload.orderNo ?? "-").trim() || "-",
      customerName: String(payload.customerName ?? "-").trim() || "-",
      customerPhone: String(payload.customerPhone ?? "-").trim() || "-",
      customerAddress: String(payload.customerAddress ?? "-").trim() || "-",
      scheduleText: String(payload.scheduleText ?? "-").trim() || "-",
      receiveTime: String(payload.receiveTime ?? "-").trim() || "-",
      finishTime: String(payload.finishTime ?? "-").trim() || "-",
      plateNo: String(payload.plateNo ?? "-").trim() || "-",
      tireSummary: String(payload.tireSummary ?? "-").trim() || "-",
      technicianNote: String(payload.technicianNote ?? "-").trim() || "-"
    };

    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    const rawHtml = typeof payload.html === "string" ? payload.html.trim() : "";
    const baseUrl = typeof payload.baseUrl === "string" ? payload.baseUrl.trim() : "";
    const htmlForRender =
      rawHtml && baseUrl ? withBaseHref(rawHtml, baseUrl) : rawHtml || buildHtml(normalized);
    await page.setContent(htmlForRender);
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "10mm", right: "8mm", bottom: "10mm", left: "8mm" } });

    const supabase = createSupabaseAdminClient();
    const bucket = process.env.SUPABASE_LINE_UPLOAD_BUCKET || "line-chat";
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = (buckets ?? []).some((b) => b.name === bucket);
    if (!exists) {
      await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: "20MB" });
    }

    const path = `line/reports/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${normalized.orderNo}.pdf`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false
    });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
