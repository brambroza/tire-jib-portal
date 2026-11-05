/* import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "../../../../lib/supabaseAdmin";

 

type CatalogRow = {
  id: string;
  size_label: string | null;
  width_mm: number | null;
  aspect_ratio: number | null;
  rim_inch: number | null;
  qty_on_hand?: number | null;
  image_url?: string | null;
  products:
  | {
    id: string;
    brand: string | null;
    name: string | null;
    site_id: string | null;
    is_hot: boolean | null;
    is_new: boolean | null;
    is_promotion: boolean | null;
    total_sold: number | null;
    product_car_models?: {
      car_brands?: { id: string; name: string | null } | null;
      car_models?: { id: string; name: string | null } | null;
    }[] | null;
  }
  | null;
  prices:
  | {
    price: number | null;
    old_price: number | null;
    group_id: string | null;
  }[]
  | null;
};

type NormalizedCatalogRow = {
  id: string;
  size_label: string | null;
  size_text: string;
  qty_on_hand: number | null;
  image_url: string | null;
  price: number | null;
  old_price: number | null;
  products: {
    id: string;
    brand: string | null;
    name: string | null;
    is_hot: boolean;
    is_new: boolean;
    is_promotion: boolean;
    car_brand_name: string | null;
    car_model_name: string | null;
  } | null;
};



type ParsedQuery = {
  text: string;
  size?: {
    width: number;
    aspect: number;
    rim: number;
    label: string; // 265/75R16
  };
  brand?: string;
  keywords: string[];
};

const KNOWN_BRANDS = [
  "austone",
  "maxxis",
  "yokohama",
  "michelin",
  "bridgestone",
  "goodyear",
  "dunlop",
  "toyo",
  "continental",
  "nexen",
  "hixih",
  "chengshan"
];

const STOP_WORDS = [
  "ยาง",
  "ราคา",
  "ขอ",
  "หา",
  "มีไหม",
  "ครับ",
  "ค่ะ",
  "คะ",
  "เส้น",
  "ล้อ",
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/ยี่ห้อ/g, " ")
    .replace(/รุ่น/g, " ")
    .replace(/ขนาด/g, " ")
    .replace(/[\-,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function parseTyreSize(text: string): ParsedQuery["size"] {
  const clean = text.toUpperCase().replace(/\s+/g, "");

  // 265/75/16, 265/75R16, 265 75 16
  const match =
    clean.match(/(\d{3})\/?(\d{2})(?:R|\/)?(\d{2})/) ??
    text.match(/(\d{3})\s+(\d{2})\s+(\d{2})/);

  if (!match) return undefined;

  const width = Number(match[1]);
  const aspect = Number(match[2]);
  const rim = Number(match[3]);

  return {
    width,
    aspect,
    rim,
    label: `${width}/${aspect}R${rim}`,
  };
}


function normalizeSizeToken(input: string) {
  const cleaned = input.toUpperCase().replace(/\s+/g, "");

  const full = cleaned.match(/^(\d{3})\/(\d{2})(?:R|\/)(\d{2})(C)?$/);
  if (full) {
    return `${full[1]}/${full[2]}/${full[3]}${full[4] ? "C" : ""}`;
  }

  const commercial = cleaned.match(/^(\d{3})R(\d{2})(C)?$/);
  if (commercial) {
    return `${commercial[1]}R${commercial[2]}${commercial[3] ? "C" : ""}`;
  }

  return null;
}


function parseCustomerText(text: string): ParsedQuery {
  const normalized = normalizeText(text);
  const size = parseTyreSize(text);

  const brand = KNOWN_BRANDS.find((b) => normalized.includes(b));

  const keywords = Array.from(
    new Set(
      normalized
        .split(" ")
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((x) => !KNOWN_BRANDS.includes(x))
        .filter((x) => !STOP_WORDS.includes(x))
        .filter((x) => !/^\d+$/.test(x))
        .filter((x) => x.length >= 2)
    )
  );

  return {
    text: normalized,
    size,
    brand,
    keywords,
  };
}



function normalizeCatalogRow(row: CatalogRow): NormalizedCatalogRow {
  const product = row.products ?? null;
  const firstPrice = row.prices?.[0] ?? null;
  const firstModel = product?.product_car_models?.[0] ?? null;
  const sizeText =
    row.size_label?.trim() ||
    ([row.width_mm, row.aspect_ratio, row.rim_inch].every((v) => typeof v === "number")
      ? `${row.width_mm}/${row.aspect_ratio}/R${row.rim_inch}`
      : "-");
  return {
    id: row.id,
    size_label: row.size_label ?? null,
    size_text: sizeText,
    qty_on_hand: row.qty_on_hand ?? null,
    image_url: row.image_url ?? null,
    price: firstPrice?.price ?? null,
    old_price: firstPrice?.old_price ?? null,
    products: product
      ? {
        id: product.id,
        brand: product.brand ?? null,
        name: product.name ?? null,
        is_hot: Boolean(product.is_hot),
        is_new: Boolean(product.is_new),
        is_promotion: Boolean(product.is_promotion),
        car_brand_name: firstModel?.car_brands?.name ?? null,
        car_model_name: firstModel?.car_models?.name ?? null
      }
      : null
  };
}


function scoreCatalogItem(item: NormalizedCatalogRow, parsed: ParsedQuery) {
  const brand = item.products?.brand?.toLowerCase() ?? "";
  const name = item.products?.name?.toLowerCase() ?? "";
  const carBrand = item.products?.car_brand_name?.toLowerCase() ?? "";
  const carModel = item.products?.car_model_name?.toLowerCase() ?? "";

  const sizeMatched =
    parsed.size &&
    item.size_label &&
    normalizeSizeToken(item.size_label)?.replace("/", "/").replace("/R", "/") ===
    `${parsed.size.width}/${parsed.size.aspect}/${parsed.size.rim}`;

  let score = 0;

  if (sizeMatched) score += 100;
  if (parsed.brand && brand.includes(parsed.brand)) score += 50;

  for (const kw of parsed.keywords) {
    if (name.includes(kw)) score += 30;
    if (carModel.includes(kw)) score += 25;
    if (carBrand.includes(kw)) score += 20;
    if (brand.includes(kw)) score += 20;
  }

  if (item.products?.is_promotion) score += 5;
  if (item.products?.is_hot) score += 5;
  if ((item.qty_on_hand ?? 0) > 0) score += 10;

  return score;
}

async function searchCatalogItems(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  parsed: ParsedQuery
) {
  let query = supabase
    .from("skus")
    .select(`
       id,
       size_label,
       width_mm,
       aspect_ratio,
       rim_inch,
       products!inner(
         id,
         brand,
         name,
         description,
         remark,
         site_id,
         is_hot,
         is_new,
         is_promotion,
         total_sold,
         product_car_models(
           car_brands(id, name),
           car_models(id, name)
         )
       ),
       inventory(qty_on_hand),
       sku_image_embeddings(image_url),
       prices!inner(
         price,
         old_price,
         group_id
       )
     `)
    .eq("products.site_id", "1df52c4e-2178-400f-9cd6-cb38cf8549a7")
    .eq("prices.group_id", "b2a66855-3693-4ff1-91d4-fa49c20de5a6")
    .limit(800);

  if (parsed.size) {
    query = query
      .eq("width_mm", parsed.size.width)
      .eq("aspect_ratio", parsed.size.aspect)
      .eq("rim_inch", parsed.size.rim);
  }

  if (parsed.brand) {
    query = query.ilike("products.brand", `%${parsed.brand}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as any[])
    .map((row) =>
      normalizeCatalogRow({
        ...row,
        qty_on_hand: row.inventory?.[0]?.qty_on_hand ?? null,
        image_url: row.sku_image_embeddings?.[0]?.image_url ?? null,
      })
    )
    .map((row) => ({
      row,
      score: scoreCatalogItem(row, parsed),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.row);
}

function buildProductUrl(productId: string) {
  const base = (process.env.STOREFRONT_BASE_URL || "https://hijibjib.com").replace(/\/$/, "");
  return `${base}/products/${productId}`;
}

function isLineAutoReplyEnabled() {
  const value = (process.env.LINE_WEBHOOK_AUTO_REPLY ?? "true").trim().toLowerCase();
  return !["0", "false", "off", "no"].includes(value);
}

function isLineSearchDebugEnabled() {
  const value = (process.env.LINE_WEBHOOK_SEARCH_DEBUG ?? "false").trim().toLowerCase();
  return ["1", "true", "on", "yes"].includes(value);
}

function logLineSearchDebug(input: {
  text: string;
  lineUserId: string;
  parsed: ParsedQuery;
  items: NormalizedCatalogRow[];
}) {
  if (!isLineSearchDebugEnabled()) return;

  const { text, lineUserId, parsed, items } = input;
  const ranked = items.map((row, index) => ({
    rank: index + 1,
    score: scoreCatalogItem(row, parsed),
    product_id: row.products?.id ?? null,
    brand: row.products?.brand ?? null,
    product_name: row.products?.name ?? null,
    car_brand_name: row.products?.car_brand_name ?? null,
    car_model_name: row.products?.car_model_name ?? null,
    size: row.size_text,
    price: row.price,
    stock: row.qty_on_hand
  }));

  console.info(
    "[line/webhook][search-debug]",
    JSON.stringify(
      {
        line_user_id: lineUserId,
        input_text: text,
        parsed,
        result_count: items.length,
        ranked
      },
      null,
      2
    )
  );
}

async function replyWithSearchResult(input: {
  accessToken: string;
  replyToken: string;
  items: NormalizedCatalogRow[];
  parsed: ParsedQuery;
}) {
  const { accessToken, replyToken, items, parsed } = input;
  const storefrontBase = (process.env.STOREFRONT_BASE_URL || "https://hijibjib.com").replace(/\/$/, "");

  if (isLineAutoReplyEnabled()) {
    if (items.length === 0) {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          replyToken,
          messages: [
            {
              type: "flex",
              altText: "ไม่พบสินค้าที่ตรงคำค้น",
              contents: {
                type: "bubble",
                size: "mega",
                body: {
                  type: "box",
                  layout: "vertical",
                  spacing: "md",
                  contents: [
                    {
                      type: "text",
                      text: "ไม่พบสินค้าที่ตรงคำค้น",
                      weight: "bold",
                      size: "lg",
                      color: "#ffa202",
                      wrap: true
                    },
                    {
                      type: "text",
                      text: "ลองค้นหาใหม่ด้วยตัวอย่างด้านล่าง",
                      size: "sm",
                      color: "#475569",
                      wrap: true
                    },
                    {
                      type: "box",
                      layout: "vertical",
                      spacing: "sm",
                      margin: "sm",
                      backgroundColor: "#f8fafc",
                      cornerRadius: "12px",
                      paddingAll: "10px",
                      contents: [
                        { type: "text", text: "• Michelin 255/40r21", size: "sm", color: "#0f172a", wrap: true },
                        { type: "text", text: "• Toyota Camry", size: "sm", color: "#0f172a", wrap: true },
                        { type: "text", text: "• Fortuner Michelin", size: "sm", color: "#0f172a", wrap: true }
                      ]
                    }
                  ]
                },
                footer: {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",
                  contents: [
                    {
                      type: "button",
                      style: "primary",
                      color: "#16a34a",
                      action: {
                        type: "uri",
                        label: "ค้นหาสินค้า",
                        uri: `${storefrontBase}/search`
                      }
                    },
                    {
                      type: "button",
                      style: "link",
                      action: {
                        type: "uri",
                        label: "กลับหน้าเว็บไซต์",
                        uri: storefrontBase
                      }
                    }
                  ]
                }
              }
            },
            {
              type: "text",
              text: "พิมพ์ยี่ห้อยาง/ไซส์ หรือยี่ห้อรถ/รุ่นรถ แล้วระบบจะช่วยแนะนำสินค้าให้อัตโนมัติ"
            },
          ]
        })
      });
      return;
    }

  }


  const bubbles = items.map((item) => {
    const productId = item.id as string;
    const title = `${item.products?.brand ?? ""} ${item.products?.name ?? ""}`.trim() || "สินค้า";
    const badges = [
      item.products?.is_hot ? "HOT" : "",
      item.products?.is_new ? "NEW" : "",
      item.products?.is_promotion ? "PROMO" : ""
    ].filter(Boolean).join(" · ");
    const priceText = item.price != null ? `฿${Number(item.price).toLocaleString("th-TH")}` : "สอบถามราคา";
    const oldPriceText =
      item.old_price != null && item.old_price > (item.price ?? 0)
        ? `จาก ฿${Number(item.old_price).toLocaleString("th-TH")}`
        : "";
    const stockText =
      item.qty_on_hand != null
        ? item.qty_on_hand > 0
          ? `คงเหลือ ${item.qty_on_hand.toLocaleString("th-TH")} ชิ้น`
          : "สินค้าหมดชั่วคราว"
        : "เช็กสต๊อกกับแอดมิน";
    return {
      type: "bubble",
      hero: item.image_url
        ? {
          type: "image",
          url: item.image_url,
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover"
        }
        : undefined,
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: item.size_text, size: "md", color: "#334155", weight: "bold", wrap: true },
          { type: "text", text: title, size: "sm", wrap: true },
          badges ? { type: "text", text: badges, size: "xs", color: "#ea580c", wrap: true } : null,
          { type: "text", text: priceText, size: "md", weight: "bold", color: "#16a34a", wrap: true },
          oldPriceText ? { type: "text", text: oldPriceText, size: "xs", color: "#94a3b8", wrap: true } : null,
          { type: "text", text: stockText, size: "xs", color: "#64748b", wrap: true }
        ].filter(Boolean)
      },
      styles: {
        footer: {
          separator: true
        }
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#16a34a",
            action: {
              type: "uri",
              label: "สั่งซื้อสินค้า",
              uri: buildProductUrl(productId)
            }
          }
        ]
      }
    };
  });

  const searchHint = [
    parsed.brand,
    parsed.size?.label,
    ...parsed.keywords,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const searchUrl = `${storefrontBase}/search${searchHint ? `?q=${encodeURIComponent(searchHint)}` : ""}`;

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "flex",
          altText: "รายการยางที่ค้นพบ",
          contents: {
            type: "carousel",
            contents: bubbles
          }
        },
        {
          type: "text",
          text: `ดูทั้งหมด/สั่งซื้อ: ${searchUrl}\nกลับหน้าเว็บ: ${storefrontBase}`
        }
      ]
    })
  });
}

export async function POST(request: Request) {
  try {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    if (!channelSecret) {
      return NextResponse.json({ error: "Missing LINE_CHANNEL_SECRET" }, { status: 500 });
    }

    const signature = request.headers.get("x-line-signature") || "";
    const bodyText = await request.text();
    const expected = crypto.createHmac("SHA256", channelSecret).update(bodyText).digest("base64");

    if (signature !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(bodyText) as { events?: Array<Record<string, unknown>> };
    const events = Array.isArray(payload?.events) ? payload.events : [];

    if (events.length === 0) {
      return NextResponse.json({ success: true });
    }

    const supabase = createSupabaseAdminClient();
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    const lineMessageRows: Array<Record<string, unknown>> = [];
    const eventRows: Array<Record<string, unknown>> = [];
    const friendUpdates = new Map<string, { line_is_friend: boolean; timestampIso: string }>();

    events.forEach((event) => {
      const source = (event.source ?? {}) as Record<string, unknown>;
      const message = (event.message ?? {}) as Record<string, unknown>;
      const eventType = String(event.type ?? "");
      const lineUserId = typeof source.userId === "string" ? source.userId : null;
      const sourceType = typeof source.type === "string" ? source.type : null;
      const groupId = typeof source.groupId === "string" ? source.groupId : null;
      const roomId = typeof source.roomId === "string" ? source.roomId : null;
      const webhookEventId = typeof event.webhookEventId === "string" ? event.webhookEventId : null;
      const timestampMs = typeof event.timestamp === "number" ? event.timestamp : null;
      const timestampIso = timestampMs ? new Date(timestampMs).toISOString() : new Date().toISOString();

      if (eventType === "follow" && lineUserId) {
        friendUpdates.set(lineUserId, { line_is_friend: true, timestampIso });
      }
      if (eventType === "unfollow" && lineUserId) {
        friendUpdates.set(lineUserId, { line_is_friend: false, timestampIso });
      }

      const messageType = typeof message.type === "string" ? message.type : null;
      const messageId = typeof message.id === "string" ? message.id : null;
      const messageText = typeof message.text === "string" ? message.text : null;

      eventRows.push({
        webhook_event_id: webhookEventId,
        event_type: eventType || "unknown",
        mode: typeof event.mode === "string" ? event.mode : null,
        timestamp_ms: timestampMs,
        line_user_id: lineUserId,
        source_type: sourceType,
        source_group_id: groupId,
        source_room_id: roomId,
        message_id: messageId,
        message_type: messageType,
        message_text: messageText,
        message_payload: Object.keys(message).length > 0 ? message : null,
        raw_event: event
      });

      if (eventType === "message") {
        lineMessageRows.push({
          direction: "in",
          line_user_id: lineUserId,
          line_group_id: groupId,
          line_room_id: roomId,
          message_type: messageType || "text",
          message: messageText,
          raw: event
        });
      }
    });

    if (accessToken && isLineAutoReplyEnabled()) {
      for (const event of events) {
        const eventType = String(event.type ?? "");
        if (eventType !== "message") continue;
        const replyToken = typeof event.replyToken === "string" ? event.replyToken : "";
        const source = (event.source ?? {}) as Record<string, unknown>;
        const lineUserId = typeof source.userId === "string" ? source.userId : "unknown";
        const message = (event.message ?? {}) as Record<string, unknown>;
        const messageType = typeof message.type === "string" ? message.type : "";
        const text = typeof message.text === "string" ? message.text : "";
        if (!replyToken || messageType !== "text" || !text.trim()) continue;
        const normalizedText = text.trim().toLowerCase();

        if (normalizedText === "สอบถามยาง") {
          try {
            await replyWithTireSearchGuide({
              accessToken,
              replyToken
            });
          } catch (guideReplyErr) {
            console.error("[line/webhook] tire-search guide reply failed", guideReplyErr);
          }
          continue;
        }

        const parsed = parseCustomerText(text);
        if (!parsed.brand && !parsed.size && parsed.keywords.length === 0) continue;

        try {
          const items = await searchCatalogItems(supabase, parsed);
          logLineSearchDebug({
            text,
            lineUserId,
            parsed,
            items
          });
          await replyWithSearchResult({
            accessToken,
            replyToken,
            items,
            parsed
          });
        } catch (replyErr) {
          console.error("[line/webhook] auto-reply search failed", replyErr);
        }
      }
    }

    if (lineMessageRows.length > 0) {
      const { error } = await supabase.from("line_messages").insert(lineMessageRows);
      if (error) {
        console.error("[line/webhook] line_messages insert failed", error);
      }
    }

    const insertedEventMap = new Map<string, number>();
    if (eventRows.length > 0) {
      const { data: insertedEvents, error: insertedEventError } = await supabase
        .from("line_webhook_events")
        .insert(eventRows)
        .select("id,webhook_event_id");
      if (insertedEventError) {
        console.error("[line/webhook] line_webhook_events insert failed", insertedEventError);
      } else if (insertedEvents) {
        insertedEvents.forEach((row) => {
          if (row.webhook_event_id) insertedEventMap.set(row.webhook_event_id, row.id);
        });
      }
    }

    const mediaRows: Array<Record<string, unknown>> = [];
    events.forEach((event) => {
      const source = (event.source ?? {}) as Record<string, unknown>;
      const message = (event.message ?? {}) as Record<string, unknown>;
      const eventType = String(event.type ?? "");
      if (eventType !== "message") return;
      const messageType = typeof message.type === "string" ? message.type : "";
      const isMediaType = ["image", "video", "audio", "file", "sticker"].includes(messageType);
      if (!isMediaType) return;

      const webhookEventId = typeof event.webhookEventId === "string" ? event.webhookEventId : null;
      const mappedWebhookId = webhookEventId ? insertedEventMap.get(webhookEventId) : null;
      if (!mappedWebhookId) return;

      mediaRows.push({
        webhook_event_id: mappedWebhookId,
        message_id: typeof message.id === "string" ? message.id : `missing-${mappedWebhookId}`,
        line_user_id: typeof source.userId === "string" ? source.userId : null,
        media_type: messageType,
        content_type: typeof message.contentProvider === "string" ? message.contentProvider : null,
        storage_bucket: null,
        storage_path: null,
        file_size_bytes: typeof message.fileSize === "number" ? message.fileSize : null,
        file_name: typeof message.fileName === "string" ? message.fileName : null,
        sticker_package_id: typeof message.packageId === "string" ? message.packageId : null,
        sticker_id: typeof message.stickerId === "string" ? message.stickerId : null,
        sticker_keywords: Array.isArray(message.keywords) ? message.keywords : null,
        raw_payload: message
      });
    });
    if (mediaRows.length > 0) {
      const { error } = await supabase.from("line_webhook_media").upsert(mediaRows, { onConflict: "message_id" });
      if (error) {
        console.error("[line/webhook] line_webhook_media upsert failed", error);
      }
    }

    for (const [lineUserId, update] of friendUpdates.entries()) {
      const { error } = await supabase
        .from("customes")
        .update({
          line_is_friend: update.line_is_friend,
          line_friendship_checked_at: update.timestampIso,
          line_followed_at: update.line_is_friend ? update.timestampIso : undefined,
          line_unfollowed_at: !update.line_is_friend ? update.timestampIso : undefined
        })
        .eq("line_user_id", lineUserId);
      if (error) {
        console.error("[line/webhook] customes friendship update failed", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[line/webhook] unhandled error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
 */


