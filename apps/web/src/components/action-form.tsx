"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/action-result";

/**
 * Form wrapper for in-place server actions: submits without navigating, shows
 * the result right next to the form, and lets revalidation refresh the page
 * data in the background — no scroll jump, no full re-render flash.
 */
export default function ActionForm({
  action,
  className,
  resetOnOk = false,
  children,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  className?: string;
  /** Clear inputs after success — for "add another" style forms. */
  resetOnOk?: boolean;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {} as ActionResult);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state.error && (
        <p className="w-full text-xs font-medium text-red-600">{state.error}</p>
      )}
      {state.ok && !state.error && (
        <p className="w-full text-xs font-medium text-green-700">✓ {state.ok}</p>
      )}
    </form>
  );
}
