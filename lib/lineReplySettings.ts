/**
 * LINE auto-reply settings: controls the footer button(s) under each product card
 * that the webhook sends back to customers.
 *
 * Kept free of runtime imports so it can be used by the webhook (server),
 * the admin page (client) and unit tests alike.
 */

export type LineProductButtonMode = "link" | "message" | "both";
/** Where the link button goes: storefront quick-order (adds to cart, opens /cart) or product page. */
export type LineLinkTarget = "cart" | "product";

export type LineReplySettings = {
  button_mode: LineProductButtonMode;
  link_label: string;
  link_target: LineLinkTarget;
  /** Quantity added to cart when link_target = "cart". */
  cart_quantity: number;
  message_label: string;
  message_template: string;
  /** Auto-reply sent by the bot after the customer taps the message button. */
  reply_enabled: boolean;
  reply_template: string;
  /** Text message sent after the product carousel (links to full search / home). */
  result_footer_enabled: boolean;
  result_footer_template: string;
};

/** Placeholder tokens for `result_footer_template`. */
export const LINE_FOOTER_PLACEHOLDERS: { token: string; description: string }[] = [
  { token: "{search_url}", description: "ลิงก์หน้าค้นหาบนเว็บ ตามคำที่ลูกค้าพิมพ์" },
  { token: "{home_url}", description: "ลิงก์หน้าแรกเว็บไซต์" },
  { token: "{keyword}", description: "คำค้นที่ระบบอ่านได้ (ยี่ห้อ/ไซส์)" }
];

export type LineFooterValues = {
  search_url: string;
  home_url: string;
  keyword: string;
};

/** Placeholder tokens admins can use inside `message_template`. */
export const LINE_TEMPLATE_PLACEHOLDERS: { token: string; description: string }[] = [
  { token: "{title}", description: "ยี่ห้อ + ชื่อรุ่นสินค้า" },
  { token: "{brand}", description: "ยี่ห้อ" },
  { token: "{name}", description: "ชื่อรุ่น" },
  { token: "{size}", description: "ขนาดยาง" },
  { token: "{price}", description: "ราคา (เช่น ฿2,500 หรือ สอบถามราคา)" },
  { token: "{url}", description: "ลิงก์หน้าสินค้า" }
];

/** LINE flex button label limit (characters). */
export const LINE_BUTTON_LABEL_MAX = 20;
/** LINE postback displayText limit (characters). */
export const LINE_MESSAGE_TEXT_MAX = 300;
/** Max length for the bot auto-reply (LINE allows 5000; kept short for chat readability). */
export const LINE_REPLY_TEXT_MAX = 1000;
/** Allowed range for the quick-order quantity. */
export const LINE_CART_QTY_MIN = 1;
export const LINE_CART_QTY_MAX = 8;

/** Postback `data` prefix identifying the "order via chat" button. */
const ORDER_POSTBACK_ACTION = "order";

export const DEFAULT_LINE_REPLY_SETTINGS: LineReplySettings = {
  // Default: "สั่งซื้อสินค้า" adds to the storefront cart and opens /cart;
  // "สอบถามแอดมิน" posts into chat so the bot can auto-reply.
  button_mode: "both",
  link_label: "สั่งซื้อสินค้า",
  link_target: "cart",
  cart_quantity: 1,
  message_label: "สอบถามแอดมิน",
  message_template: "สอบถามสินค้า {title} ขนาด {size} ราคา {price}",
  reply_enabled: true,
  reply_template: "ได้รับข้อความเรื่อง {title} ขนาด {size} แล้วค่ะ\nแอดมินจะตอบกลับโดยเร็วที่สุด",
  result_footer_enabled: true,
  result_footer_template: "ดูทั้งหมด/สั่งซื้อ: {search_url}\nกลับหน้าเว็บ: {home_url}"
};

const BUTTON_MODES: LineProductButtonMode[] = ["link", "message", "both"];
const LINK_TARGETS: LineLinkTarget[] = ["cart", "product"];

/**
 * Coerce an untrusted DB row / request body into valid settings,
 * falling back to defaults for anything missing or invalid.
 * @param input raw object (DB row or JSON body)
 * @returns sanitized settings, always safe to send to LINE
 */
