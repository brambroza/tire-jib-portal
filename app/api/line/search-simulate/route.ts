import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabaseAdmin";

/* type ParsedQuery = {
  brand: string | null;
  sizes: string[];
  keywords: string[];
  rawTokens: string[];
};
 */
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

function normalizeKeywordToken(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");
}

function toSearchText(input: string | null | undefined) {
  return normalizeKeywordToken(input ?? "");
}

function extractSizeCandidates(raw: string) {
  const matches = raw.match(/\d{3}\s*\/\s*\d{2}\s*(?:\/|R)\s*\d{2}\s*C?|\d{3}\s*R\s*\d{2}\s*C?/gi) ?? [];
  return Array.from(
    new Set(matches.map((v) => normalizeSizeToken(v)).filter((v): v is string => Boolean(v)))
  );
}

/* function parseCustomerText(text: string): ParsedQuery {
  const raw = text.trim();
  const sizes = extractSizeCandidates(raw);

  const lower = raw.toLowerCase();
  const knownBrands = [
    "austone", "continental", "chengshan", "hixih", "michelin", "bridgestone", "goodyear",
    "pirelli", "yokohama", "toyo", "dunlop", "maxxis", "nexen", "hankook", "otani", "deestone"
  ];
  const brand = knownBrands.find((b) => lower.includes(b)) ?? null;
  const tokens = (raw.toLowerCase().match(/[a-z0-9ก-๙-]{2,}/g) ?? []).filter((token) => {
    if (knownBrands.includes(token)) return false;
    if (/^\d+$/.test(token)) return false;
    if (/^\d{3}$/.test(token)) return false;
    if (normalizeSizeToken(token)) return false;
    return !["ครับ", "ค่ะ", "คะ", "สนใจ", "ยาง", "ขอ", "ราคา", "มีไหม", "หน่อย"].includes(token);
  });
  const keywords = Array.from(new Set(tokens.map((t) => t.trim()).filter(Boolean))).slice(0, 8);
  const rawTokens = Array.from(
    new Set((raw.toLowerCase().match(/[a-z0-9ก-๙-]{2,}/g) ?? []).map((t) => t.trim()).filter(Boolean))
  ).slice(0, 12);

  return { brand, sizes, keywords, rawTokens };
} */

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

/* function scoreCatalogItem(item: NormalizedCatalogRow, parsed: ParsedQuery) {
  const itemBrand = toSearchText(item.products?.brand);
  const itemSizeNorm = normalizeSizeToken(item.size_label ?? "") ?? "";
  const carBrandName = toSearchText(item.products?.car_brand_name);
  const carModelName = toSearchText(item.products?.car_model_name);
  const productName = toSearchText(item.products?.name);
  const allText = [itemBrand, carBrandName, carModelName, productName].join(" ");
  let score = 0;
  if (parsed.brand && itemBrand.includes(toSearchText(parsed.brand))) score += 8;
  if (parsed.size?.length > 0 && parsed.sizes?.includes(itemSizeNorm)) score += 6;
  parsed.keywords.forEach((kw) => {
    const normalizedKw = toSearchText(kw);
    if (!normalizedKw) return;
    if (carModelName.includes(normalizedKw)) score += 6;
    else if (carBrandName.includes(normalizedKw)) score += 5;
    else if (productName.includes(normalizedKw)) score += 5;
    else if (allText.includes(normalizedKw)) score += 2;
  });

  parsed.rawTokens.forEach((token) => {
    const normalized = toSearchText(token);
    if (!normalized || normalized.length < 3) return;
    if (allText.includes(normalized)) score += 1;
  });

  if ((item.qty_on_hand ?? 0) > 0) score += 0.5;
  if (item.products?.is_promotion) score += 0.3;
  if (item.products?.is_hot) score += 0.2;

  return score;
} */

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

/* async function searchCatalogItems(supabase: ReturnType<typeof createSupabaseAdminClient>, parsed: ParsedQuery) {
  const { data, error } = await supabase
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
      car_year_from,
      car_year_to,
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
    .eq("products.active", true)
    .eq("prices.group_id", "b2a66855-3693-4ff1-91d4-fa49c20de5a6")
    .limit(500);
  if (error) throw error;

  const rawRows = ((data ?? []) as unknown as Array<
    Omit<CatalogRow, "qty_on_hand" | "image_url"> & {
      inventory?: { qty_on_hand: number | null }[] | null;
      sku_image_embeddings?: { image_url: string | null }[] | null;
    }
  >).map((row) => ({
    ...row,
    qty_on_hand: row.inventory?.[0]?.qty_on_hand ?? null,
    image_url: row.sku_image_embeddings?.[0]?.image_url ?? null
  }));

  const ranked = rawRows
    .map((row) => normalizeCatalogRow(row))
    .filter((row) => row.products?.id)
    .map((row) => ({ row, score: scoreCatalogItem(row, parsed) }))
    .filter((entry) => entry.score > 0 || parsed.sizes.length === 0)
    .sort((a, b) => b.score - a.score);

  return ranked;
}
 */

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
    .map((row) => {
      const normalized = normalizeCatalogRow({
        ...row,
        qty_on_hand: row.inventory?.[0]?.qty_on_hand ?? null,
        image_url: row.sku_image_embeddings?.[0]?.image_url ?? null,
      });

      return {
        row: normalized,
        score: scoreCatalogItem(normalized, parsed),
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }



    const parsed = parseCustomerText(text);

    console.log("parsed", parsed);
    const supabase = createSupabaseAdminClient();
    const ranked = await searchCatalogItems(supabase, parsed);
    const top5 = ranked.slice(0, 5);

    return NextResponse.json({
      input_text: text,
      parsed,
      total_matches: ranked.length,
      top5: top5.map((entry, index) => ({
        rank: index + 1,
        score: entry.score,
        ...entry.row
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
