export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-lg bg-neutral-200" />
        <div className="h-4 w-72 rounded bg-neutral-100" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-neutral-200 bg-neutral-100" />
        ))}
      </div>
      <div className="h-72 rounded-xl border border-neutral-200 bg-neutral-100" />
    </div>
  );
}
