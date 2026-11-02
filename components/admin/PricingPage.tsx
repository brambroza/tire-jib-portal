"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";

type CustomerGroup = {
  id: string;
  code: "general" | "member" | "dealer_small" | "dealer_mid" | "dealer_big";
  name: string;
};

type PricingRow = {
  skuId: string;
  skuCode: string;
  sizeLabel: string | null;
  productName: string;
  productBrand: string | null;
  costPrice: number;
  prices: Record<string, string>;
};

const GROUP_ORDER: CustomerGroup["code"][] = [
  "general",
  "member",
  "dealer_small",
  "dealer_mid",
  "dealer_big"
];

const GROUP_CLASS: Record<CustomerGroup["code"], string> = {
  general: "t-general",
  member: "t-member",
  dealer_small: "t-small",
  dealer_mid: "t-mid",
  dealer_big: "t-big"
};

function normalizePrice(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function PricingPage() {
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const orderedGroups = useMemo(() => {
    if (!groups.length) return [] as CustomerGroup[];
    const map = new Map(groups.map((group) => [group.code, group]));
    return GROUP_ORDER.map((code) => map.get(code)).filter(Boolean) as CustomerGroup[];
  }, [groups]);

  const loadPricing = useCallback(async () => {

    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      


      const [{ data: groupData, error: groupError }, { data: skuData, error: skuError }] = await Promise.all([
        supabase
          .from("customer_groups")
          .select("id, code, name")
          .order("created_at", { ascending: true }),
        supabase
          .from("skus")
          .select("id, sku_code, size_label, cost_price, products(name, brand)")
          .order("created_at", { ascending: true })
      ]);

      if (groupError) throw groupError;
      if (skuError) throw skuError;

      const skuIds = (skuData ?? []).map((sku) => sku.id);
      let priceRows: { sku_id: string; group_id: string; price: number }[] = [];
      if (skuIds.length) {
        const { data: pricesData, error: pricesError } = await supabase
          .from("prices")
          .select("sku_id, group_id, price")
          .in("sku_id", skuIds);
        if (pricesError) throw pricesError;
        priceRows = pricesData ?? [];
      }

      const priceMap = new Map<string, Record<string, string>>();
      priceRows.forEach((price) => {
        const entry = priceMap.get(price.sku_id) ?? {};
        entry[price.group_id] = price.price.toString();
        priceMap.set(price.sku_id, entry);
      });

      const mappedRows = (skuData ?? []).map((sku) => {
        const product = Array.isArray(sku.products) ? sku.products[0] : sku.products;
        return {
          skuId: sku.id,
          skuCode: sku.sku_code,
          sizeLabel: sku.size_label,
          productName: product?.name ?? "-",
          productBrand: product?.brand ?? null,
          costPrice: Number(sku.cost_price ?? 0),
          prices: priceMap.get(sku.id) ?? {}
        };
      });

      setGroups((groupData ?? []) as CustomerGroup[]);
      setRows(mappedRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPricing();
  }, [loadPricing]);

  const handlePriceChange = (skuId: string, groupId: string, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.skuId === skuId
          ? { ...row, prices: { ...row.prices, [groupId]: value } }
          : row
      )
    );
  };

  const handleSave = async () => {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const upserts: { sku_id: string; group_id: string; price: number }[] = [];
      rows.forEach((row) => {
        orderedGroups.forEach((group) => {
          const value = row.prices[group.id] ?? "";
          const parsed = normalizePrice(value);
          if (parsed !== null) {
            upserts.push({ sku_id: row.skuId, group_id: group.id, price: parsed });
          }
        });
      });

      if (upserts.length) {
        const { error: upsertError } = await supabase
          .from("prices")
          .upsert(upserts, { onConflict: "sku_id,group_id" });
        if (upsertError) throw upsertError;
      }

      setSuccess("บันทึกราคาเรียบร้อย");
      await loadPricing();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกราคาไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page active">
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "14px 18px",
            display: "flex",
            gap: 14,
            alignItems: "center"
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text3)" }}>กลุ่มราคา</div>
          <div style={{ display: "flex", gap: 6 }}>
            {orderedGroups.map((group) => (
              <span key={group.id} className={`tier-label ${GROUP_CLASS[group.code]}`}>
                {group.name}
              </span>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={loadPricing} disabled={loading || saving}>
          รีเซ็ต
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading || saving}>
          {saving ? "กำลังบันทึก..." : "บันทึกราคา"}
        </button>
      </div>

      <ActionFeedback
        error={error}
        success={success}
        onClearError={() => setError(null)}
        onClearSuccess={() => setSuccess(null)}
      />

      <div className="pricing-table-wrap">
        <div className="pricing-head">
          <div className="pricing-head-cell">สินค้า / SKU</div>
          <div className="pricing-head-cell">ราคาทุน</div>
          {orderedGroups.map((group) => (
            <div key={group.id} className="pricing-head-cell tier">
              {group.name}
            </div>
          ))}
        </div>

        {rows.map((row) => (
          <div className="pricing-row" key={row.skuId}>
            <div className="pricing-cell">
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {row.productBrand ? `${row.productBrand} ` : ""}{row.productName}
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)" }} className="mono">
                  {row.sizeLabel ? `${row.sizeLabel} · ` : ""}{row.skuCode}
                </div>
              </div>
            </div>
            <div className="pricing-cell">
              <span className="mono" style={{ color: "var(--text2)" }}>
                ฿{row.costPrice.toLocaleString("th-TH")}
              </span>
            </div>
            {orderedGroups.map((group) => (
              <div className="pricing-cell center" key={`${row.skuId}-${group.id}`}>
                <input
                  className="price-input"
                  value={row.prices[group.id] ?? ""}
                  onChange={(event) => handlePriceChange(row.skuId, group.id, event.target.value)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        ))}
        {!rows.length && !loading && (
          <div style={{ padding: 16, color: "var(--text3)", fontSize: 12 }}>ยังไม่มีสินค้าในระบบ</div>
        )}
      </div>
    </div>
  );
}
