"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PayMode, TripStatus } from "@lafl/core";
import type { ActionResult } from "@/lib/action-result";
import { requireOrgStaff } from "@/server/auth";
import * as trips from "@/server/services/trip.service";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => str(fd, k) || null;
const dt = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v ? new Date(v).toISOString() : null;
};

function isRedirect(err: unknown): boolean {
  return !!err && typeof err === "object" && "digest" in err;
}

/**
 * In-place action runner: no redirect, so the page never jumps or reloads.
 * Success revalidates everything (small data set — simpler than tracking
 * exactly which lists a mutation touches) and the result renders inline
 * next to the form via <ActionForm>.
 */
async function act(fn: () => Promise<unknown>, okMsg: string): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: okMsg };
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: err instanceof Error ? err.message : "Something went wrong" };
  }
}

// ── Navigation actions (these MOVE pages, so they keep redirects) ──

export async function createTrip(formData: FormData) {
  const profile = await requireOrgStaff();
  const vehicleId = str(formData, "vehicleId");
  let tripId: string;
  try {
    tripId = await trips.createDraftTrip(profile, vehicleId);
  } catch (err) {
    if (isRedirect(err)) throw err;
    const msg = err instanceof Error ? err.message : "Could not create trip";
    redirect(`/trips/new?error=${encodeURIComponent(msg)}`);
  }
  redirect(`/trips/${tripId}?ok=${encodeURIComponent("Draft trip created — attach E-Way Bills")}`);
}

/** EWB-first creation: one submit = draft trip + fetched E-Way Bill attached. */
export async function createTripFromEwb(formData: FormData) {
  const profile = await requireOrgStaff();
  const vehicleId = str(formData, "vehicleId");
  const ewbNo = str(formData, "ewbNo");
  let tripId: string;
  try {
    tripId = await trips.createDraftTrip(profile, vehicleId);
    await trips.attachEwb(profile, tripId, ewbNo);
  } catch (err) {
    if (isRedirect(err)) throw err;
    const msg = err instanceof Error ? err.message : "Could not create trip";
    redirect(`/trips/new?error=${encodeURIComponent(msg)}`);
  }
  redirect(
    `/trips/${tripId}?ok=${encodeURIComponent("Trip created from E-Way Bill — set route, crew and money next")}`,
  );
}

