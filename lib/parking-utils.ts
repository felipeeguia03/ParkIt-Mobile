import { ParkingZone, ParkingSpot, SpotStatus } from "./parking-data";

// Exportado para tests. Usado en useParkingState.ts.
export function applyStatusMap(
  zones: ParkingZone[],
  map: Map<string, SpotStatus>
): ParkingZone[] {
  return zones.map((zone) => ({
    ...zone,
    spots: zone.spots.map((spot) => ({
      ...spot,
      status: map.get(spot.id) ?? spot.status,
    })),
  }));
}

export function updateOneSpot(
  zones: ParkingZone[],
  spotId: string,
  status: SpotStatus
): ParkingZone[] {
  return zones.map((zone) => {
    // Si el spot no está en esta zona, devolver la misma referencia.
    // ZoneLayer y SpotsLayer pueden aprovechar esto para skip de memo.
    if (!zone.spots.some((s) => s.id === spotId)) return zone;
    return {
      ...zone,
      spots: zone.spots.map((s) => (s.id === spotId ? { ...s, status } : s)),
    };
  });
}
