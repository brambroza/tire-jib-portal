"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import {
  DEFAULT_LINE_REPLY_SETTINGS,
  LINE_FOOTER_PLACEHOLDERS,
  LINE_BUTTON_LABEL_MAX,
  LINE_MESSAGE_TEXT_MAX,
  LINE_REPLY_TEXT_MAX,
  LINE_TEMPLATE_PLACEHOLDERS,
  normalizeLineReplySettings,
  renderLineFooterTemplate,
  renderLineMessageTemplate,
  validateLineReplySettings,
  type LineProductButtonMode,
  type LineReplySettings,
  type LineTemplateValues
} from "../../lib/lineReplySettings";

type TemplateField = "message_template" | "reply_template" | "result_footer_template";

const MODE_OPTIONS: { value: LineProductButtonMode; label: string; hint: string }[] = [
  {
    value: "message",
    label: "สั่งซื้อผ่านแชท + ตอบกลับอัตโนมัติ (แนะนำ)",
    hint: "ลูกค้ากดปุ่มแล้วส่งข้อความสั่งซื้อเข้าแชท บอทตอบกลับด้วยข้อความที่ตั้งไว้ด้านล่าง แล้วแอดมินคุยต่อเอง"
  },
  { value: "both", label: "แสดงทั้ง 2 ปุ่ม", hint: "ปุ่มสั่งซื้อผ่านแชท (มีตอบกลับ) + ปุ่มเปิดหน้าสินค้าบนเว็บ" },
  {
    value: "link",
    label: "เปิดลิงก์สินค้าอย่างเดียว",
    hint: "ลูกค้ากดแล้วเปิดเว็บทันที — LINE ไม่แจ้งระบบ จึงตอบกลับอัตโนมัติไม่ได้"
  }
];

const SAMPLE_VALUES: LineTemplateValues = {
  title: "Michelin Pilot Sport 4",
  brand: "Michelin",
  name: "Pilot Sport 4",
  size: "225/45R17",
  price: "฿4,500",
  url: "https://hijibjib.com/products/xxxx"
};

/**
 * Admin page: configure the button(s) shown under each product card
 * in LINE auto-reply (link to product, send chat message, or both).
 */
