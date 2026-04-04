import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import { LatLng, isInsideCampus } from "@/lib/parking-data";

export type GeofenceStatus = "unknown" | "inside" | "outside";

export function useUCCGeofence() {
  const [status, setStatus] = useState<GeofenceStatus>("unknown");
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  const check = useCallback(async () => {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      setStatus("unknown");
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coord: LatLng = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserLocation(coord);
      setStatus(isInsideCampus(coord) ? "inside" : "outside");
    } catch {
      setStatus("unknown");
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { status, userLocation, recheck: check };
}
