import type { Metadata } from "next";
import { resolvePodToken } from "@/server/services/pod-public.service";
import PodUploadForm from "./upload-form";

export const metadata: Metadata = {
  title: "Upload POD",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-white px-4 py-6 sm:px-5 sm:py-8">
      {children}
    </main>
  );
}

export default async function PodUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolvePodToken(token);

  if (resolved.kind === "not_found") {
    return (
      <Shell>
        <div className="mt-12 text-center sm:mt-16">
          <div className="text-5xl">🔗</div>
          <h1 className="mt-4 text-balance text-xl font-bold text-neutral-900">
            This link is not valid anymore
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            The trip may be finished or the link has changed. Please ask the transport
            office for a new link.
          </p>
        </div>
      </Shell>
    );
  }

  if (resolved.kind === "no_live_trip") {
    return (
      <Shell>
        <div className="mt-12 text-center sm:mt-16">
          <div className="text-5xl">🚛</div>
          <h1 className="mt-4 text-balance break-words text-xl font-bold text-neutral-900">
            No running trip for {resolved.regNo}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            This vehicle has no trip waiting for a POD right now.
          </p>
        </div>
      </Shell>
    );
  }

  const header = (
    <header className="border-b border-neutral-200 pb-4">
      <p className="break-words text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {resolved.orgName} · Proof of Delivery
      </p>
      <h1 className="mt-1 break-words text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
        {resolved.tripNo}
      </h1>
      <p className="mt-0.5 break-words text-sm text-neutral-600">
        {resolved.regNo}
        {resolved.destination ? ` · to ${resolved.destination}` : ""}
      </p>
    </header>
  );

  if (resolved.kind === "done") {
    return (
      <Shell>
        {header}
        <div className="mt-10 text-center sm:mt-12">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-4 text-balance text-xl font-bold text-green-700">
            POD already received & verified
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Everything is complete for this trip. Thank you!
          </p>
        </div>
      </Shell>
    );
  }

  if (resolved.kind === "not_ready") {
    return (
      <Shell>
        {header}
        <div className="mt-10 text-center sm:mt-12">
          <div className="text-5xl">🛣️</div>
          <h2 className="mt-4 text-balance text-xl font-bold text-neutral-900">
            Trip is still on the way
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            POD upload opens once the vehicle reaches the destination. Come back to this
            page after unloading.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {header}
      <p className="mt-5 text-sm text-neutral-600">
        After unloading, take a clear photo of the <strong>signed & stamped bilty/POD</strong>{" "}
        and upload it here.
      </p>
      <PodUploadForm token={token} ewbs={resolved.ewbs} />
    </Shell>
  );
}
