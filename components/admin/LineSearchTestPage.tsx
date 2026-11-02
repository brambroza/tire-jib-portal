"use client";

import { useState } from "react";
import ActionFeedback from "../ui/ActionFeedback";

type SimulateResult = {
  input_text: string;
  parsed: {
    brand: string | null;
    sizes: string[];
    keywords: string[];
  };
  total_matches: number;
  top5: Array<{
    rank: number;
    score: number;
    id: string;
    size_text: string;
    price: number | null;
    qty_on_hand: number | null;
    products: {
      id: string;
      brand: string | null;
      name: string | null;
      car_brand_name: string | null;
      car_model_name: string | null;
      is_hot: boolean;
      is_new: boolean;
      is_promotion: boolean;
    } | null;
  }>;
};

export default function LineSearchTestPage() {
  const [text, setText] = useState("สนใจ Michelin 255/40/21");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulateResult | null>(null);

  async function handleSimulate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/line/search-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const payload = (await response.json()) as SimulateResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "จำลองค้นหาไม่สำเร็จ");
      }
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "จำลองค้นหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page active">
      <div className="card">
        <div className="card-head">
          <span className="card-title">LINE Search Simulator</span>
        </div>
        <div className="card-body" style={{ display: "grid", gap: 12 }}>
          <ActionFeedback
            error={error}
            success={null}
            onClearError={() => setError(null)}
            onClearSuccess={() => undefined}
          />

          <div style={{ color: "var(--text2)", fontSize: 13 }}>
            ใช้ทดสอบข้อความลูกค้าแบบเดียวกับ webhook แต่ไม่ส่งข้อความไป LINE
          </div>

          <textarea
            className="auth-input"
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="เช่น Michelin 255/40/21 หรือ Toyota Camry"
            style={{ width: "100%", resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={() => void handleSimulate()} disabled={loading}>
              {loading ? "กำลังค้นหา..." : "ทดสอบ Query"}
            </button>
          </div>

          {result && (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>ผล Parse</div>
                <div style={{ fontSize: 13, color: "var(--text2)" }}>brand: {result.parsed.brand || "-"}</div>
                <div style={{ fontSize: 13, color: "var(--text2)" }}>sizes: {result.parsed.sizes?.join(", ") || "-"}</div>
                <div style={{ fontSize: 13, color: "var(--text2)" }}>keywords: {result.parsed.keywords.join(", ") || "-"}</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 6 }}>
                  จำนวนที่ match ทั้งหมด: {result.total_matches}
                </div>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Top 5 ผลลัพธ์</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {result.top5.length === 0 && (
                    <div style={{ color: "var(--text3)" }}>ไม่พบผลลัพธ์</div>
                  )}
                  {result.top5.map((item) => (
                    <div
                      key={`${item.rank}-${item.id}`}
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        background: "var(--bg1)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontWeight: 600 }}>
                          #{item.rank} {item.products?.brand || "-"} {item.products?.name || "-"}
                        </div>
                        <div className="mono" style={{ fontSize: 12, color: "var(--text3)" }}>
                          score: {item.score}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>
                        รถ: {item.products?.car_brand_name || "-"} {item.products?.car_model_name || "-"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
                        ขนาด: {item.size_text} | ราคา: {item.price != null ? `฿${item.price.toLocaleString("th-TH")}` : "-"} | สต๊อก: {item.qty_on_hand ?? "-"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Raw JSON</div>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: 12,
                    color: "var(--text2)"
                  }}
                >
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

