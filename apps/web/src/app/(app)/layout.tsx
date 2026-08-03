import { requireProfile } from "@/server/auth";
import { signOut } from "@/app/login/actions";
import NavLinks from "@/components/nav-links";
import { BrandMark } from "@/components/ui";

const NAV = {
  staff: [
    { href: "/", label: "Dashboard" },
    { href: "/trips", label: "Trips" },
    { href: "/pods", label: "PODs" },
    { href: "/settlements", label: "Settlements" },
    { href: "/invoices", label: "Invoices" },
    { href: "/vehicles", label: "Vehicles" },
    { href: "/drivers", label: "Drivers" },
    { href: "/sites", label: "Sites" },
  ],
  super_admin: [{ href: "/admin", label: "Organizations" }],
};

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await requireProfile();
  const links =
    profile.role === "super_admin" ? NAV.super_admin : NAV.staff;
  const orgLabel =
    profile.role === "super_admin"
      ? "Platform Admin"
      : (profile.organizations?.name ?? "No organization");
  const initials =
    (profile.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w: string) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
        {/* Brand + org badge */}
        <div className="flex items-center gap-2.5 border-b border-neutral-100 px-4 py-4">
          <BrandMark className="h-9 w-9" />
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-neutral-900">
              Lafl TMS
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500"
              />
              <span className="truncate text-[11px] font-medium text-neutral-500">
                {orgLabel}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          <NavLinks links={links} />
        </nav>

        {/* User + sign out */}
        <div className="border-t border-neutral-100 p-3">
          <div className="flex items-center gap-2.5 px-2 pb-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
              {initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-neutral-900">
                {profile.name}
              </div>
              <div className="text-[11px] capitalize text-neutral-500">
                {profile.role.replace("_", " ")}
              </div>
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0"
                aria-hidden
              >
                <path d="M13.5 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h7.5" />
                <path d="m16 8 4 4-4 4M20 12H9.5" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