import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "../../../../lib/supabaseAdmin";
import {
  buildLineProductButtons,
  DEFAULT_LINE_REPLY_SETTINGS,
  LINE_REPLY_TEXT_MAX,
  normalizeLineReplySettings,
  parseOrderPostbackData,
  renderLineFooterTemplate,
  renderLineMessageTemplate,
  resolveLinkButtonUrl,
  type LineReplySettings,
  type LineTemplateValues
} from "../../../../lib/lineReplySettings";

 
type CatalogRow = {
  id: string;
  size_label: string | null;
  width_mm: number | null;
  aspect_ratio: number | null;
  rim_inch: number | null;
  qty_on_hand?: number | null;
  image_url?: string | null;
  products:
  | {
    id: string;
    brand: string | null;
    name: string | null;
    site_id: string | null;
    is_hot: boolean | null;
    is_new: boolean | null;
    is_promotion: boolean | null;
    total_sold: number | null;
    product_car_models?: {
      car_brands?: { id: string; name: string | null } | null;
      car_models?: { id: string; name: string | null } | null;
    }[] | null;
  }
  | null;
  prices:
  | {
    price: number | null;
    old_price: number | null;
    group_id: string | null;
  }[]
  | null;
};

type NormalizedCatalogRow = {
  id: string;
  size_label: string | null;
  size_text: string;
  qty_on_hand: number | null;
  image_url: string | null;
  price: number | null;
  old_price: number | null;
  products: {
    id: string;
    brand: string | null;
    name: string | null;
    is_hot: boolean;
    is_new: boolean;
    is_promotion: boolean;
    car_brand_name: string | null;
    car_model_name: string | null;
  } | null;
};



