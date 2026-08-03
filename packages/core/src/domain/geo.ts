export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function isInsideGeofence(
  point: LatLng,
  center: LatLng,
  radiusM: number,
): boolean {
  return haversineMeters(point, center) <= radiusM;
}

/** A GPS fix older than this is too stale to trigger geofence transitions. */
export const MAX_FIX_AGE_MS = 5 * 60 * 1000;
/** Consecutive in-fence fixes required before we trust an enter event. */
export const GEOFENCE_DEBOUNCE_FIXES = 2;
/** No GPS for this long during in_transit => amber alert. */
export const GPS_SILENT_WARN_MS = 30 * 60 * 1000;
/** No GPS for this long => red alert + call task. */
export const GPS_SILENT_CRITICAL_MS = 2 * 60 * 60 * 1000;
