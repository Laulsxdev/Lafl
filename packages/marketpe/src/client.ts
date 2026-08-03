import type {
  MarketPeEway,
  MarketPeListResponse,
  MarketPePayment,
  MarketPeTrip,
  MarketPeVehicle,
  MarketPeVendor,
  TimeRange,
  VehicleListFilters,
  VendorListFilters,
} from "./types";

const DEFAULT_BASE_URL = "https://marketpe-api.azurewebsites.net/app-api";
const MAX_WINDOW_DAYS = 32;

export class MarketPeError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body: string,
  ) {
    super(`MarketPe ${path} failed with HTTP ${status}: ${body.slice(0, 300)}`);
    this.name = "MarketPeError";
  }
}

export interface MarketPeClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class MarketPeClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(opts: MarketPeClientOptions) {
    if (!opts.apiKey) throw new Error("MarketPeClient requires an apiKey");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}/${path}`, {
      method: "POST",
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) throw new MarketPeError(res.status, path, text);
    return JSON.parse(text) as T;
  }

  vendorList(filters: VendorListFilters = {}) {
    return this.post<MarketPeListResponse<MarketPeVendor>>("vendor/list", filters);
  }

  vehicleList(filters: VehicleListFilters = {}) {
    return this.post<MarketPeListResponse<MarketPeVehicle>>("vehicle/list", filters);
  }

  tripList(range: TimeRange) {
    assertWindow(range);
    return this.post<MarketPeListResponse<MarketPeTrip>>("trip-simple/list", range);
  }

  paymentList(range: TimeRange) {
    assertWindow(range);
    return this.post<MarketPeListResponse<MarketPePayment>>("payment/list", range);
  }

  ewayGet(params: { ewayBillNumber: string; gstin: string }) {
    return this.post<MarketPeEway>("eway/get", params);
  }
}

function assertWindow(range: TimeRange): void {
  const from = Date.parse(range.createdTimeFrom);
  const to = Date.parse(range.createdTimeTo);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    throw new Error("createdTimeFrom/createdTimeTo must be ISO 8601 timestamps");
  }
  const days = (to - from) / 86_400_000;
  if (days > MAX_WINDOW_DAYS) {
    throw new Error(
      `MarketPe list windows may not exceed ${MAX_WINDOW_DAYS} days (got ${Math.ceil(days)})`,
    );
  }
}

/** Chunk an arbitrary range into <=32-day windows for sync jobs. */
export function chunkRange(fromIso: string, toIso: string): TimeRange[] {
  const windows: TimeRange[] = [];
  let cursor = new Date(fromIso);
  const end = new Date(toIso);
  while (cursor < end) {
    const next = new Date(
      Math.min(cursor.getTime() + MAX_WINDOW_DAYS * 86_400_000, end.getTime()),
    );
    windows.push({
      createdTimeFrom: cursor.toISOString(),
      createdTimeTo: next.toISOString(),
    });
    cursor = next;
  }
  return windows;
}