type ParsedQuery = {
  text: string;
  size?: {
    width: number;
    aspect: number;
    rim: number;
    label: string; // 265/75R16
  };
  brand?: string;
  keywords: string[];
};


type SearchScopeResult = {
  inScope: boolean;
  intent:
    | "tyre_search"
    | "appointment"
    | "contact_admin"
    | "greeting"
    | "out_of_scope"
    | "unclear";
  confidence: number;
  reason: string;
};

const TYRE_SEARCH_WORDS = [
  "ยาง",
  "ล้อ",
  "แม็ก",
  "แม็กซ์",
  "ราคา",
  "เท่าไหร่",
  "กี่บาท",
  "ไซส์",
  "ขนาด",
  "ขอบ",
  "เส้น",
  "r12",
  "r13",
  "r14",
  "r15",
  "r16",
  "r17",
  "r18",
  "r19",
  "r20",
  "r21",
  "r22",
  "r23",
  "มีไหม",
  "มีมั้ย",
  "มีของไหม",
  "มีของมั้ย",
  "เช็คสต๊อก",
  "เช็คสต็อก",
  "สต๊อก",
  "สต็อก",
  "ยี่ห้อ",
  "รุ่นรถ",
  "รถ",
];

const APPOINTMENT_WORDS = [
  "นัด",
  "นัดหมาย",
  "จอง",
  "จองคิว",
  "เข้าร้าน",
  "เปลี่ยนยาง",
  "ตั้งศูนย์",
  "ถ่วงล้อ",
  "ปะยาง",
  "สลับยาง",
];

