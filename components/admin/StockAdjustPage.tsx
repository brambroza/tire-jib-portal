"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../../lib/supabaseClient";
import ActionFeedback from "../ui/ActionFeedback";
import TablePaginationControls from "../ui/TablePaginationControls";
import { useTablePagination } from "../ui/useTablePagination";

type StockAdjustRow = {
  skuId: string;
  skuCode: string;
  sizeLabel: string | null;
  productName: string;
  productBrand: string | null;
  qtyOnHand: string;
  minStock: string;
};

function normalizeInt(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;
  return Math.floor(parsed);
}

export default function StockAdjustPage() {
  const [rows, setRows] = useState<StockAdjustRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadStock = useCallback(async () => {
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase env");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: skuData, error: skuError } = await supabase
        .from("skus")
        .select("id, sku_code, size_label, products(name, brand), inventory(qty_on_hand, min_stock)")
        .order("created_at", { ascending: true });

      if (skuError) throw skuError;

      const mappedRows = (skuData ?? []).map((sku) => {
        const product = Array.isArray(sku.products) ? sku.products[0] : sku.products;
        const inventory = Array.isArray(sku.inventory) ? sku.inventory[0] : sku.inventory;
        return {
          skuId: sku.id,
          skuCode: sku.sku_code,
          sizeLabel: sku.size_label,
          productName: product?.name ?? "-",
          productBrand: product?.brand ?? null,
          qtyOnHand: String(inventory?.qty_on_hand ?? 0),
          minStock: String(inventory?.min_stock ?? 0)
        };
      });

      setRows(mappedRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStock();
  }, [loadStock]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.productBrand ?? "", row.productName, row.skuCode, row.sizeLabel ?? ""].join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);
  const pagination = useTablePagination(filteredRows, 10);

  const handleQtyChange = (skuId: string, value: string) => {
    setRows((prev) => prev.map((row) => (row.skuId === skuId ? { ...row, qtyOnHand: value } : row)));
  };

  const handleMinChange = (skuId: string, value: string) => {
    setRows((prev) => prev.map((row) => (row.skuId === skuId ? { ...row, minStock: value } : row)));
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
      const upserts: { sku_id: string; qty_on_hand: number; min_stock: number }[] = [];

      for (const row of rows) {
        const qty = normalizeInt(row.qtyOnHand);
        const min = normalizeInt(row.minStock);
        if (qty === null || min === null) {
          throw new Error(`ข้อมูลคงคลังไม่ถูกต้องที่ SKU ${row.skuCode}`);
        }
        upserts.push({ sku_id: row.skuId, qty_on_hand: qty, min_stock: min });
      }

      if (upserts.length) {
        const { error: upsertError } = await supabase.from("inventory").upsert(upserts, { onConflict: "sku_id" });
        if (upsertError) throw upsertError;
      }

      await loadStock();
      setSuccess("บันทึกยอดคงคลังเรียบร้อย");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกยอดคงคลังไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page active">
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div className="search-bar" style={{ width: 320 }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาแบรนด์/ชื่อสินค้า/SKU/ไซซ์"
          />
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={loadStock} disabled={loading || saving}>
          รีเซ็ต
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading || saving}>
          {saving ? "กำลังบันทึก..." : "บันทึกยอดคงคลัง"}
        </button>
      </div>

      <ActionFeedback
        error={error}
        success={success}
        onClearError={() => setError(null)}
        onClearSuccess={() => setSuccess(null)}
      />

      <div className="pricing-table-wrap">
        <div className="pricing-head" style={{ gridTemplateColumns: "1.4fr .8fr .8fr .8fr" }}>
          <div className="pricing-head-cell">สินค้า / SKU</div>
          <div className="pricing-head-cell">คงเหลือ</div>
          <div className="pricing-head-cell">ขั้นต่ำ</div>
          <div className="pricing-head-cell">สถานะ</div>
        </div>

        {pagination.paginatedRows.map((row) => {
          const qty = normalizeInt(row.qtyOnHand) ?? 0;
          const min = normalizeInt(row.minStock) ?? 0;
          const isLow = qty <= min;
          return (
            <div className="pricing-row" style={{ gridTemplateColumns: "1.4fr .8fr .8fr .8fr" }} key={row.skuId}>
              <div className="pricing-cell">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {row.productBrand ? `${row.productBrand} ` : ""}
                    {row.productName}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }} className="mono">
                    {row.sizeLabel ? `${row.sizeLabel} · ` : ""}
                    {row.skuCode}
                  </div>
                </div>
              </div>
              <div className="pricing-cell center">
                <input
                  className="price-input"
                  value={row.qtyOnHand}
                  onChange={(event) => handleQtyChange(row.skuId, event.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="pricing-cell center">
                <input
                  className="price-input"
                  value={row.minStock}
                  onChange={(event) => handleMinChange(row.skuId, event.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="pricing-cell center">
                <span className={isLow ? "badge pending" : "badge paid"}>{isLow ? "ต่ำกว่าขั้นต่ำ" : "ปกติ"}</span>
              </div>
            </div>
          );
        })}

        {!filteredRows.length && !loading && (
          <div style={{ padding: 16, color: "var(--text3)", fontSize: 12 }}>ยังไม่มีสินค้าในระบบ</div>
        )}
      </div>
      <TablePaginationControls
        page={pagination.page}
        totalPages={pagination.totalPages}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </div>
  );
}
