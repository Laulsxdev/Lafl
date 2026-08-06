"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/ui";

/* Phone/tablet chrome: a sticky top bar plus a slide-in drawer that reuses the
   exact sidebar panel the desktop layout renders. Shown below `lg`, where the
   240px fixed sidebar would eat most of the viewport. */
export default function MobileNav({
  orgLabel,
  children,
}: {
  orgLabel: string;
  children: ReactNode; // the server-rendered sidebar panel
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // Navigating from inside the drawer should dismiss it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // don't scroll the page behind the drawer
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-neutral-200 bg-white/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <BrandMark className="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold tracking-tight text-neutral-900">
            Lafl TMS
          </div>
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500"
            />
            <span className="truncate text-[11px] font-medium text-neutral-500">
              {orgLabel}
            </span>
          </div>
        </div>
      </header>

      {/* Overlay */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`fixed inset-0 z-40 bg-neutral-900/40 transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out focus:outline-none lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation menu"
          className="absolute right-2 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
        {children}
      </div>
    </>
  );
}