const ADMIN_CONTACT_WORDS = [
  "แอดมิน",
  "เจ้าหน้าที่",
  "พนักงาน",
  "ติดต่อ",
  "โทร",
  "เบอร์",
  "คุยกับคน",
  "คุยกับแอดมิน",
  "สอบถาม",
];

const GREETING_WORDS = [
  "สวัสดี",
  "หวัดดี",
  "hello",
  "hi",
  "ดีครับ",
  "ดีค่ะ",
];

function includesAnyKeyword(text: string, words: string[]) {
  return words.some((word) => text.includes(word.toLowerCase()));
}

function classifySearchScope(text: string, parsed: ParsedQuery): SearchScopeResult {
  const normalized = normalizeText(text);

  const hasSize = Boolean(parsed.size);
  const hasBrand = Boolean(parsed.brand);
  const hasTyreWord = includesAnyKeyword(normalized, TYRE_SEARCH_WORDS);
  const hasAppointmentWord = includesAnyKeyword(normalized, APPOINTMENT_WORDS);
  const hasAdminWord = includesAnyKeyword(normalized, ADMIN_CONTACT_WORDS);
  const hasGreetingWord = includesAnyKeyword(normalized, GREETING_WORDS);

  if (hasSize || hasBrand || hasTyreWord) {
    return {
      inScope: true,
      intent: "tyre_search",
      confidence: hasSize || hasBrand ? 0.95 : 0.8,
      reason: "Message looks related to tyre/product search",
    };
  }

  if (hasAppointmentWord) {
    return {
      inScope: false,
      intent: "appointment",
      confidence: 0.9,
      reason: "User looks like they want an appointment",
    };
  }

  if (hasAdminWord) {
    return {
      inScope: false,
      intent: "contact_admin",
      confidence: 0.9,
      reason: "User looks like they want admin contact",
    };
  }

  if (hasGreetingWord) {
    return {
      inScope: false,
      intent: "greeting",
      confidence: 0.85,
      reason: "Greeting or casual message",
    };
  }

  return {
    inScope: false,
    intent: "out_of_scope",
    confidence: 0.4,
    reason: "Message is not clearly related to tyre search",
  };
}

function isTooShortForSearch(parsed: ParsedQuery) {
  return !parsed.size && !parsed.brand && parsed.keywords.length < 2;
}

function getMinimumScore(parsed: ParsedQuery) {
  if (parsed.size && parsed.brand) return 100;
  if (parsed.size) return 90;
  if (parsed.brand && parsed.keywords.length > 0) return 70;
  if (parsed.brand) return 60;
  return 80;
}

const KNOWN_BRANDS = [
  "austone",
  "maxxis",
  "yokohama",
  "michelin",
  "bridgestone",
  "goodyear",
  "dunlop",
  "toyo",
  "continental",
  "nexen",
  "hixih",
  "chengshan"
];

