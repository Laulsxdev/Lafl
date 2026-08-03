"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/* Minimal inline glyphs keyed by route — no icon library. */
const ICONS: Record<string, ReactNode> = {
  "/": (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  "/trips": (
    <>
      <circle cx="6" cy="18.5" r="2.2" />
      <circle cx="18" cy="5.5" r="2.2" />
      <path d="M8.2 18.5H15a3.25 3.25 0 0 0 0-6.5H9a3.25 3.25 0 0 1 0-6.5h6.8" />
    </>
  ),
  "/pods": (
    <>
      <path d="M6.5 3.5h7.2l4.3 4.4V20a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M13.7 3.7V8h4.2" />
      <path d="m9 14.5 2 2 4-4.5" />
    </>
  ),
  "/settlements": (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="1.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  "/invoices": (
    <>
      <path d="M6 3.5h12V21l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" />
      <path d="M9 8.5h6M9 12h6" />
    </>
  ),
  "/vehicles": (
    <>
      <path d="M2.5 6.5h11v9h-11z" />
      <path d="M13.5 9.5h3.6l3.4 3.4v2.6h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </>
  ),
  "/drivers": (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  "/sites": (
    <>
      <path d="M12 21s-6.5-5.2-6.5-10a6.5 6.5 0 0 1 13 0c0 4.8-6.5 10-6.5 10z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </>
  ),
  "/admin": (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="1" />
      <path d="M9 7.5h2M13 7.5h2M9 11h2M13 11h2M9 14.5h2M13 14.5h2M10.5 20.5v-3h3v3" />
    </>
  ),
};

const FALLBACK = <circle cx="12" cy="12" r="2" />;

export default function NavLinks({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const path = usePathname();
  return (
    <>
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
              active
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 shrink-0 ${
                active ? "text-white" : "text-neutral-400 group-hover:text-neutral-600"
              }`}
              aria-hidden
            >
              {ICONS[l.href] ?? FALLBACK}
            </svg>
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
