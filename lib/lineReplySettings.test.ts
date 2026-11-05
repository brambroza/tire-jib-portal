import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLineProductButtons,
  DEFAULT_LINE_REPLY_SETTINGS,
  LINE_BUTTON_LABEL_MAX,
  LINE_MESSAGE_TEXT_MAX,
  LINE_REPLY_TEXT_MAX,
  buildOrderPostbackData,
  buildQuickOrderUrl,
  resolveLinkButtonUrl,
  normalizeLineReplySettings,
  parseOrderPostbackData,
  renderLineFooterTemplate,
  renderLineMessageTemplate,
  validateLineReplySettings,
  type LineTemplateValues
} from "./lineReplySettings.ts";

const SKU_ID = "1df52c4e-2178-400f-9cd6-cb38cf8549a7";

const VALUES: LineTemplateValues = {
  title: "Michelin PS4",
  brand: "Michelin",
  name: "PS4",
  size: "225/45R17",
  price: "฿4,500",
  url: "https://example.com/products/1"
};

test("normalize: null/garbage falls back to defaults", () => {
  assert.deepEqual(normalizeLineReplySettings(null), DEFAULT_LINE_REPLY_SETTINGS);
  assert.deepEqual(normalizeLineReplySettings("x"), DEFAULT_LINE_REPLY_SETTINGS);
  assert.equal(normalizeLineReplySettings({ button_mode: "evil" }).button_mode, "both");
});

test("normalize: blank labels fall back, long labels truncated by code point", () => {
  const long = "ก".repeat(LINE_BUTTON_LABEL_MAX + 5);
  const result = normalizeLineReplySettings({ button_mode: "both", link_label: "  ", message_label: long });
  assert.equal(result.link_label, DEFAULT_LINE_REPLY_SETTINGS.link_label);
  assert.equal([...result.message_label].length, LINE_BUTTON_LABEL_MAX);
});

test("render: replaces known tokens, keeps unknown tokens", () => {
  const text = renderLineMessageTemplate("สนใจ {title} {size} {price} {url} {foo}", VALUES);
  assert.equal(text, "สนใจ Michelin PS4 225/45R17 ฿4,500 https://example.com/products/1 {foo}");
});

test("render: empty result falls back, output capped at LINE limit", () => {
  assert.equal(renderLineMessageTemplate("   ", VALUES), DEFAULT_LINE_REPLY_SETTINGS.message_label);
  const out = renderLineMessageTemplate("{title}".repeat(100), VALUES);
  assert.equal([...out].length, LINE_MESSAGE_TEXT_MAX);
});

test("buttons: link mode = single uri button", () => {
  const settings = normalizeLineReplySettings({ button_mode: "link", link_label: "สั่งซื้อสินค้า" });
  const buttons = buildLineProductButtons(settings, VALUES, SKU_ID);
  assert.equal(buttons.length, 1);
  assert.deepEqual(buttons[0].action, { type: "uri", label: "สั่งซื้อสินค้า", uri: VALUES.url });
});

test("buttons: message mode = single primary postback button with rendered displayText", () => {
  const settings = normalizeLineReplySettings({ button_mode: "message", message_template: "ขอราคา {size}" });
  const buttons = buildLineProductButtons(settings, VALUES, SKU_ID);
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].style, "primary");
  assert.deepEqual(buttons[0].action, {
    type: "postback",
    label: "สอบถามแอดมิน",
    data: `action=order&sku=${SKU_ID}`,
    displayText: "ขอราคา 225/45R17"
  });
});

test("buttons: both mode = link primary then message secondary", () => {
  const buttons = buildLineProductButtons(normalizeLineReplySettings({ button_mode: "both" }), VALUES, SKU_ID);
  assert.deepEqual(buttons.map((b) => (b.action as { type: string }).type), ["uri", "postback"]);
  assert.equal(buttons[1].style, "secondary");
});

test("validate: errors for missing / too long fields, null when valid", () => {
  assert.equal(validateLineReplySettings({ ...DEFAULT_LINE_REPLY_SETTINGS }), null);
  assert.match(validateLineReplySettings({ button_mode: "x" as never }) ?? "", /โหมด/);
  assert.match(validateLineReplySettings({ ...DEFAULT_LINE_REPLY_SETTINGS, button_mode: "both", link_label: " " }) ?? "", /ปุ่มลิงก์/);
  assert.match(
    validateLineReplySettings({ ...DEFAULT_LINE_REPLY_SETTINGS, button_mode: "message", message_template: "" }) ?? "",
    /ข้อความ/
  );
  assert.match(
    validateLineReplySettings({ ...DEFAULT_LINE_REPLY_SETTINGS, link_label: "a".repeat(LINE_BUTTON_LABEL_MAX + 1) }) ?? "",
    /ไม่เกิน/
  );
  assert.match(
    validateLineReplySettings({
      ...DEFAULT_LINE_REPLY_SETTINGS,
      button_mode: "both",
      message_template: "a".repeat(LINE_MESSAGE_TEXT_MAX + 1)
    }) ?? "",
    /ไม่เกิน/
  );
  // message-only mode ignores empty link label
  assert.equal(validateLineReplySettings({ ...DEFAULT_LINE_REPLY_SETTINGS, button_mode: "message", link_label: "" }), null);
});

test("postback: round-trips sku id, rejects other/malformed data", () => {
  assert.equal(parseOrderPostbackData(buildOrderPostbackData(SKU_ID)), SKU_ID);
  assert.equal(parseOrderPostbackData("action=other&sku=" + SKU_ID), null);
  assert.equal(parseOrderPostbackData("action=order&sku="), null);
  assert.equal(parseOrderPostbackData("action=order&sku=1;drop table"), null);
  assert.equal(parseOrderPostbackData(123), null);
  assert.equal(parseOrderPostbackData("a".repeat(301)), null);
});

