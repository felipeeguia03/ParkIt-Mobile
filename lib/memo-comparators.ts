import { ParkingZone, ParkingSpot, SpotStatus } from "./parking-data";

// ── ZoneLayer ─────────────────────────────────────────────────────────────
// Re-renderiza solo cuando cambia focusedZoneId o el conteo de disponibles
// en alguna zona. Un cambio de "occupied" → "reported" (sin afectar available)
// no dispara re-render en ZoneLayer.
export interface ZoneLayerProps {
  zones: ParkingZone[];
  focusedZoneId: string | null;
  onZonePress: (zone: ParkingZone) => void;
}

export function zoneLayerComparator(prev: ZoneLayerProps, next: ZoneLayerProps): boolean {
  if (prev.focusedZoneId !== next.focusedZoneId) return false;
  if (prev.zones.length  !== next.zones.length)  return false;
  return prev.zones.every((z, i) => {
    const nz = next.zones[i];
    if (z.id !== nz.id) return false;
    const prevAvail = z.spots.filter((s) => s.status === "available").length;
    const nextAvail = nz.spots.filter((s) => s.status === "available").length;
    return prevAvail === nextAvail;
  });
}

// ── SpotsLayer ────────────────────────────────────────────────────────────
// Re-renderiza para pasar props frescos a los SpotPolygon hijos.
// Cada SpotPolygon decide si toca el hilo nativo.
export interface SpotsLayerProps {
  zone: ParkingZone;
  showNumbers: boolean;
  onSpotPress: (spot: ParkingSpot) => void;
  renderCount: number;
}

export function spotsLayerComparator(prev: SpotsLayerProps, next: SpotsLayerProps): boolean {
  if (prev.renderCount !== next.renderCount)          return false;
  if (prev.showNumbers !== next.showNumbers)          return false;
  if (prev.zone.id     !== next.zone.id)              return false;
  if (prev.zone.spots.length !== next.zone.spots.length) return false;
  return prev.zone.spots.every((s, i) => s.status === next.zone.spots[i].status);
}

// ── SpotPolygon ───────────────────────────────────────────────────────────
// Solo re-renderiza cuando cambia el status de ESE spot o showNumbers.
// Un Realtime update de 1 spot causa exactamente 1 re-render nativo.
export interface SpotPolygonProps {
  spot: ParkingSpot;
  zone: ParkingZone;
  idx: number;
  showNumbers: boolean;
  onPress: (spot: ParkingSpot) => void;
}

export function spotPolygonComparator(prev: SpotPolygonProps, next: SpotPolygonProps): boolean {
  return (
    prev.spot.status === next.spot.status &&
    prev.showNumbers === next.showNumbers
  );
}
