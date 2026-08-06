"use client";

import { useState } from "react";

/**
 * Copies (or natively shares) the public POD upload link for a trip.
 * The link is optional sugar — WhatsApp-to-supervisor manual upload stays the
 * permanent fallback, so this never gates anything.
 */
export default function SharePodLink({ path, tripNo }: { path: string; tripNo: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `POD upload — ${tripNo}`,
          text: `Upload the POD photo for trip ${tripNo} here:`,
          url,
        });
        return;
      } catch {
        // fall through to clipboard (user may have dismissed the sheet)
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="max-w-full whitespace-nowrap text-left text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
    >
      {copied ? "Link copied ✓" : "Share POD link ↗"}
    </button>
  );
}
