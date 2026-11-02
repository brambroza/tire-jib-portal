"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AppDatePickerProps = {
  value: string;
  onChange: (nextValue: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
};

const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function parseIsoDate(value: string) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateDMY(date: Date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function AppDatePicker({
  value,
  onChange,
  className = "auth-input",
  placeholder = "เลือกวันที่",
  disabled = false
}: AppDatePickerProps) {
  const parsedValue = useMemo(() => parseIsoDate(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(parsedValue ?? new Date());
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (parsedValue) setViewDate(parsedValue);
  }, [parsedValue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthLabel = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });

  const displayValue = parsedValue ? formatDateDMY(parsedValue) : "";

  const gridDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startOffset = first.getDay();
    const totalDays = last.getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i += 1) cells.push(null);
    for (let i = 1; i <= totalDays; i += 1) cells.push(new Date(year, month, i));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewDate]);

  return (
    <div className="app-date-picker" ref={rootRef}>
      <button
        type="button"
        className={className}
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        style={{ textAlign: "left", marginBottom: 0 }}
      >
        {displayValue || placeholder}
      </button>

      {open && !disabled && (
        <div className="app-date-picker-popover">
          <div className="app-date-picker-title">SELECT DATE</div>
          <div className="app-date-picker-current">
            {parsedValue ? formatDateDMY(parsedValue) : "No date selected"}
          </div>

          <div className="app-date-picker-nav">
            <div className="app-date-picker-month">{monthLabel}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="app-date-picker-icon-btn"
                onClick={() =>
                  setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
              >
                ‹
              </button>
              <button
                type="button"
                className="app-date-picker-icon-btn"
                onClick={() =>
                  setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
              >
                ›
              </button>
            </div>
          </div>

          <div className="app-date-picker-weekdays">
            {WEEK_DAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="app-date-picker-grid">
            {gridDays.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} />;
              const selected = parsedValue ? isSameDate(parsedValue, date) : false;
              return (
                <button
                  type="button"
                  key={toIsoDate(date)}
                  className={`app-date-picker-day ${selected ? "selected" : ""}`}
                  onClick={() => {
                    onChange(toIsoDate(date));
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
