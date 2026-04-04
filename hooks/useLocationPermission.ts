import { useState, useEffect } from "react";
import * as Location from "expo-location";

export type PermissionStatus = "undetermined" | "granted" | "denied";

export function useLocationPermission() {
  const [status, setStatus] = useState<PermissionStatus>("undetermined");

  useEffect(() => {
    // Chequear si ya hay permiso previo sin interrumpir al usuario
    Location.getForegroundPermissionsAsync().then(({ status: s }) => {
      if (s === "granted") setStatus("granted");
      else if (s === "denied") setStatus("denied");
    });
  }, []);

  const requestPermission = async () => {
    const { status: s } = await Location.requestForegroundPermissionsAsync();
    setStatus(s === "granted" ? "granted" : "denied");
    return s === "granted";
  };

  return { status, setStatus, requestPermission };
}
