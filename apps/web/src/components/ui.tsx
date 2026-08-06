import type { ReactNode } from "react";

/* ────────────────────────── Lafl TMS design system ──────────────────────────
   Shared visual primitives — keep every page on the same rhythm.

   Conventions:
   - Containers  : rounded-xl · border-neutral-200 · bg-white · shadow-xs
   - Controls    : rounded-lg · text-sm — primary (dark) / ghost / danger / success
   - Tables      : `thCls` header cells, `tdCls` body cells, row hover bg-neutral-50
   - Pills       : `pillCls` + tone classes from features/status.ts
   - Page titles : text-2xl font-semibold tracking-tight (via <PageHeader />)
   - Section hdrs: <SectionCard title=…/> inside cards, <SectionHeading/> for lists

   Responsive: mobile-first. Layout grids start at one column and widen at
   sm/md/lg; every data table is wrapped in <TableScroll> so wide tables scroll
   sideways instead of stretching the viewport.
─────────────────────────────────────────────────────────────────────────────── */

/* Buttons */
export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-700";
export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50";
export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:border-red-300 hover:bg-red-50";
export const btnSuccess =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-600";

/* Form fields */
export const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none";
export const inputSmCls =
  "rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none";
export const labelCls = "mb-1 block text-xs font-medium text-neutral-500";

/* Containers, tables, pills */
export const cardCls = "rounded-xl border border-neutral-200 bg-white shadow-xs";
export const thCls =
  "whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 sm:px-4";
export const tdCls = "px-3 py-3 sm:px-4";
/* Hide a low-priority column below `sm` — the row stays readable on a phone
   and the full record is one tap away on the detail page. */
export const colSecondary = "hidden sm:table-cell";
export const colTertiary = "hidden md:table-cell";
export const pillCls =
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize";

/* Inline feedback banners */
export const bannerError = "rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700";
export const bannerOk = "rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-700";

/* ── Page header ─────────────────────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode; // right-aligned actions
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 sm:items-end">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}

/* ── Horizontal scroller for wide data tables ────────────────────────────── */
export function TableScroll({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`table-scroll ${className}`}>{children}</div>;
}

/* ── Card section with a consistent header bar ───────────────────────────── */
export function SectionCard({
  title,
  meta,
  aside,
  children,
  flush = false,
  className = "",
}: {
  title: ReactNode;
  meta?: ReactNode; // muted annotation next to the title (e.g. "Step 2 of 4")
  aside?: ReactNode; // right side of the header bar
  children: ReactNode;
  flush?: boolean; // no body padding (tables, lists)
  className?: string;
}) {
  return (
    <section className={`${cardCls} ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-neutral-100 px-4 py-3.5 sm:px-6 sm:py-4">
        <h2 className="text-sm font-semibold text-neutral-900">
          {title}
          {meta && <span className="ml-2 text-xs font-normal text-neutral-400">{meta}</span>}
        </h2>
        {aside}
      </header>
      <div className={flush ? "" : "p-4 sm:p-6"}>{children}</div>
    </section>
  );
}

/* ── Standalone list-section heading (queue pages) ───────────────────────── */
export function SectionHeading({
  title,
  count,
  hint,
}: {
  title: ReactNode;
  count?: number;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {typeof count === "number" && (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-500">
          {count}
        </span>
      )}
      {hint && <span className="text-xs text-neutral-400">{hint}</span>}
    </div>
  );
}

/* ── Empty state with a subtle inline glyph ──────────────────────────────── */
const GLYPHS: Record<string, ReactNode> = {
  inbox: (
    <>
      <path d="M3.5 13.5 5.1 6.1A1.5 1.5 0 0 1 6.57 4.9h10.86a1.5 1.5 0 0 1 1.47 1.2l1.6 7.4" />
      <path d="M3.5 13.5h4.6l1.2 2.4h5.4l1.2-2.4h4.6v4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.4 2.4 2.4 4.6-5" />
    </>
  ),
  truck: (
    <>
      <path d="M2.5 6.5h11v9h-11z" />
      <path d="M13.5 9.5h3.6l3.4 3.4v2.6h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.2-6.5-10a6.5 6.5 0 0 1 13 0c0 4.8-6.5 10-6.5 10z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </>
  ),
  document: (
    <>
      <path d="M6.5 3.5h7.2l4.3 4.4V20a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M13.7 3.7V8h4.2" />
    </>
  ),
  banknote: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="1.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
};

export function EmptyState({
  icon = "inbox",
  title,
  hint,
  framed = false,
  compact = false,
}: {
  icon?: keyof typeof GLYPHS;
  title: string;
  hint?: string;
  framed?: boolean; // draws its own dashed container (use outside cards)
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "px-4 py-6" : "px-6 py-10"
      } ${framed ? "rounded-xl border border-dashed border-neutral-200 bg-white" : ""}`}
    >
      <svg
        className={compact ? "h-6 w-6 text-neutral-300" : "h-8 w-8 text-neutral-300"}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {GLYPHS[icon]}
      </svg>
      <p className="mt-2.5 text-sm font-medium text-neutral-600">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

/* ── Brand mark (login card + sidebar) ───────────────────────────────────── */
export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-sm ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[55%] w-[55%]"
        aria-hidden
      >
        <path d="M2.5 6.5h11v9h-11z" />
        <path d="M13.5 9.5h3.6l3.4 3.4v2.6h-7" />
        <circle cx="7" cy="17.5" r="1.8" />
        <circle cx="16.5" cy="17.5" r="1.8" />
      </svg>
    </span>
  );
}

/* ── Alert row icon (dashboard) ──────────────────────────────────────────── */
export function AlertIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <path d="M12 4.5 2.8 19.5h18.4z" />
      <path d="M12 10.5v4M12 17.2h.01" />
    </svg>
  );
}