export function normalizeLineReplySettings(input: unknown): LineReplySettings {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const mode = BUTTON_MODES.includes(raw.button_mode as LineProductButtonMode)
    ? (raw.button_mode as LineProductButtonMode)
    : DEFAULT_LINE_REPLY_SETTINGS.button_mode;

  return {
    button_mode: mode,
    link_target: LINK_TARGETS.includes(raw.link_target as LineLinkTarget)
      ? (raw.link_target as LineLinkTarget)
      : DEFAULT_LINE_REPLY_SETTINGS.link_target,
    cart_quantity: isValidCartQuantity(raw.cart_quantity)
      ? (raw.cart_quantity as number)
      : DEFAULT_LINE_REPLY_SETTINGS.cart_quantity,
    link_label: cleanLabel(raw.link_label, DEFAULT_LINE_REPLY_SETTINGS.link_label),
    message_label: cleanLabel(raw.message_label, DEFAULT_LINE_REPLY_SETTINGS.message_label),
    message_template: cleanTemplate(raw.message_template, DEFAULT_LINE_REPLY_SETTINGS.message_template),
    reply_enabled:
      typeof raw.reply_enabled === "boolean" ? raw.reply_enabled : DEFAULT_LINE_REPLY_SETTINGS.reply_enabled,
    reply_template: cleanTemplate(raw.reply_template, DEFAULT_LINE_REPLY_SETTINGS.reply_template, LINE_REPLY_TEXT_MAX),
    result_footer_enabled:
      typeof raw.result_footer_enabled === "boolean"
        ? raw.result_footer_enabled
        : DEFAULT_LINE_REPLY_SETTINGS.result_footer_enabled,
    result_footer_template: cleanTemplate(
      raw.result_footer_template,
      DEFAULT_LINE_REPLY_SETTINGS.result_footer_template,
      LINE_REPLY_TEXT_MAX
    )
  };
}

/**
 * Validate settings submitted by an admin. Returns a Thai error message or null.
 * @param input raw form values
 */
export function validateLineReplySettings(input: Partial<LineReplySettings>): string | null {
  if (!BUTTON_MODES.includes(input.button_mode as LineProductButtonMode)) {
    return "โหมดปุ่มไม่ถูกต้อง";
  }
  const linkLabel = (input.link_label ?? "").trim();
  const messageLabel = (input.message_label ?? "").trim();
  const template = (input.message_template ?? "").trim();
  const usesLink = input.button_mode !== "message";
  if (usesLink && !LINK_TARGETS.includes(input.link_target as LineLinkTarget)) {
    return "ปลายทางของปุ่มลิงก์ไม่ถูกต้อง";
  }
  if (usesLink && input.link_target === "cart" && !isValidCartQuantity(input.cart_quantity)) {
    return `จำนวนที่ใส่ตะกร้าต้องอยู่ระหว่าง ${LINE_CART_QTY_MIN}-${LINE_CART_QTY_MAX}`;
  }
  const usesMessage = input.button_mode !== "link";

  if (usesLink && !linkLabel) return "กรุณากรอกชื่อปุ่มลิงก์";
  if (usesMessage && !messageLabel) return "กรุณากรอกชื่อปุ่มส่งข้อความ";
  if (usesMessage && !template) return "กรุณากรอกข้อความที่จะส่ง";
  if ([...linkLabel].length > LINE_BUTTON_LABEL_MAX || [...messageLabel].length > LINE_BUTTON_LABEL_MAX) {
    return `ชื่อปุ่มยาวได้ไม่เกิน ${LINE_BUTTON_LABEL_MAX} ตัวอักษร`;
  }
  if ([...template].length > LINE_MESSAGE_TEXT_MAX) {
    return `ข้อความยาวได้ไม่เกิน ${LINE_MESSAGE_TEXT_MAX} ตัวอักษร`;
  }
  const replyTemplate = (input.reply_template ?? "").trim();
  if (usesMessage && input.reply_enabled && !replyTemplate) return "กรุณากรอกข้อความตอบกลับ";
  if ([...replyTemplate].length > LINE_REPLY_TEXT_MAX) {
    return `ข้อความตอบกลับยาวได้ไม่เกิน ${LINE_REPLY_TEXT_MAX} ตัวอักษร`;
  }
  const footerTemplate = (input.result_footer_template ?? "").trim();
  if (input.result_footer_enabled && !footerTemplate) return "กรุณากรอกข้อความท้ายผลค้นหา";
  if ([...footerTemplate].length > LINE_REPLY_TEXT_MAX) {
    return `ข้อความท้ายผลค้นหายาวได้ไม่เกิน ${LINE_REPLY_TEXT_MAX} ตัวอักษร`;
  }
  return null;
}

export type LineTemplateValues = {
  title: string;
  brand: string;
  name: string;
  size: string;
  price: string;
  url: string;
};

/**
 * Replace `{token}` placeholders with product values. Unknown tokens are left as-is.
 * @param template admin-defined template
 * @param values product values
 * @param maxChars output cap (defaults to the postback displayText limit)
 */
