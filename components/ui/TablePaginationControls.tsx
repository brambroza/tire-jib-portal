"use client";

type Props = {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export default function TablePaginationControls({
  page,
  totalPages,
  pageSize,
  totalItems,
  pageSizeOptions = [10, 20, 25],
  onPageChange,
  onPageSizeChange
}: Props) {
  if (totalItems <= 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginTop: 12,
        padding: "10px 4px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>
          แสดง {start}-{end} จาก {totalItems} รายการ
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text3)" }}>
          แถว/หน้า
          <select
            className="filter-select"
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            style={{ minWidth: 74, height: 30, padding: "0 8px", fontSize: 12 }}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          className="btn btn-ghost"
          style={{ padding: "6px 10px", fontSize: 12, minWidth: 64 }}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          ก่อนหน้า
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
          const isActive = p === page;
          if (p !== 1 && p !== totalPages && Math.abs(p - page) > 1) {
            if (p === page - 2 || p === page + 2) {
              return (
                <span key={`dots-${p}`} style={{ color: "var(--text3)", padding: "0 2px" }}>
                  ...
                </span>
              );
            }
            return null;
          }
          return (
            <button
              key={p}
              className="btn btn-ghost"
              style={{
                padding: "6px 10px",
                fontSize: 12,
                minWidth: 34,
                borderRadius: 999,
                background: isActive ? "var(--accent-dim)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text2)",
                borderColor: isActive ? "var(--accent)" : "var(--border)"
              }}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          );
        })}
        <button
          className="btn btn-ghost"
          style={{ padding: "6px 10px", fontSize: 12, minWidth: 64 }}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}
