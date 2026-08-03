"use client";

import { useEffect } from "react";

/**
 * Global "wait a moment" feedback: the instant ANY form submits, that form
 * dims + its submit button grows a spinner (CSS in globals.css) and a slim
 * progress bar slides across the top. The next server render resets it all.
 */
export default function FormPending() {
  useEffect(() => {
    const bar = document.createElement("div");
    bar.id = "lafl-progress";
    document.body.appendChild(bar);

    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement | null;
      if (form?.tagName === "FORM") {
        form.setAttribute("data-pending", "");
        requestAnimationFrame(() => bar.classList.add("active"));
      }
    };
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      bar.remove();
    };
  }, []);
  return null;
}