const STOP_WORDS = [
  "ยาง",
  "ราคา",
  "ขอ",
  "หา",
  "มีไหม",
  "ครับ",
  "ค่ะ",
  "คะ",
  "เส้น",
  "ล้อ",
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/ยี่ห้อ/g, " ")
    .replace(/รุ่น/g, " ")
    .replace(/ขนาด/g, " ")
    .replace(/[\-,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function parseTyreSize(text: string): ParsedQuery["size"] {
  const clean = text.toUpperCase().replace(/\s+/g, "");

  // 265/75/16, 265/75R16, 265 75 16
  const match =
    clean.match(/(\d{3})\/?(\d{2})(?:R|\/)?(\d{2})/) ??
    text.match(/(\d{3})\s+(\d{2})\s+(\d{2})/);

  if (!match) return undefined;

  const width = Number(match[1]);
  const aspect = Number(match[2]);
  const rim = Number(match[3]);

  return {
    width,
    aspect,
    rim,
    label: `${width}/${aspect}R${rim}`,
  };
}


function normalizeSizeToken(input: string) {
  const cleaned = input.toUpperCase().replace(/\s+/g, "");

  const full = cleaned.match(/^(\d{3})\/(\d{2})(?:R|\/)(\d{2})(C)?$/);
  if (full) {
    return `${full[1]}/${full[2]}/${full[3]}${full[4] ? "C" : ""}`;
  }

  const commercial = cleaned.match(/^(\d{3})R(\d{2})(C)?$/);
  if (commercial) {
    return `${commercial[1]}R${commercial[2]}${commercial[3] ? "C" : ""}`;
  }

  return null;
}


function parseCustomerText(text: string): ParsedQuery {
  const normalized = normalizeText(text);
  const size = parseTyreSize(text);

  const brand = KNOWN_BRANDS.find((b) => normalized.includes(b));

  const keywords = Array.from(
    new Set(
      normalized
        .split(" ")
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((x) => !KNOWN_BRANDS.includes(x))
        .filter((x) => !STOP_WORDS.includes(x))
        .filter((x) => !/^\d+$/.test(x))
        .filter((x) => x.length >= 2)
    )
  );

  return {
    text: normalized,
    size,
    brand,
    keywords,
  };
}



function normalizeCatalogRow(row: CatalogRow): NormalizedCatalogRow {
  const product = row.products ?? null;
  const firstPrice = row.prices?.[0] ?? null;
  const firstModel = product?.product_car_models?.[0] ?? null;
  const sizeText =
    row.size_label?.trim() ||
    ([row.width_mm, row.aspect_ratio, row.rim_inch].every((v) => typeof v === "number")
      ? `${row.width_mm}/${row.aspect_ratio}/R${row.rim_inch}`
      : "-");
  return {
    id: row.id,
    size_label: row.size_label ?? null,
    size_text: sizeText,
    qty_on_hand: row.qty_on_hand ?? null,
    image_url: row.image_url ?? null,
    price: firstPrice?.price ?? null,
    old_price: firstPrice?.old_price ?? null,
    products: product
      ? {
        id: product.id,
        brand: product.brand ?? null,
        name: product.name ?? null,
        is_hot: Boolean(product.is_hot),
        is_new: Boolean(product.is_new),
        is_promotion: Boolean(product.is_promotion),
        car_brand_name: firstModel?.car_brands?.name ?? null,
        car_model_name: firstModel?.car_models?.name ?? null
      }
      : null
  };
}


function scoreCatalogItem(item: NormalizedCatalogRow, parsed: ParsedQuery) {
  const brand = item.products?.brand?.toLowerCase() ?? "";
  const name = item.products?.name?.toLowerCase() ?? "";
  const carBrand = item.products?.car_brand_name?.toLowerCase() ?? "";
  const carModel = item.products?.car_model_name?.toLowerCase() ?? "";

  const sizeMatched =
    parsed.size &&
    item.size_label &&
    normalizeSizeToken(item.size_label)?.replace("/", "/").replace("/R", "/") ===
    `${parsed.size.width}/${parsed.size.aspect}/${parsed.size.rim}`;

  let score = 0;

  if (sizeMatched) score += 100;
  if (parsed.brand && brand.includes(parsed.brand)) score += 50;

  for (const kw of parsed.keywords) {
    if (name.includes(kw)) score += 30;
    if (carModel.includes(kw)) score += 25;
    if (carBrand.includes(kw)) score += 20;
    if (brand.includes(kw)) score += 20;
  }

  if (item.products?.is_promotion) score += 5;
  if (item.products?.is_hot) score += 5;
  if ((item.qty_on_hand ?? 0) > 0) score += 10;

  return score;
}

/** Values for admin message templates ({title}, {size}, {price}, ...). */
function buildTemplateValues(item: NormalizedCatalogRow): LineTemplateValues {
  return {
    title: `${item.products?.brand ?? ""} ${item.products?.name ?? ""}`.trim() || "สินค้า",
    brand: item.products?.brand ?? "",
    name: item.products?.name ?? "",
    size: item.size_text ?? "",
    price: item.price != null ? `฿${Number(item.price).toLocaleString("th-TH")}` : "สอบถามราคา",
    url: buildProductUrl(item.id)
  };
}

/**
 * Load one SKU for the "order via chat" postback. Returns null if not found.
 */
async function fetchCatalogItemById(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  skuId: string
): Promise<NormalizedCatalogRow | null> {
  const { data, error } = await supabase
    .from("skus")
    .select(CATALOG_SELECT)
    .eq("id", skuId)
    .eq("prices.group_id", CATALOG_PRICE_GROUP_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as any;
  return normalizeCatalogRow({
    ...row,
    qty_on_hand: readQtyOnHand(row.inventory),
    image_url: row.sku_image_embeddings?.[0]?.image_url ?? null,
  });
}

/**
 * Handle a tap on the "order via chat" postback button:
 * log the customer's request into the chat, then (if enabled) send the
 * admin-configured auto-reply and log it as an outgoing message.
 * @returns rows to insert into line_messages
 */
async function handleOrderPostback(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  accessToken: string | undefined;
  event: Record<string, unknown>;
  skuId: string;
  replySettings: LineReplySettings;
}): Promise<Array<Record<string, unknown>>> {
  const { supabase, accessToken, event, skuId, replySettings } = input;
  const source = (event.source ?? {}) as Record<string, unknown>;
  const target = {
    line_user_id: typeof source.userId === "string" ? source.userId : null,
    line_group_id: typeof source.groupId === "string" ? source.groupId : null,
    line_room_id: typeof source.roomId === "string" ? source.roomId : null
  };
  const replyToken = typeof event.replyToken === "string" ? event.replyToken : "";

  const item = await fetchCatalogItemById(supabase, skuId);
  const values: LineTemplateValues = item
    ? buildTemplateValues(item)
    : { title: "สินค้า", brand: "", name: "", size: "", price: "", url: buildProductUrl(skuId) };

  const rows: Array<Record<string, unknown>> = [
    {
      direction: "in",
      ...target,
      message_type: "text",
      message: renderLineMessageTemplate(replySettings.message_template, values),
      raw: event
    }
  ];

  if (!replySettings.reply_enabled || !accessToken || !replyToken || !isLineAutoReplyEnabled()) {
    return rows;
  }

  const replyText = renderLineMessageTemplate(replySettings.reply_template, values, LINE_REPLY_TEXT_MAX);
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: replyText }]
    })
  });
  if (!response.ok) {
    console.error("[line/webhook] order postback reply failed", response.status, await response.text());
  }
  rows.push({
    direction: "out",
    ...target,
    message_type: "text",
    message: replyText,
    status: response.ok ? "sent" : "failed"
  });
  return rows;
}

