import type { TripStatus } from "./enums";

/**
 * Operational state machine for a trip. POD / settlement / billing run as
 * parallel tracks on the trips row and are NOT part of this machine.
 */
export const TRIP_TRANSITIONS: Record<TripStatus, readonly TripStatus[]> = {
  draft: ["planned", "cancelled"],
  planned: ["ready", "cancelled"],
  ready: ["in_transit", "cancelled"],
  in_transit: ["at_destination", "aborted"],
  at_destination: ["unloaded", "aborted"],
  unloaded: ["ops_closed", "aborted"],
  ops_closed: ["completed"],
  completed: [],
  cancelled: [],
  aborted: [],
};

/** Transitions that only the system (geofence/worker) may apply automatically. */
export const AUTO_TRANSITIONS: ReadonlyArray<[TripStatus, TripStatus]> = [
  ["in_transit", "at_destination"], // geofence enter
  ["unloaded", "ops_closed"], // geofence exit after unload
];

/** Transitions requiring an explicit reason (and admin approval for aborts). */
export const REASON_REQUIRED: readonly TripStatus[] = ["cancelled", "aborted"];

export function canTransition(from: TripStatus, to: TripStatus): boolean {
  return TRIP_TRANSITIONS[from].includes(to);
}

export class InvalidTripTransitionError extends Error {
  constructor(
    public readonly from: TripStatus,
    public readonly to: TripStatus,
  ) {
    super(`Invalid trip transition: ${from} -> ${to}`);
    this.name = "InvalidTripTransitionError";
  }
}

export function assertTransition(from: TripStatus, to: TripStatus): void {
  if (!canTransition(from, to)) throw new InvalidTripTransitionError(from, to);
}

/** Whether the vehicle is freed for its next trip in this status. */
export function releasesVehicle(status: TripStatus): boolean {
  return ["ops_closed", "completed", "cancelled", "aborted"].includes(status);
}
