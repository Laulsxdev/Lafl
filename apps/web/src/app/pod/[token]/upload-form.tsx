"use client";

import { useActionState, useRef, useState } from "react";
import { uploadPodPublicAction, type PodUploadState } from "./actions";
import type { PodTokenEwb } from "@/server/services/pod-public.service";

/**
 * Cheap on-device photo checks (no ML): mean brightness + edge energy on a
 * downscaled grayscale copy. Soft warnings only — the field beats heuristics,
 * so a determined user can always upload anyway.
 */
async function checkPhoto(file: File): Promise<string[]> {
  if (!file.type.startsWith("image/")) return [];
  try {
    const bitmap = await createImageBitmap(file);
    const w = 256;
    const h = Math.max(1, Math.round((bitmap.height / bitmap.width) * w));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.drawImage(bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const gray = new Float32Array(w * h);
    let sum = 0;
    for (let i = 0; i < w * h; i++) {
      const g =
        0.299 * (data[i * 4] ?? 0) +
        0.587 * (data[i * 4 + 1] ?? 0) +
        0.114 * (data[i * 4 + 2] ?? 0);
      gray[i] = g;
      sum += g;
    }
    const brightness = sum / (w * h);

    // Laplacian variance — low means few edges, i.e. probably blurred.
    let lapSum = 0;
    let lapSq = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const v =
          4 * (gray[i] ?? 0) -
          (gray[i - 1] ?? 0) -
          (gray[i + 1] ?? 0) -
          (gray[i - w] ?? 0) -
          (gray[i + w] ?? 0);
        lapSum += v;
        lapSq += v * v;
        n++;
      }
    }
    const mean = lapSum / n;
    const sharpness = lapSq / n - mean * mean;

    const warnings: string[] = [];
    if (brightness < 40) warnings.push("The photo looks very dark — try again with more light.");
    if (brightness > 235) warnings.push("The photo looks washed out — avoid direct glare.");
    if (sharpness < 60) warnings.push("The photo looks blurry — hold the phone steady and retake.");
    return warnings;
  } catch {
    return [];
  }
}

export default function PodUploadForm({
  token,
  ewbs,
}: {
  token: string;
  ewbs: PodTokenEwb[];
}) {
  const [state, formAction, pending] = useActionState<PodUploadState, FormData>(
    uploadPodPublicAction,
    { ok: false },
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (state.ok && fileName) {
    return (
      <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-6 text-center sm:p-8">
        <div className="text-5xl">✅</div>
        <h2 className="mt-3 text-balance text-xl font-bold text-green-800">
          POD received — thank you!
        </h2>
        <p className="mt-2 text-sm text-green-700">
          Our team will check and confirm it. Nothing else to do.
        </p>
        <button
          type="button"
          className="mt-6 w-full rounded-xl border border-green-300 bg-white px-5 py-3 text-sm font-semibold text-green-800 sm:w-auto"
          onClick={() => {
            setFileName(null);
            setPreview(null);
            setWarnings([]);
            setUploadedCount((c) => c + 1);
            formRef.current?.reset();
          }}
        >
          Upload another photo
        </button>
      </div>
    );
  }

  const onFile = async (f: File | null) => {
    setWarnings([]);
    setPreview(null);
    setFileName(f ? f.name : null);
    if (!f) return;
    if (f.type.startsWith("image/")) setPreview(URL.createObjectURL(f));
    setWarnings(await checkPhoto(f));
    // Proof of capture point — best effort, never blocks the upload.
    if (!coords && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 },
      );
    }
  };

  return (
    <form ref={formRef} action={formAction} className="mt-6" key={uploadedCount}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />

      <input
        ref={inputRef}
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl bg-neutral-900 px-4 py-5 text-base font-bold text-white shadow-lg active:scale-[0.99] sm:px-6 sm:text-lg"
      >
        📷 {fileName ? "Retake photo" : "Take POD photo"}
      </button>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="POD preview"
          className="mx-auto mt-4 max-h-64 w-full max-w-full rounded-xl border border-neutral-200 object-contain sm:max-h-72"
        />
      )}
      {fileName && !preview && (
        <p className="mt-3 break-all text-center text-sm text-neutral-600">
          Selected: {fileName}
        </p>
      )}

      {warnings.map((wr) => (
        <p
          key={wr}
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          ⚠️ {wr}
        </p>
      ))}

      {fileName && ewbs.length > 1 && (
        <div className="mt-4">
          <label className="block text-sm font-semibold text-neutral-700">
            Which consignment is this POD for?
          </label>
          <select
            name="ewbId"
            className="mt-1 w-full max-w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-base"
            defaultValue=""
          >
            <option value="">Whole trip (all consignments)</option>
            {ewbs.map((e) => (
              <option key={e.id} value={e.id}>
                {e.consignee_name ?? "Consignee"} · EWB {e.ewb_no}
              </option>
            ))}
          </select>
        </div>
      )}

      {state.error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {fileName && (
        <button
          type="submit"
          disabled={pending}
          className="mt-4 w-full rounded-2xl bg-green-600 px-4 py-5 text-base font-bold text-white shadow-lg active:scale-[0.99] disabled:opacity-60 sm:px-6 sm:text-lg"
        >
          {pending ? "Uploading…" : "Upload POD ✓"}
        </button>
      )}

      <p className="mt-6 text-balance text-center text-xs text-neutral-400">
        JPG / PNG / PDF · max 10 MB · photo goes directly to the transport office
      </p>
    </form>
  );
}