const CATALOG_SITE_ID = "1df52c4e-2178-400f-9cd6-cb38cf8549a7";
const CATALOG_PRICE_GROUP_ID = "b2a66855-3693-4ff1-91d4-fa49c20de5a6";
const CATALOG_SELECT = `
       id,
       size_label,
       width_mm,
       aspect_ratio,
       rim_inch,
       products!inner(
         id,
         brand,
         name,
         description,
         remark,
         site_id,
         is_hot,
         is_new,
         is_promotion,
         total_sold,
         product_car_models(
           car_brands(id, name),
           car_models(id, name)
         )
       ),
       inventory(qty_on_hand),
       sku_image_embeddings(image_url),
       prices!inner(
         price,
         old_price,
         group_id
       )
     `;

async function searchCatalogItems(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  parsed: ParsedQuery
) {
  let query = supabase
    .from("skus")
    .select(CATALOG_SELECT)
    .eq("products.site_id", CATALOG_SITE_ID)
    .eq("prices.group_id", CATALOG_PRICE_GROUP_ID)
    .limit(800);

  if (parsed.size) {
    query = query
      .eq("width_mm", parsed.size.width)
      .eq("aspect_ratio", parsed.size.aspect)
      .eq("rim_inch", parsed.size.rim);
  }

  if (parsed.brand) {
    query = query.ilike("products.brand", `%${parsed.brand}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as any[])
    .map((row) =>
      normalizeCatalogRow({
        ...row,
        qty_on_hand: readQtyOnHand(row.inventory),
        image_url: row.sku_image_embeddings?.[0]?.image_url ?? null,
      })
    )
    // Hide out-of-stock SKUs (null = no inventory row; storefront cart treats it as 0 too).
    .filter((row) => (row.qty_on_hand ?? 0) > 0)
    .map((row) => ({
      row,
      score: scoreCatalogItem(row, parsed),
    }))
    .filter((x) => x.score >= getMinimumScore(parsed))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((x) => x.row);
}

/**
 * qty_on_hand from the embedded `inventory` relation. PostgREST returns an object
 * when skus -> inventory is one-to-one, and an array otherwise; accept both.
 */
function readQtyOnHand(inventory: unknown): number | null {
  const row = Array.isArray(inventory) ? inventory[0] : inventory;
  const qty = (row as { qty_on_hand?: unknown } | null | undefined)?.qty_on_hand;
  return typeof qty === "number" && Number.isFinite(qty) ? qty : null;
}

function buildProductUrl(productId: string) {
  const base = (process.env.STOREFRONT_BASE_URL || "https://hijibjib.com").replace(/\/$/, "");
  return `${base}/products/${productId}`;
}

/**
 * Load admin-configured product button settings. Falls back to defaults
 * (link button only, same as before) when the table/row is missing.
 */
async function loadLineReplySettings(
  supabase: ReturnType<typeof createSupabaseAdminClient>
): Promise<LineReplySettings> {
  const { data, error } = await supabase
    .from("line_reply_settings")
    .select(
      "button_mode,link_label,link_target,cart_quantity,message_label,message_template,reply_enabled,reply_template,result_footer_enabled,result_footer_template"
    )
    .eq("id", "default")
    .maybeSingle();
  if (error) {
    console.error("[line/webhook] load line_reply_settings failed", error);
    return DEFAULT_LINE_REPLY_SETTINGS;
  }
  return normalizeLineReplySettings(data);
}

function isLineAutoReplyEnabled() {
  const value = (process.env.LINE_WEBHOOK_AUTO_REPLY ?? "true").trim().toLowerCase();
  return !["0", "false", "off", "no"].includes(value);
}

function isLineSearchDebugEnabled() {
  const value = (process.env.LINE_WEBHOOK_SEARCH_DEBUG ?? "false").trim().toLowerCase();
  return ["1", "true", "on", "yes"].includes(value);
}

function logLineSearchDebug(input: {
  text: string;
  lineUserId: string;
  parsed: ParsedQuery;
  items: NormalizedCatalogRow[];
}) {
  if (!isLineSearchDebugEnabled()) return;

  const { text, lineUserId, parsed, items } = input;
  const ranked = items.map((row, index) => ({
    rank: index + 1,
    score: scoreCatalogItem(row, parsed),
    product_id: row.products?.id ?? null,
    brand: row.products?.brand ?? null,
    product_name: row.products?.name ?? null,
    car_brand_name: row.products?.car_brand_name ?? null,
    car_model_name: row.products?.car_model_name ?? null,
    size: row.size_text,
    price: row.price,
    stock: row.qty_on_hand
  }));

  console.info(
    "[line/webhook][search-debug]",
    JSON.stringify(
      {
        line_user_id: lineUserId,
        input_text: text,
        parsed,
        result_count: items.length,
        ranked
      },
      null,
      2
    )
  );
}

async function replyWithQuickMenu(input: {
  accessToken: string;
  replyToken: string;
}) {
  const { accessToken, replyToken } = input;

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text: "เลือกเมนูด้านล่าง",
          quickReply: {
            items: [
              {
                type: "action",
                action: {
                  type: "message",
                  label: "สอบถามยาง",
                  text: "สอบถามยาง",
                },
              },
              {
                type: "action",
                action: {
                  type: "message",
                  label: "นัดหมาย",
                  text: "ต้องการนัดหมาย",
                },
              },
              {
                type: "action",
                action: {
                  type: "message",
                  label: "ติดต่อแอดมิน",
                  text: "ติดต่อแอดมิน",
                },
              },
            ],
          },
        },
      ],
    }),
  });
}

async function replyWithTireSearchGuide(input: {
  accessToken: string;
  replyToken: string;
}) {
  const { accessToken, replyToken } = input;

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text: "พิมพ์ได้ทั้ง \"ขนาดยาง\" หรือ \"รุ่นรถ + ยี่ห้อยาง\"\n\nตัวอย่าง:\n• 195/65/r15\n• yaris austone",
          quickReply: {
            items: [
              {
                type: "action",
                action: {
                  type: "message",
                  label: "ลองค้นหา 195/65/r15",
                  text: "195/65/r15",
                },
              },
              {
                type: "action",
                action: {
                  type: "message",
                  label: "ลองค้นหา yaris austone",
                  text: "yaris austone",
                },
              },
            ],
          },
        },
      ],
    }),
  });
}

async function replyWithSearchResult(input: {
  accessToken: string;
  replyToken: string;
  items: NormalizedCatalogRow[];
  parsed: ParsedQuery;
  replySettings: LineReplySettings;
}) {
  const { accessToken, replyToken, items, parsed, replySettings } = input;
  const storefrontBase = (process.env.STOREFRONT_BASE_URL || "https://hijibjib.com").replace(/\/$/, "");

  if (isLineAutoReplyEnabled()) {
    if (items.length === 0) {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          replyToken,
          messages: [
            {
              type: "flex",
              altText: "ไม่พบสินค้าที่ตรงคำค้น",
              contents: {
                type: "bubble",
                size: "mega",
                body: {
                  type: "box",
                  layout: "vertical",
                  spacing: "md",
                  contents: [
                    {
                      type: "text",
                      text: "ไม่พบสินค้าที่ตรงคำค้น",
                      weight: "bold",
                      size: "lg",
                      color: "#ffa202",
                      wrap: true
                    },
                    {
                      type: "text",
                      text: "ลองค้นหาใหม่ด้วยตัวอย่างด้านล่าง",
                      size: "sm",
                      color: "#475569",
                      wrap: true
                    },
                    {
                      type: "box",
                      layout: "vertical",
                      spacing: "sm",
                      margin: "sm",
                      backgroundColor: "#f8fafc",
                      cornerRadius: "12px",
                      paddingAll: "10px",
                      contents: [
                        { type: "text", text: "• Michelin 255/40r21", size: "sm", color: "#0f172a", wrap: true },
                        { type: "text", text: "• Toyota Camry", size: "sm", color: "#0f172a", wrap: true },
                        { type: "text", text: "• Fortuner Michelin", size: "sm", color: "#0f172a", wrap: true }
                      ]
                    }
                  ]
                },
                footer: {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",
                  contents: [
                    {
                      type: "button",
                      style: "primary",
                      color: "#16a34a",
                      action: {
                        type: "uri",
                        label: "ค้นหาสินค้า",
                        uri: `${storefrontBase}/search`
                      }
                    },
                    {
                      type: "button",
                      style: "link",
                      action: {
                        type: "uri",
                        label: "กลับหน้าเว็บไซต์",
                        uri: storefrontBase
                      }
                    }
                  ]
                }
              }
            },
            {
              type: "text",
              text: "พิมพ์ยี่ห้อยาง/ไซส์ หรือยี่ห้อรถ/รุ่นรถ แล้วระบบจะช่วยแนะนำสินค้าให้อัตโนมัติ"
            },
          ]
        })
      });
      return;
    }

  }


  const bubbles = items.map((item) => {
    const productId = item.id as string;
    const templateValues = buildTemplateValues(item);
    const title = templateValues.title;
    const badges = [
      item.products?.is_hot ? "HOT" : "",
      item.products?.is_new ? "NEW" : "",
      item.products?.is_promotion ? "PROMO" : ""
    ].filter(Boolean).join(" · ");
    const priceText = templateValues.price;
    const oldPriceText =
      item.old_price != null && item.old_price > (item.price ?? 0)
        ? `จาก ฿${Number(item.old_price).toLocaleString("th-TH")}`
        : "";
    const stockText =
      item.qty_on_hand != null
        ? item.qty_on_hand > 0
          ? `คงเหลือ ${item.qty_on_hand.toLocaleString("th-TH")} ชิ้น`
          : "สินค้าหมดชั่วคราว"
        : "เช็กสต๊อกกับแอดมิน";
    return {
      type: "bubble",
      hero: item.image_url
        ? {
          type: "image",
          url: item.image_url,
          size: "full",
          // Square + fit: tire photos are mostly square, so show the whole tire instead of cropping it.
          aspectRatio: "1:1",
          aspectMode: "fit",
          backgroundColor: "#FFFFFF"
        }
        : undefined,
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: item.size_text, size: "md", color: "#334155", weight: "bold", wrap: true },
          { type: "text", text: title, size: "sm", wrap: true },
          badges ? { type: "text", text: badges, size: "xs", color: "#ea580c", wrap: true } : null,
          { type: "text", text: priceText, size: "md", weight: "bold", color: "#16a34a", wrap: true },
          oldPriceText ? { type: "text", text: oldPriceText, size: "xs", color: "#94a3b8", wrap: true } : null,
          { type: "text", text: stockText, size: "xs", color: "#64748b", wrap: true }
        ].filter(Boolean)
      },
      styles: {
        footer: {
          separator: true
        }
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: buildLineProductButtons(
          replySettings,
          templateValues,
          productId,
          resolveLinkButtonUrl(replySettings, {
            storefrontBase,
            skuId: productId,
            productUrl: templateValues.url,
            nonce: crypto.randomBytes(6).toString("base64url")
          })
        )
      }
    };
  });

  const searchHint = [
    parsed.brand,
    parsed.size?.label,
    ...parsed.keywords,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const searchUrl = `${storefrontBase}/search${searchHint ? `?q=${encodeURIComponent(searchHint)}` : ""}`;
  const footerText = replySettings.result_footer_enabled
    ? renderLineFooterTemplate(replySettings.result_footer_template, {
      search_url: searchUrl,
      home_url: storefrontBase,
      keyword: searchHint
    })
    : null;

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "flex",
          altText: "รายการยางที่ค้นพบ",
          contents: {
            type: "carousel",
            contents: bubbles
          }
        },
        ...(footerText ? [{ type: "text", text: footerText }] : [])
      ]
    })
  });
}

export async function POST(request: Request) {
  try {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    if (!channelSecret) {
      return NextResponse.json({ error: "Missing LINE_CHANNEL_SECRET" }, { status: 500 });
    }

    const signature = request.headers.get("x-line-signature") || "";
    const bodyText = await request.text();
    const expected = crypto.createHmac("SHA256", channelSecret).update(bodyText).digest("base64");

    if (signature !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(bodyText) as { events?: Array<Record<string, unknown>> };
    const events = Array.isArray(payload?.events) ? payload.events : [];

    if (events.length === 0) {
      return NextResponse.json({ success: true });
    }

    const supabase = createSupabaseAdminClient();
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    const lineMessageRows: Array<Record<string, unknown>> = [];
    const eventRows: Array<Record<string, unknown>> = [];
    const friendUpdates = new Map<string, { line_is_friend: boolean; timestampIso: string }>();

    events.forEach((event) => {
      const source = (event.source ?? {}) as Record<string, unknown>;
      const message = (event.message ?? {}) as Record<string, unknown>;
      const eventType = String(event.type ?? "");
      const lineUserId = typeof source.userId === "string" ? source.userId : null;
      const sourceType = typeof source.type === "string" ? source.type : null;
      const groupId = typeof source.groupId === "string" ? source.groupId : null;
      const roomId = typeof source.roomId === "string" ? source.roomId : null;
      const webhookEventId = typeof event.webhookEventId === "string" ? event.webhookEventId : null;
      const timestampMs = typeof event.timestamp === "number" ? event.timestamp : null;
      const timestampIso = timestampMs ? new Date(timestampMs).toISOString() : new Date().toISOString();

      if (eventType === "follow" && lineUserId) {
        friendUpdates.set(lineUserId, { line_is_friend: true, timestampIso });
      }
      if (eventType === "unfollow" && lineUserId) {
        friendUpdates.set(lineUserId, { line_is_friend: false, timestampIso });
      }

      const messageType = typeof message.type === "string" ? message.type : null;
      const messageId = typeof message.id === "string" ? message.id : null;
      const messageText = typeof message.text === "string" ? message.text : null;

      eventRows.push({
        webhook_event_id: webhookEventId,
        event_type: eventType || "unknown",
        mode: typeof event.mode === "string" ? event.mode : null,
        timestamp_ms: timestampMs,
        line_user_id: lineUserId,
        source_type: sourceType,
        source_group_id: groupId,
        source_room_id: roomId,
        message_id: messageId,
        message_type: messageType,
        message_text: messageText,
        message_payload: Object.keys(message).length > 0 ? message : null,
        raw_event: event
      });

      if (eventType === "message") {
        lineMessageRows.push({
          direction: "in",
          line_user_id: lineUserId,
          line_group_id: groupId,
          line_room_id: roomId,
          message_type: messageType || "text",
          message: messageText,
          raw: event
        });
      }
    });

    if (accessToken && isLineAutoReplyEnabled()) {
      let replySettings: LineReplySettings | null = null;
      for (const event of events) {
        const eventType = String(event.type ?? "");
        if (eventType !== "message") continue;
        const replyToken = typeof event.replyToken === "string" ? event.replyToken : "";
        const source = (event.source ?? {}) as Record<string, unknown>;
        const lineUserId = typeof source.userId === "string" ? source.userId : "unknown";
        const message = (event.message ?? {}) as Record<string, unknown>;
        const messageType = typeof message.type === "string" ? message.type : "";
        const text = typeof message.text === "string" ? message.text : "";
        if (!replyToken || messageType !== "text" || !text.trim()) continue;
        const normalizedText = text.trim().toLowerCase();

        if (normalizedText === "สอบถามยาง") {
          try {
            await replyWithTireSearchGuide({
              accessToken,
              replyToken
            });
          } catch (guideReplyErr) {
            console.error("[line/webhook] tire-search guide reply failed", guideReplyErr);
          }
          continue;
        }

        const parsed = parseCustomerText(text);
        const scope = classifySearchScope(text, parsed);

        if (!scope.inScope || scope.confidence < 0.75 || isTooShortForSearch(parsed)) {
          console.info("[line/webhook][quick-reply-menu]", {
            text,
            parsed,
            scope
          });

        /*   try {
            await replyWithQuickMenu({
              accessToken,
              replyToken
            });
          } catch (quickReplyErr) {
            console.error("[line/webhook] quick-reply menu failed", quickReplyErr);
          } */

          continue;
        }

        try {
          const items = await searchCatalogItems(supabase, parsed);
          // Loaded lazily once per webhook call, only when a product reply is needed.
          replySettings ??= await loadLineReplySettings(supabase);
          logLineSearchDebug({
            text,
            lineUserId,
            parsed,
            items
          });
          await replyWithSearchResult({
            accessToken,
            replyToken,
            items,
            parsed,
            replySettings
          });
        } catch (replyErr) {
          console.error("[line/webhook] auto-reply search failed", replyErr);
        }
      }
    }

    let postbackReplySettings: LineReplySettings | null = null;
    for (const event of events) {
      if (String(event.type ?? "") !== "postback") continue;
      const postback = (event.postback ?? {}) as Record<string, unknown>;
      const skuId = parseOrderPostbackData(postback.data);
      if (!skuId) continue;
      try {
        postbackReplySettings ??= await loadLineReplySettings(supabase);
        const replySettings = postbackReplySettings;
        lineMessageRows.push(
          ...(await handleOrderPostback({ supabase, accessToken, event, skuId, replySettings }))
        );
      } catch (postbackErr) {
        console.error("[line/webhook] order postback failed", postbackErr);
      }
    }

    if (lineMessageRows.length > 0) {
      const { error } = await supabase.from("line_messages").insert(lineMessageRows);
      if (error) {
        console.error("[line/webhook] line_messages insert failed", error);
      }
    }

    const insertedEventMap = new Map<string, number>();
    if (eventRows.length > 0) {
      const { data: insertedEvents, error: insertedEventError } = await supabase
        .from("line_webhook_events")
        .insert(eventRows)
        .select("id,webhook_event_id");
      if (insertedEventError) {
        console.error("[line/webhook] line_webhook_events insert failed", insertedEventError);
      } else if (insertedEvents) {
        insertedEvents.forEach((row) => {
          if (row.webhook_event_id) insertedEventMap.set(row.webhook_event_id, row.id);
        });
      }
    }

    const mediaRows: Array<Record<string, unknown>> = [];
    events.forEach((event) => {
      const source = (event.source ?? {}) as Record<string, unknown>;
      const message = (event.message ?? {}) as Record<string, unknown>;
      const eventType = String(event.type ?? "");
      if (eventType !== "message") return;
      const messageType = typeof message.type === "string" ? message.type : "";
      const isMediaType = ["image", "video", "audio", "file", "sticker"].includes(messageType);
      if (!isMediaType) return;

      const webhookEventId = typeof event.webhookEventId === "string" ? event.webhookEventId : null;
      const mappedWebhookId = webhookEventId ? insertedEventMap.get(webhookEventId) : null;
      if (!mappedWebhookId) return;

      mediaRows.push({
        webhook_event_id: mappedWebhookId,
        message_id: typeof message.id === "string" ? message.id : `missing-${mappedWebhookId}`,
        line_user_id: typeof source.userId === "string" ? source.userId : null,
        media_type: messageType,
        content_type: typeof message.contentProvider === "string" ? message.contentProvider : null,
        storage_bucket: null,
        storage_path: null,
        file_size_bytes: typeof message.fileSize === "number" ? message.fileSize : null,
        file_name: typeof message.fileName === "string" ? message.fileName : null,
        sticker_package_id: typeof message.packageId === "string" ? message.packageId : null,
        sticker_id: typeof message.stickerId === "string" ? message.stickerId : null,
        sticker_keywords: Array.isArray(message.keywords) ? message.keywords : null,
        raw_payload: message
      });
    });
    if (mediaRows.length > 0) {
      const { error } = await supabase.from("line_webhook_media").upsert(mediaRows, { onConflict: "message_id" });
      if (error) {
        console.error("[line/webhook] line_webhook_media upsert failed", error);
      }
    }

    for (const [lineUserId, update] of friendUpdates.entries()) {
      const { error } = await supabase
        .from("customes")
        .update({
          line_is_friend: update.line_is_friend,
          line_friendship_checked_at: update.timestampIso,
          line_followed_at: update.line_is_friend ? update.timestampIso : undefined,
          line_unfollowed_at: !update.line_is_friend ? update.timestampIso : undefined
        })
        .eq("line_user_id", lineUserId);
      if (error) {
        console.error("[line/webhook] customes friendship update failed", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[line/webhook] unhandled error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
