/** Return shape for in-place server actions (no redirect, no page jump). */
export interface ActionResult {
  ok?: string;
  error?: string;
}
