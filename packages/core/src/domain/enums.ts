import type { Database } from "../database.types";

type Enums = Database["public"]["Enums"];

export type UserRole = Enums["user_role"];
export type TripStatus = Enums["trip_status"];
export type PodTrackStatus = Enums["pod_track_status"];
export type SettlementTrackStatus = Enums["settlement_track_status"];
export type BillingTrackStatus = Enums["billing_track_status"];
export type EwbStatus = Enums["ewb_status"];
export type VehicleOwnership = Enums["vehicle_ownership"];
export type VehicleStatus = Enums["vehicle_status"];
export type DriverStatus = Enums["driver_status"];
export type TripDriverRole = Enums["trip_driver_role"];
export type PayMode = Enums["pay_mode"];
export type PodSource = Enums["pod_source"];
export type NotifChannel = Enums["notif_channel"];

/** Trip statuses during which a vehicle/EWB is considered occupied. */
export const LIVE_TRIP_STATUSES: readonly TripStatus[] = [
  "planned",
  "ready",
  "in_transit",
  "at_destination",
  "unloaded",
] as const;

export const STAFF_ROLES: readonly UserRole[] = [
  "admin",
  "supervisor",
  "accountant",
] as const;

export const CHARGE_TYPES = [
  "freight",
  "diesel",
  "driver_allowance",
  "toll",
  "fastag",
  "loading",
  "unloading",
  "detention",
  "misc",
] as const;
export type ChargeType = (typeof CHARGE_TYPES)[number];