export default function LineReplySettingsPage() {
  const [form, setForm] = useState<LineReplySettings>(DEFAULT_LINE_REPLY_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const showLink = form.button_mode !== "message";
  const showMessage = form.button_mode !== "link";
  const previewText = useMemo(
    () => renderLineMessageTemplate(form.message_template, SAMPLE_VALUES),
    [form.message_template]
  );
  const previewFooter = useMemo(
    () =>
      renderLineFooterTemplate(form.result_footer_template, {
        search_url: "https://hijibjib.com/search?q=michelin%20225%2F45R17",
        home_url: "https://hijibjib.com",
        keyword: "michelin 225/45R17"
      }) ?? "-",
    [form.result_footer_template]
  );
  const previewReply = useMemo(
    () => renderLineMessageTemplate(form.reply_template, SAMPLE_VALUES, LINE_REPLY_TEXT_MAX),
    [form.reply_template]
  );

  const loadSettings = useCallback(async () => {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("line_reply_settings")
      .select(
        "button_mode,link_label,message_label,message_template,reply_enabled,reply_template,result_footer_enabled,result_footer_template"
      )
      .eq("id", "default")
      .maybeSingle();
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setForm(normalizeLineReplySettings(data));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function updateField<K extends keyof LineReplySettings>(key: K, value: LineReplySettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess(null);
  }

  function insertPlaceholder(field: TemplateField, token: string) {
    updateField(field, `${form[field]}${token}`);
  }

  /** Clickable {token} chips that append to the given template field. */
  function renderPlaceholderButtons(field: TemplateField) {
    const placeholders = field === "result_footer_template" ? LINE_FOOTER_PLACEHOLDERS : LINE_TEMPLATE_PLACEHOLDERS;
    return (
      <>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {placeholders.map((item) => (
            <button
              key={item.token}
              type="button"
              className="btn btn-ghost"
              title={item.description}
              onClick={() => insertPlaceholder(field, item.token)}
              disabled={loading}
            >
              {item.token}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>
          กดเพื่อแทรกตัวแปร ระบบจะแทนด้วยข้อมูลสินค้าจริงตอนส่ง
        </div>
      </>
    );
  }

  async function saveSettings() {
    if (!supabase) return;
    const validationError = validateLineReplySettings(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const authRes = await supabase.auth.getUser();
    const { error: saveError } = await supabase
      .from("line_reply_settings")
      .update({
        button_mode: form.button_mode,
        link_label: form.link_label.trim(),
        message_label: form.message_label.trim(),
        message_template: form.message_template.trim(),
        reply_enabled: form.reply_enabled,
        reply_template: form.reply_template.trim(),
        result_footer_enabled: form.result_footer_enabled,
        result_footer_template: form.result_footer_template.trim(),
        updated_by: authRes.data.user?.id ?? null,
        updated_at: new Date().toISOString()
      })
      .eq("id", "default")
      .select("id")
      .single();
    if (saveError) {
      setError(saveError.message);
    } else {
      setSuccess("บันทึกการตั้งค่าแล้ว ข้อความ LINE ถัดไปจะใช้ค่าใหม่ทันที");
    }
    setSaving(false);
  }

  return (
    <div className="page active">
      <div className="card">
        <div className="card-head">
          <span className="card-title">ปุ่มใต้การ์ดสินค้าใน LINE</span>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 14 }}>
          <ActionFeedback
            error={error}
            success={success}
            onClearError={() => setError(null)}
            onClearSuccess={() => setSuccess(null)}
          />

          <div style={{ color: "var(--text2)", fontSize: 13 }}>
            เมื่อลูกค้าพิมพ์ค้นหายางใน LINE ระบบจะตอบเป็นการ์ดสินค้า เลือกได้ว่าปุ่มใต้การ์ดจะเปิดลิงก์ หรือส่งข้อความเข้าแชทให้แอดมินตอบเอง
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>โหมดปุ่ม</div>
            {MODE_OPTIONS.map((option) => (
              <label key={option.value} style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="line-button-mode"
                  checked={form.button_mode === option.value}
                  onChange={() => updateField("button_mode", option.value)}
                  disabled={loading}
                />
                <span>
                  <span style={{ fontWeight: 500 }}>{option.label}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--text3)" }}>{option.hint}</span>
                </span>
              </label>
            ))}
          </div>

          {showLink && (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 600 }}>ชื่อปุ่มเปิดลิงก์</div>
              <input
                className="auth-input"
                value={form.link_label}
                maxLength={LINE_BUTTON_LABEL_MAX}
                onChange={(event) => updateField("link_label", event.target.value)}
                placeholder="เช่น สั่งซื้อสินค้า"
                disabled={loading}
              />
            </div>
          )}

          {showMessage && (
            <>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 600 }}>ชื่อปุ่มส่งข้อความ</div>
                <input
                  className="auth-input"
                  value={form.message_label}
                  maxLength={LINE_BUTTON_LABEL_MAX}
                  onChange={(event) => updateField("message_label", event.target.value)}
                  placeholder="เช่น สอบถามแอดมิน"
                  disabled={loading}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600 }}>ข้อความที่ลูกค้าจะส่งเข้าแชท</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--text3)" }}>
                    {[...form.message_template].length}/{LINE_MESSAGE_TEXT_MAX}
                  </span>
                </div>
                <textarea
                  className="auth-input"
                  rows={4}
                  value={form.message_template}
                  maxLength={LINE_MESSAGE_TEXT_MAX}
                  onChange={(event) => updateField("message_template", event.target.value)}
                  style={{ width: "100%", resize: "vertical" }}
                  disabled={loading}
                />
                {renderPlaceholderButtons("message_template")}
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.reply_enabled}
                    onChange={(event) => updateField("reply_enabled", event.target.checked)}
                    disabled={loading}
                  />
                  ตอบกลับอัตโนมัติหลังลูกค้ากดปุ่ม &quot;{form.message_label || "-"}&quot;
                </label>
                {form.reply_enabled && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "var(--text2)" }}>ข้อความตอบกลับจากร้าน (ใส่ {"{url}"} เพื่อแนบลิงก์สินค้า)</span>
                      <span className="mono" style={{ fontSize: 12, color: "var(--text3)" }}>
                        {[...form.reply_template].length}/{LINE_REPLY_TEXT_MAX}
                      </span>
                    </div>
                    <textarea
                      className="auth-input"
                      rows={4}
                      value={form.reply_template}
                      maxLength={LINE_REPLY_TEXT_MAX}
                      onChange={(event) => updateField("reply_template", event.target.value)}
                      style={{ width: "100%", resize: "vertical" }}
                      disabled={loading}
                    />
                    {renderPlaceholderButtons("reply_template")}
                  </>
                )}
              </div>
            </>
          )}

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.result_footer_enabled}
                onChange={(event) => updateField("result_footer_enabled", event.target.checked)}
                disabled={loading}
              />
              ส่งข้อความต่อท้ายผลค้นหา (หลังการ์ดสินค้า)
            </label>
            {form.result_footer_enabled && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--text2)" }}>ข้อความต่อท้าย</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--text3)" }}>
                    {[...form.result_footer_template].length}/{LINE_REPLY_TEXT_MAX}
                  </span>
                </div>
                <textarea
                  className="auth-input"
                  rows={3}
                  value={form.result_footer_template}
                  maxLength={LINE_REPLY_TEXT_MAX}
                  onChange={(event) => updateField("result_footer_template", event.target.value)}
                  style={{ width: "100%", resize: "vertical" }}
                  disabled={loading}
                />
                {renderPlaceholderButtons("result_footer_template")}
              </>
            )}
          </div>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>ตัวอย่างบนการ์ดสินค้า</div>
            <div style={{ display: "grid", gap: 6, maxWidth: 280 }}>
              {showLink && (
                <div style={{ background: "#16a34a", color: "#fff", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                  {form.link_label || "-"}
                </div>
              )}
              {showMessage && (
                <div
                  style={{
                    background: showLink ? "var(--bg3)" : "#16a34a",
                    color: showLink ? "inherit" : "#fff",
                    borderRadius: 6,
                    padding: "8px 10px",
                    textAlign: "center"
                  }}
                >
                  {form.message_label || "-"}
                </div>
              )}
            </div>
            {showMessage && (
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--text2)", display: "grid", gap: 4 }}>
                <div>
                  ลูกค้าส่ง: <span style={{ whiteSpace: "pre-wrap" }}>{previewText}</span>
                </div>
                {form.reply_enabled && (
                  <div>
                    ร้านตอบกลับ: <span style={{ whiteSpace: "pre-wrap" }}>{previewReply}</span>
                  </div>
                )}
              </div>
            )}
            {form.result_footer_enabled && (
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--text2)" }}>
                ข้อความต่อท้ายผลค้นหา: <div style={{ whiteSpace: "pre-wrap" }}>{previewFooter}</div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => void loadSettings()} disabled={loading || saving}>
              โหลดใหม่
            </button>
            <button className="btn btn-primary" onClick={() => void saveSettings()} disabled={loading || saving}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