/** Draft-only hard delete — lands on the list with a banner. */
export async function deleteTripAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  try {
    await trips.deleteDraftTrip(profile, tripId);
  } catch (err) {
    if (isRedirect(err)) throw err;
    const msg = err instanceof Error ? err.message : "Could not delete the draft";
    redirect(`/trips/${tripId}?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/trips");
  redirect(`/trips?ok=${encodeURIComponent("Draft trip deleted")}`);
}

// ── In-place actions (result shows inline, page never jumps) ──

export async function attachEwbFetch(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  return act(() => trips.attachEwb(profile, tripId, str(formData, "ewbNo")), "E-Way Bill fetched & attached");
}

export async function attachEwbManualAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  const weight = opt(formData, "weightKg");
  return act(
    () =>
      trips.attachEwbManual(profile, tripId, {
        ewbNo: str(formData, "ewbNo"),
        consignorName: opt(formData, "consignorName"),
        consigneeName: opt(formData, "consigneeName"),
        origin: opt(formData, "origin"),
        destination: opt(formData, "destination"),
        material: opt(formData, "material"),
        weightKg: weight ? Number(weight) : null,
        invoiceNo: opt(formData, "invoiceNo"),
        validUntil: dt(formData, "validUntil"),
      }),
    "Consignment added",
  );
}

export async function detachEwbAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  return act(() => trips.detachEwb(profile, tripId, str(formData, "ewbId")), "E-Way Bill removed");
}

export async function savePlan(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  return act(
    () =>
      trips.updatePlan(profile, tripId, {
        routeId: opt(formData, "routeId"),
        plannedStart: dt(formData, "plannedStart"),
        eta: dt(formData, "eta"),
        notes: opt(formData, "notes"),
      }),
    "Plan saved",
  );
}

export async function saveCrew(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  const primary = str(formData, "primaryDriverId");
  return act(async () => {
    if (!primary) throw new Error("Select a primary driver");
    await trips.setCrew(profile, tripId, {
      primaryDriverId: primary,
      secondaryDriverId: opt(formData, "secondaryDriverId"),
    });
  }, "Crew assigned");
}

export async function loadCharges(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  return act(() => trips.ensureCharges(profile, tripId), "Charges loaded");
}

export async function saveChargeAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  return act(
    () =>
      trips.saveCharge(profile, tripId, str(formData, "chargeId"), Number(str(formData, "amount") || "0")),
    "Charge updated",
  );
}

export async function addChargeAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  return act(
    () =>
      trips.addCharge(profile, tripId, str(formData, "chargeType"), Number(str(formData, "amount") || "0")),
    "Charge added",
  );
}

export async function deleteChargeAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  return act(() => trips.deleteCharge(profile, tripId, str(formData, "chargeId")), "Charge removed");
}

export async function addAdvanceAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  return act(
    () =>
      trips.addAdvance(profile, tripId, {
        driverId: str(formData, "driverId"),
        amount: Number(str(formData, "amount") || "0"),
        mode: str(formData, "mode") as PayMode,
        refNo: opt(formData, "refNo"),
      }),
    "Advance recorded",
  );
}

export async function activateTrip(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  return act(() => trips.approveAndActivate(profile, tripId), "Trip is READY — driver can start");
}

export async function transitionAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  const to = str(formData, "to") as TripStatus;
  return act(
    () => trips.transitionTrip(profile, tripId, to, opt(formData, "reason") ?? undefined),
    "Status updated",
  );
}

// ── POD & Settlements ────────────────────────────────────────

export async function uploadPodAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  const file = formData.get("file");
  return act(async () => {
    const { uploadPod } = await import("@/server/services/pod.service");
    if (!(file instanceof File)) throw new Error("Choose a file first");
    await uploadPod(profile, tripId, opt(formData, "ewbId"), file);
  }, "POD uploaded — waiting for verification");
}

export async function verifyPodAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  return act(async () => {
    const { verifyPod } = await import("@/server/services/pod.service");
    await verifyPod(profile, str(formData, "podId"));
  }, "POD verified");
}

export async function rejectPodAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  return act(async () => {
    const { rejectPod } = await import("@/server/services/pod.service");
    await rejectPod(profile, str(formData, "podId"), str(formData, "reason"));
  }, "POD rejected — driver will be notified");
}

export async function generateSettlementsAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  return act(async () => {
    const { generateSettlements } = await import("@/server/services/settlement.service");
    await generateSettlements(profile, tripId);
  }, "Settlements generated");
}

export async function updateSettlementAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  return act(async () => {
    const { updateSettlement } = await import("@/server/services/settlement.service");
    await updateSettlement(profile, str(formData, "settlementId"), {
      gross: Number(str(formData, "gross") || "0"),
      bonus: Number(str(formData, "bonus") || "0"),
      penalty: Number(str(formData, "penalty") || "0"),
      penaltyReason: opt(formData, "penaltyReason"),
    });
  }, "Settlement updated");
}

export async function markSettlementPaidAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  return act(async () => {
    const { markSettlementPaid } = await import("@/server/services/settlement.service");
    await markSettlementPaid(profile, str(formData, "settlementId"), {
      mode: str(formData, "mode") as PayMode,
      refNo: opt(formData, "refNo"),
    });
  }, "Settlement PAID");
}

// ── Customer invoicing ───────────────────────────────────────

export async function generateInvoiceAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  return act(async () => {
    const { generateInvoice } = await import("@/server/services/invoice.service");
    const contractLineId = opt(formData, "contractLineId");
    await generateInvoice(profile, tripId, {
      customerId: str(formData, "customerId"),
      contractLineId,
      manualRatePerMt: opt(formData, "manualRate") ? Number(str(formData, "manualRate")) : null,
      weightMt: Number(str(formData, "weightMt") || "0"),
      otherCharges: Number(str(formData, "otherCharges") || "0"),
      gstAmount: Number(str(formData, "gstAmount") || "0"),
    });
  }, "Invoice raised");
}

export async function recordReceiptAction(_: ActionResult, formData: FormData) {
  const profile = await requireOrgStaff();
  return act(async () => {
    const { recordReceipt } = await import("@/server/services/invoice.service");
    await recordReceipt(profile, str(formData, "invoiceId"), Number(str(formData, "amount") || "0"));
  }, "Receipt recorded");
}