export function renderLineMessageTemplate(
  template: string,
  values: LineTemplateValues,
  maxChars: number = LINE_MESSAGE_TEXT_MAX
): string {
  const rendered = template
    .replace(/\{(title|brand|name|size|price|url)\}/g, (_, key: keyof LineTemplateValues) => values[key] ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return truncateChars(rendered || DEFAULT_LINE_REPLY_SETTINGS.message_label, maxChars);
}

/**
 * Render the text sent after the product carousel.
 * Returns null when the rendered text is empty (caller should skip sending).
 * @param template admin-defined template
 * @param values search/home links and keyword
 */
export function renderLineFooterTemplate(template: string, values: LineFooterValues): string | null {
  const rendered = template
    .replace(/\{(search_url|home_url|keyword)\}/g, (_, key: keyof LineFooterValues) => values[key] ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return rendered ? truncateChars(rendered, LINE_REPLY_TEXT_MAX) : null;
}

/**
 * Build postback `data` for the "order via chat" button.
 * @param skuId product SKU id shown on the card
 */
export function buildOrderPostbackData(skuId: string): string {
  return `action=${ORDER_POSTBACK_ACTION}&sku=${encodeURIComponent(skuId)}`;
}

/**
 * Parse postback `data` from a webhook event. Returns the SKU id for
 * "order via chat" taps, or null for anything else / malformed input.
 * @param data raw `event.postback.data`
 */
export function parseOrderPostbackData(data: unknown): string | null {
  if (typeof data !== "string" || data.length > 300) return null;
  const params = new URLSearchParams(data);
  if (params.get("action") !== ORDER_POSTBACK_ACTION) return null;
  const skuId = params.get("sku")?.trim() ?? "";
  return /^[0-9a-zA-Z-]{1,64}$/.test(skuId) ? skuId : null;
}

/**
 * Storefront quick-order link: adds the SKU to the cart (after LINE login if needed)
 * and opens /cart. `nonce` lets the storefront ignore repeat taps of the same card.
 * @param storefrontBase e.g. https://hijibjib.com (no trailing slash)
 * @param skuId SKU id
 * @param quantity items to add
 * @param nonce short random id per card
 */
export function buildQuickOrderUrl(storefrontBase: string, skuId: string, quantity: number, nonce: string): string {
  const params = new URLSearchParams({ sku: skuId, qty: String(quantity), n: nonce });
  return `${storefrontBase.replace(/\/$/, "")}/line/order?${params.toString()}`;
}

/**
 * Resolve the link button URL from settings.
 * @param settings normalized settings
 * @param input storefront base, SKU, product page URL and nonce
 */
export function resolveLinkButtonUrl(
  settings: LineReplySettings,
  input: { storefrontBase: string; skuId: string; productUrl: string; nonce: string }
): string {
  return settings.link_target === "cart"
    ? buildQuickOrderUrl(input.storefrontBase, input.skuId, settings.cart_quantity, input.nonce)
    : input.productUrl;
}

/**
 * Build the flex footer button list for one product card.
 * The chat button is a postback (shows `message_template` as the customer's message)
 * so the webhook knows which SKU was tapped and can send the admin's auto-reply.
 * @param settings normalized settings
 * @param values product values ({url} token = product page)
 * @param skuId SKU id embedded in the postback data
 * @param linkUrl URL for the link button (see resolveLinkButtonUrl); defaults to the product page
 */
export function buildLineProductButtons(
  settings: LineReplySettings,
  values: LineTemplateValues,
  skuId: string,
  linkUrl: string = values.url
) {
  const buttons: Record<string, unknown>[] = [];
  const showLink = settings.button_mode !== "message";
  const showMessage = settings.button_mode !== "link";

  if (showLink) {
    buttons.push({
      type: "button",
      style: "primary",
      color: "#16a34a",
      action: { type: "uri", label: settings.link_label, uri: linkUrl }
    });
  }
  if (showMessage) {
    buttons.push({
      type: "button",
      // Primary when it is the only button; secondary when sitting under the link button.
      style: showLink ? "secondary" : "primary",
      ...(showLink ? {} : { color: "#16a34a" }),
      action: {
        type: "postback",
        label: settings.message_label,
        data: buildOrderPostbackData(skuId),
        displayText: renderLineMessageTemplate(settings.message_template, values)
      }
    });
  }
  return buttons;
}

function isValidCartQuantity(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= LINE_CART_QTY_MIN && (value as number) <= LINE_CART_QTY_MAX;
}

function cleanLabel(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? truncateChars(text, LINE_BUTTON_LABEL_MAX) : fallback;
}

function cleanTemplate(value: unknown, fallback: string, maxChars: number = LINE_MESSAGE_TEXT_MAX): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? truncateChars(text, maxChars) : fallback;
}

/** Truncate by code point so Thai/emoji are not split mid-character. */
function truncateChars(text: string, max: number): string {
  const chars = [...text];
  return chars.length > max ? chars.slice(0, max).join("") : text;
}