test("reply: defaults enabled, normalize keeps admin text, render honours reply cap", () => {
  assert.equal(normalizeLineReplySettings(null).reply_enabled, true);
  const settings = normalizeLineReplySettings({ reply_enabled: false, reply_template: "ขอบคุณค่ะ {title}" });
  assert.equal(settings.reply_enabled, false);
  assert.equal(renderLineMessageTemplate(settings.reply_template, VALUES, LINE_REPLY_TEXT_MAX), "ขอบคุณค่ะ Michelin PS4");
  const long = renderLineMessageTemplate("{title}".repeat(200), VALUES, LINE_REPLY_TEXT_MAX);
  assert.equal([...long].length, LINE_REPLY_TEXT_MAX);
});

test("validate: reply text required only when auto-reply on in chat modes", () => {
  const base = { ...DEFAULT_LINE_REPLY_SETTINGS, button_mode: "message" as const };
  assert.match(validateLineReplySettings({ ...base, reply_template: " " }) ?? "", /ตอบกลับ/);
  assert.equal(validateLineReplySettings({ ...base, reply_enabled: false, reply_template: "" }), null);
  assert.equal(validateLineReplySettings({ ...DEFAULT_LINE_REPLY_SETTINGS, button_mode: "link", reply_template: "" }), null);
  assert.match(
    validateLineReplySettings({ ...base, reply_template: "a".repeat(LINE_REPLY_TEXT_MAX + 1) }) ?? "",
    /ไม่เกิน/
  );
});

test("footer: default matches previous hardcoded text, tokens replaced, empty => null", () => {
  const values = { search_url: "https://x/search?q=a", home_url: "https://x", keyword: "a" };
  assert.equal(
    renderLineFooterTemplate(DEFAULT_LINE_REPLY_SETTINGS.result_footer_template, values),
    "ดูทั้งหมด/สั่งซื้อ: https://x/search?q=a\nกลับหน้าเว็บ: https://x"
  );
  assert.equal(renderLineFooterTemplate("ค้นหา {keyword} {title}", values), "ค้นหา a {title}");
  assert.equal(renderLineFooterTemplate("  ", values), null);
});

test("footer: normalize + validate", () => {
  const settings = normalizeLineReplySettings({ result_footer_enabled: false, result_footer_template: "" });
  assert.equal(settings.result_footer_enabled, false);
  assert.equal(settings.result_footer_template, DEFAULT_LINE_REPLY_SETTINGS.result_footer_template);
  assert.match(
    validateLineReplySettings({ ...DEFAULT_LINE_REPLY_SETTINGS, result_footer_template: " " }) ?? "",
    /ท้ายผลค้นหา/
  );
  assert.equal(
    validateLineReplySettings({ ...DEFAULT_LINE_REPLY_SETTINGS, result_footer_enabled: false, result_footer_template: "" }),
    null
  );
});

test("defaults: สั่งซื้อสินค้า goes to cart with qty 1, plus สอบถามแอดมิน chat button", () => {
  assert.equal(DEFAULT_LINE_REPLY_SETTINGS.button_mode, "both");
  assert.equal(DEFAULT_LINE_REPLY_SETTINGS.link_label, "สั่งซื้อสินค้า");
  assert.equal(DEFAULT_LINE_REPLY_SETTINGS.link_target, "cart");
  assert.equal(DEFAULT_LINE_REPLY_SETTINGS.cart_quantity, 1);
});

test("quick order url: encodes sku/qty/nonce and strips trailing slash", () => {
  assert.equal(
    buildQuickOrderUrl("https://shop.example/", SKU_ID, 4, "ab12cd34"),
    `https://shop.example/line/order?sku=${SKU_ID}&qty=4&n=ab12cd34`
  );
});

test("link url: cart target uses quick order, product target uses product page", () => {
  const input = { storefrontBase: "https://shop.example", skuId: SKU_ID, productUrl: VALUES.url, nonce: "nonce123" };
  assert.match(resolveLinkButtonUrl(DEFAULT_LINE_REPLY_SETTINGS, input), /\/line\/order\?sku=.*&qty=1&n=nonce123$/);
  const product = normalizeLineReplySettings({ link_target: "product" });
  assert.equal(resolveLinkButtonUrl(product, input), VALUES.url);
  const buttons = buildLineProductButtons(DEFAULT_LINE_REPLY_SETTINGS, VALUES, SKU_ID, "https://x/line/order?sku=1");
  assert.deepEqual(buttons[0].action, { type: "uri", label: "สั่งซื้อสินค้า", uri: "https://x/line/order?sku=1" });
});

test("normalize/validate link target and cart quantity", () => {
  assert.equal(normalizeLineReplySettings({ link_target: "evil" }).link_target, "cart");
  assert.equal(normalizeLineReplySettings({ cart_quantity: 4 }).cart_quantity, 4);
  assert.equal(normalizeLineReplySettings({ cart_quantity: 0 }).cart_quantity, 1);
  assert.equal(normalizeLineReplySettings({ cart_quantity: 2.5 }).cart_quantity, 1);
  assert.match(validateLineReplySettings({ ...DEFAULT_LINE_REPLY_SETTINGS, cart_quantity: 9 }) ?? "", /จำนวน/);
  assert.match(validateLineReplySettings({ ...DEFAULT_LINE_REPLY_SETTINGS, link_target: "x" as never }) ?? "", /ปลายทาง/);
  assert.equal(
    validateLineReplySettings({ ...DEFAULT_LINE_REPLY_SETTINGS, link_target: "product", cart_quantity: 0 }),
    null
  );
});
