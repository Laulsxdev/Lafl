"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Searchable dropdown for long lists (vehicles, drivers, contract rates…).
 * Works inside server-action <form>s via a hidden input carrying the value.
 */
export default function SelectSearch({
  name,
  options,
  placeholder = "Select…",
  required = false,
  defaultValue = "",
  allowEmpty = false,
  emptyLabel = "— None —",
}: {
  name: string;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [value, setValue] = useState(defaultValue);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 120);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.hint ?? "").toLowerCase().includes(q),
      )
      .slice(0, 120);
  }, [options, query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const pick = (v: string) => {
    setValue(v);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-sm ${
          open ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-300 hover:border-neutral-400"
        }`}
      >
        <span className={`min-w-0 truncate ${selected ? "" : "text-neutral-400"}`}>
          {selected ? (
            <>
              {selected.label}
              {selected.hint && (
                <span className="ml-1.5 text-neutral-400">· {selected.hint}</span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <svg className={`ml-2 h-4 w-4 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.4a.75.75 0 0 1-1.08 0l-4.25-4.4a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1.5 w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 p-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered[0]) pick(filtered[0].value);
                }
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Type to search…"
              className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
            />
          </div>
          <ul className="max-h-[50vh] overflow-y-auto py-1 sm:max-h-64">
            {allowEmpty && (
              <li>
                <button
                  type="button"
                  onClick={() => pick("")}
                  className="w-full px-3 py-2 text-left text-sm text-neutral-400 hover:bg-neutral-50"
                >
                  {emptyLabel}
                </button>
              </li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => pick(o.value)}
                  className={`flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 ${
                    o.value === value ? "bg-neutral-50 font-semibold" : ""
                  }`}
                >
                  <span className="min-w-0 truncate">{o.label}</span>
                  {o.hint && (
                    <span className="max-w-[45%] shrink-0 truncate text-xs text-neutral-400">
                      {o.hint}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-neutral-400">
                No matches found
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
