export type SpotStatus = "available" | "occupied" | "reported";

export interface ParkingSpot {
  id: string;
  number: number;
  status: SpotStatus;
}

export interface ParkingZone {
  id: string;
  name: string;
  spots: ParkingSpot[];
  position: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  zoomImage: string;
  spotLayout: {
    rows: number;
    cols: number;
    startTop: number;
    startLeft: number;
    areaWidth: number;
    areaHeight: number;
  };
}

const ZONE_A_STATUSES: SpotStatus[] = ["available","occupied","occupied","available","occupied","reported","occupied","available","occupied","occupied","available","available","occupied","occupied","available","occupied","occupied","available","occupied","reported","available","occupied","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","occupied","available","available","occupied","reported","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","occupied","available","occupied"];
const ZONE_B_STATUSES: SpotStatus[] = ["occupied","available","occupied","occupied","available","occupied","occupied","available","occupied","reported","available","occupied","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","occupied","available","available","occupied","reported","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","reported","occupied","available","occupied","occupied"];
const ZONE_C_STATUSES: SpotStatus[] = ["available","occupied","available","occupied","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","reported","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","reported","occupied","available","occupied","occupied","available","available","occupied","occupied","available","occupied","occupied","available","occupied","reported"];
const ZONE_D_STATUSES: SpotStatus[] = ["occupied","occupied","available","available","occupied","reported","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","reported","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","reported","occupied","available","occupied","occupied"];
const ZONE_E_STATUSES: SpotStatus[] = ["available","occupied","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","occupied","available","available","occupied","reported","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","reported","occupied","available","occupied","occupied","available","occupied","available","occupied","occupied","available","occupied","occupied","available","occupied"];

function createSpots(zoneId: string, statuses: SpotStatus[]): ParkingSpot[] {
  return statuses.map((status, i) => ({
    id: `${zoneId}${i + 1}`,
    number: i + 1,
    status,
  }));
}

export const initialParkingData: ParkingZone[] = [
  {
    id: "A",
    name: "Estacionamiento Norte",
    position: { top: 5, left: 70, width: 26, height: 40 },
    zoomImage: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202026-03-30%20at%207.41.40%E2%80%AFPM-E9S7iSr3AKSQJ5SR7EwVJmwnjqp0eF.png",
    spotLayout: { rows: 2, cols: 25, startTop: 10, startLeft: 5, areaWidth: 90, areaHeight: 80 },
    spots: createSpots("A", ZONE_A_STATUSES),
  },
  {
    id: "B",
    name: "Edificio Matteo Ricci",
    position: { top: 48, left: 75, width: 22, height: 14 },
    zoomImage: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202026-03-30%20at%207.41.14%E2%80%AFPM-mQphZwdc9a0dREdhvFy3A5TUV8ytBV.png",
    spotLayout: { rows: 2, cols: 25, startTop: 15, startLeft: 10, areaWidth: 80, areaHeight: 70 },
    spots: createSpots("B", ZONE_B_STATUSES),
  },
  {
    id: "C",
    name: "Estacionamiento Central",
    position: { top: 80, left: 18, width: 48, height: 8 },
    zoomImage: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202026-03-30%20at%207.41.57%E2%80%AFPM-p4M62iAQnO9Rl6yaoKGVX297DmvZrY.png",
    spotLayout: { rows: 2, cols: 25, startTop: 20, startLeft: 3, areaWidth: 94, areaHeight: 60 },
    spots: createSpots("C", ZONE_C_STATUSES),
  },
  {
    id: "D",
    name: "Estacionamiento Este",
    position: { top: 80, left: 68, width: 18, height: 10 },
    zoomImage: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202026-03-30%20at%207.41.00%E2%80%AFPM-5Gn8HTHSEHjjtMsZ4NcUkdMsraRK7O.png",
    spotLayout: { rows: 2, cols: 25, startTop: 10, startLeft: 8, areaWidth: 84, areaHeight: 80 },
    spots: createSpots("D", ZONE_D_STATUSES),
  },
  {
    id: "E",
    name: "Estacionamiento Principal",
    position: { top: 90, left: 8, width: 60, height: 8 },
    zoomImage: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202026-03-30%20at%207.42.01%E2%80%AFPM-46gl0bJqJj3czOasNVvkFH3ETwgJRo.png",
    spotLayout: { rows: 2, cols: 25, startTop: 15, startLeft: 2, areaWidth: 96, areaHeight: 70 },
    spots: createSpots("E", ZONE_E_STATUSES),
  },
];

export function getZoneStats(zone: ParkingZone) {
  const available = zone.spots.filter((s) => s.status === "available").length;
  const occupied = zone.spots.filter((s) => s.status === "occupied").length;
  const reported = zone.spots.filter((s) => s.status === "reported").length;
  return { available, occupied, reported, total: zone.spots.length };
}

export function getTotalStats(zones: ParkingZone[]) {
  return zones.reduce(
    (acc, zone) => {
      const stats = getZoneStats(zone);
      return {
        available: acc.available + stats.available,
        occupied: acc.occupied + stats.occupied,
        reported: acc.reported + stats.reported,
        total: acc.total + stats.total,
      };
    },
    { available: 0, occupied: 0, reported: 0, total: 0 }
  );
}
