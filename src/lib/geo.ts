/** Haversine distance in meters between two GPS points */
export function distanceMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Distance in KM (rounded to 2 decimals) */
export function distanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  if (
    lat1 == null || lng1 == null || lat2 == null || lng2 == null ||
    Number.isNaN(lat1) || Number.isNaN(lng1) || Number.isNaN(lat2) || Number.isNaN(lng2)
  ) return 0;
  return Math.round(distanceMeters(lat1, lng1, lat2, lng2) / 10) / 100;
}

/** Get current GPS position as a Promise. Tries high-accuracy first, falls back to low-accuracy + cached. */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation not supported by this browser."));
      return;
    }
    const friendly = (err: GeolocationPositionError) => {
      if (err.code === 1) return new Error("Location permission denied. Please allow location access in your browser settings.");
      if (err.code === 2) return new Error("Location unavailable. Check your GPS / network connection.");
      if (err.code === 3) return new Error("Location request timed out. Move to an open area and try again.");
      return new Error(err.message || "Failed to get location.");
    };
    navigator.geolocation.getCurrentPosition(
      resolve,
      // High-accuracy failed → try a faster, lower-accuracy attempt with cache.
      (firstErr) => {
        console.warn("[geo] high-accuracy failed, falling back:", firstErr);
        navigator.geolocation.getCurrentPosition(
          resolve,
          (err) => reject(friendly(err)),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
