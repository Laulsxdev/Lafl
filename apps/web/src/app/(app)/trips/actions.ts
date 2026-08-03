"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PayMode, TripStatus } from "@lafl/core";
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

async function run(
  tripId: string | null,
  fn: () => Promise<void | string>,
  okMsg: string,
) {
  try {
    const newId = await fn();
    const id = typeof newId === "string" ? newId : tripId;
    revalidatePath(id ? `/trips/${id}` : "/trips");
    redirect(`/trips/${id}?ok=${encodeURIComponent(okMsg)}`);
  } catch (err) {
    if (isRedirect(err)) throw err;
    const msg = err instanceof Error ? err.message : "Something went wrong";
    redirect(
      tripId
        ? `/trips/${tripId}?error=${encodeURIComponent(msg)}`
        : `/trips/new?error=${encodeURIComponent(msg)}`,
    );
  }
}

export async function createTrip(formData: FormData) {
  const profile = await requireOrgStaff();
  const vehicleId = str(formData, "vehicleId");
  await run(null, () => trips.createDraftTrip(profile, vehicleId), "Draft trip created — attach E-Way Bills");
}

/** Draft-only hard delete — the list page gets the success banner. */
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

/** EWB-first creation: one submit = draft trip + fetched E-Way Bill attached. */
export async function createTripFromEwb(formData: FormData) {
  const profile = await requireOrgStaff();
  const vehicleId = str(formData, "vehicleId");
  const ewbNo = str(formData, "ewbNo");
  await run(
    null,
    async () => {
      const tripId = await trips.createDraftTrip(profile, vehicleId);
      await trips.attachEwb(profile, tripId, ewbNo);
      return tripId;
    },
    "Trip created from E-Way Bill — set route, crew and money next",
  );
}

export async function attachEwbFetch(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(
    tripId,
    () => trips.attachEwb(profile, tripId, str(formData, "ewbNo")),
    "E-Way Bill fetched & attached",
  );
}

export async function attachEwbManualAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  const weight = opt(formData, "weightKg");
  await run(
    tripId,
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

export async function detachEwbAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(tripId, () => trips.detachEwb(profile, tripId, str(formData, "ewbId")), "E-Way Bill removed");
}

export async function savePlan(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(
    tripId,
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

export async function saveCrew(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  const primary = str(formData, "primaryDriverId");
  await run(
    tripId,
    async () => {
      if (!primary) throw new Error("Select a primary driver");
      await trips.setCrew(profile, tripId, {
        primaryDriverId: primary,
        secondaryDriverId: opt(formData, "secondaryDriverId"),
      });
    },
    "Crew assigned",
  );
}

export async function loadCharges(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(tripId, () => trips.ensureCharges(profile, tripId), "Charges loaded");
}

export async function saveChargeAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(
    tripId,
    () =>
      trips.saveCharge(
        profile,
        tripId,
        str(formData, "chargeId"),
        Number(str(formData, "amount") || "0"),
      ),
    "Charge updated",
  );
}

export async function addChargeAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(
    tripId,
    () =>
      trips.addCharge(
        profile,
        tripId,
        str(formData, "chargeType"),
        Number(str(formData, "amount") || "0"),
      ),
    "Charge added",
  );
}

export async function deleteChargeAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(
    tripId,
    () => trips.deleteCharge(profile, tripId, str(formData, "chargeId")),
    "Charge removed",
  );
}

export async function addAdvanceAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(
    tripId,
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

export async function activateTrip(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(tripId, () => trips.approveAndActivate(profile, tripId), "Trip is READY — driver can start");
}

export async function transitionAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  const to = str(formData, "to") as TripStatus;
  await run(
    tripId,
    () => trips.transitionTrip(profile, tripId, to, opt(formData, "reason") ?? undefined),
    `Status updated`,
  );
}

// ── POD & Settlements ────────────────────────────────────────

export async function uploadPodAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  const file = formData.get("file");
  await run(
    tripId,
    async () => {
      const { uploadPod } = await import("@/server/services/pod.service");
      if (!(file instanceof File)) throw new Error("Choose a file first");
      await uploadPod(profile, tripId, opt(formData, "ewbId"), file);
    },
    "POD uploaded — waiting for verification",
  );
}

export async function verifyPodAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  const back = str(formData, "back") || `/trips/${tripId}`;
  try {
    const { verifyPod } = await import("@/server/services/pod.service");
    await verifyPod(profile, str(formData, "podId"));
    revalidatePath(back);
    redirect(`${back}?ok=${encodeURIComponent("POD verified")}`);
  } catch (err) {
    if (isRedirect(err)) throw err;
    redirect(`${back}?error=${encodeURIComponent(err instanceof Error ? err.message : "Failed")}`);
  }
}

export async function rejectPodAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  const back = str(formData, "back") || `/trips/${tripId}`;
  try {
    const { rejectPod } = await import("@/server/services/pod.service");
    await rejectPod(profile, str(formData, "podId"), str(formData, "reason"));
    revalidatePath(back);
    redirect(`${back}?ok=${encodeURIComponent("POD rejected — driver will be notified")}`);
  } catch (err) {
    if (isRedirect(err)) throw err;
    redirect(`${back}?error=${encodeURIComponent(err instanceof Error ? err.message : "Failed")}`);
  }
}

export async function generateSettlementsAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(
    tripId,
    async () => {
      const { generateSettlements } = await import("@/server/services/settlement.service");
      await generateSettlements(profile, tripId);
    },
    "Settlements generated",
  );
}

export async function updateSettlementAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(
    tripId,
    async () => {
      const { updateSettlement } = await import("@/server/services/settlement.service");
      await updateSettlement(profile, str(formData, "settlementId"), {
        gross: Number(str(formData, "gross") || "0"),
        bonus: Number(str(formData, "bonus") || "0"),
        penalty: Number(str(formData, "penalty") || "0"),
        penaltyReason: opt(formData, "penaltyReason"),
      });
    },
    "Settlement updated",
  );
}

export async function markSettlementPaidAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(
    tripId,
    async () => {
      const { markSettlementPaid } = await import("@/server/services/settlement.service");
      await markSettlementPaid(profile, str(formData, "settlementId"), {
        mode: str(formData, "mode") as PayMode,
        refNo: opt(formData, "refNo"),
      });
    },
    "Settlement PAID",
  );
}

// ── Customer invoicing ───────────────────────────────────────

export async function generateInvoiceAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  await run(
    tripId,
    async () => {
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
    },
    "Invoice raised",
  );
}

export async function recordReceiptAction(formData: FormData) {
  const profile = await requireOrgStaff();
  const tripId = str(formData, "tripId");
  const back = str(formData, "back") || `/trips/${tripId}`;
  try {
    const { recordReceipt } = await import("@/server/services/invoice.service");
    await recordReceipt(profile, str(formData, "invoiceId"), Number(str(formData, "amount") || "0"));
    revalidatePath(back);
    redirect(`${back}?ok=${encodeURIComponent("Receipt recorded")}`);
  } catch (err) {
    if (isRedirect(err)) throw err;
    redirect(`${back}?error=${encodeURIComponent(err instanceof Error ? err.message : "Failed")}`);
  }
}
