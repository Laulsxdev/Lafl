"use server";

import { uploadPodViaToken } from "@/server/services/pod-public.service";

export interface PodUploadState {
  ok: boolean;
  error?: string;
}

export async function uploadPodPublicAction(
  _prev: PodUploadState,
  formData: FormData,
): Promise<PodUploadState> {
  try {
    const token = String(formData.get("token") ?? "");
    const ewbId = String(formData.get("ewbId") ?? "") || null;
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Please take a photo first" };
    }
    const lat = Number(formData.get("lat"));
    const lng = Number(formData.get("lng"));
    const capture =
      Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
        ? { lat, lng }
        : null;
    await uploadPodViaToken(token, ewbId, file, capture);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
  }
}
