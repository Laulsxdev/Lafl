/** Shared status chip styles — one look across every page. */
export const STATUS_PILL: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  planned: "bg-blue-50 text-blue-700",
  ready: "bg-indigo-50 text-indigo-700",
  in_transit: "bg-amber-50 text-amber-700",
  at_destination: "bg-cyan-50 text-cyan-700",
  unloaded: "bg-teal-50 text-teal-700",
  ops_closed: "bg-green-50 text-green-700",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-50 text-red-700",
  aborted: "bg-red-100 text-red-800",
};

export const statusLabel = (s: string) => s.replace(/_/g, " ");
