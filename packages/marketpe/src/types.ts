/**
 * MarketPe response shapes. The public docs abbreviate several objects
 * (e.g. vehicle `rc`/`fastag`), so every record keeps an index signature and
 * callers must treat undocumented fields defensively. Full raw payloads are
 * persisted to *_raw / raw_json columns for later backfill.
 */

export type VendorType =
  | "BROKER"
  | "VEHICLE_OWNER"
  | "DRIVER"
  | "VENDOR"
  | "EMPLOYEE";

export type VehicleOwnerType = "OWNED" | "MARKET" | "ATTACHED";

export interface MarketPeListResponse<T> {
  status: string;
  data: T[];
  [key: string]: unknown;
}

export interface MarketPeVendor {
  id: string;
  autoIdentifier?: string;
  identifier?: string;
  name?: string;
  phone?: string;
  type?: VendorType;
  [key: string]: unknown;
}

export interface MarketPeVehicle {
  id: string;
  createdTime?: string;
  autoIdentifier?: string;
  autoIdentifierNumber?: number;
  registrationNumber?: string;
  vehicleOwnerType?: VehicleOwnerType;
  customFieldValues?: Record<string, unknown>;
  rc?: Record<string, unknown>;
  fastag?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MarketPeTrip {
  id: string;
  autoIdentifier?: string;
  [key: string]: unknown;
}

export interface MarketPePayment {
  id: string;
  clientPaymentId?: string | null;
  [key: string]: unknown;
}

export interface MarketPeEway {
  ewayBillNumber?: string;
  [key: string]: unknown;
}

export interface VendorListFilters {
  createdTimeFrom?: string;
  createdTimeTo?: string;
  type?: VendorType;
  phone?: string;
}

export interface VehicleListFilters {
  createdTimeFrom?: string;
  createdTimeTo?: string;
  vehicleOwnerType?: VehicleOwnerType;
  status?: "ACTIVE" | "INACTIVE";
}

/** trip/list and payment/list windows may not exceed 32 days. */
export interface TimeRange {
  createdTimeFrom: string;
  createdTimeTo: string;
}
