import { signIn } from "./actions";
import { BrandMark, bannerError, btnPrimary, inputCls, labelCls } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-neutral-50 p-4 sm:p-6">
      {/* quiet backdrop: soft top glow + hairline grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(23,23,23,0.06),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(23,23,23,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(23,23,23,0.025)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-neutral-900">
                Lafl TMS
              </h1>
              <p className="text-xs text-neutral-500">
                Transportation Management System
              </p>
            </div>
          </div>

          <h2 className="mt-7 text-sm font-semibold text-neutral-900">
            Sign in to your workspace
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Use the credentials provided by your administrator.
          </p>

          {error && <p className={`mt-4 ${bannerError}`}>{error}</p>}

          <form action={signIn} className="mt-5 space-y-4">
            <div>
              <label htmlFor="email" className={labelCls}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="password" className={labelCls}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputCls}
              />
            </div>
            <button type="submit" className={`${btnPrimary} w-full py-2.5`}>
              Sign in
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-neutral-400">
          Fleet operations, settlements and billing — one place.
        </p>
      </div>
    </main>
  );
}
