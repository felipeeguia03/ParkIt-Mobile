export type SpotStatus = "available" | "occupied" | "reported";

export interface ParkingSpot {
  id: string;
  number: number;
  status: SpotStatus;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface SpotLayout {
  rows: number;
  cols: number;
}

// Layout de hileras: 4 hileras × 2 sub-filas × 16 spots
// subRowLatFracs: fracción del alto de la zona (desde north) donde cae cada sub-fila (8 valores)
// lngStart/lngEnd: fracción del ancho de la zona donde empiezan/terminan los spots
export interface HileraLayout {
  numHileras: number;
  spotsPerSubRow: number;
  subRowLatFracs: number[];
  lngStart: number;
  lngEnd: number;
}

export interface ParkingZone {
  id: string;
  name: string;
  spots: ParkingSpot[];
  spotLayout: SpotLayout;
  hileraLayout?: HileraLayout;
  polygon: LatLng[];
  center: LatLng;
  bounds: { north: number; south: number; east: number; west: number };
}

// ─────────────────────────────────────────────────────────────────────
// COORDENADAS GPS — Campus UCC, Córdoba, Argentina
// ─────────────────────────────────────────────────────────────────────
const ZONE_COORDS: Record<
  string,
  { polygon: LatLng[]; center: LatLng; bounds: ParkingZone["bounds"] }
> = {
  A: {
    center: { latitude: -31.485889, longitude: -64.240413 },
    bounds: {
      north: -31.485658,
      south: -31.486117,
      west:  -64.240683,
      east:  -64.240147,
    },
    polygon: [
      { latitude: -31.485669, longitude: -64.240683 }, // NW (oeste)
      { latitude: -31.485658, longitude: -64.240150 }, // NE (norte)
      { latitude: -31.486117, longitude: -64.240147 }, // SE (este)
      { latitude: -31.486114, longitude: -64.240672 }, // SW (sur)
    ],
  },
  B: {
    center: { latitude: -31.486446, longitude: -64.240339 },
    bounds: {
      north: -31.486275,
      south: -31.486617,
      west:  -64.240667,
      east:  -64.240010,
    },
    polygon: [
      { latitude: -31.486275, longitude: -64.240657 }, // NW
      { latitude: -31.486292, longitude: -64.240010 }, // NE
      { latitude: -31.486615, longitude: -64.240040 }, // SE
      { latitude: -31.486617, longitude: -64.240667 }, // SW
    ],
  },
  C: {
    center: { latitude: -31.487814, longitude: -64.240162 },
    bounds: {
      north: -31.487700,
      south: -31.487927,
      west:  -64.240630,
      east:  -64.239694,
    },
    polygon: [
      { latitude: -31.487700, longitude: -64.240620 }, // NW
      { latitude: -31.487718, longitude: -64.239694 }, // NE
      { latitude: -31.487916, longitude: -64.239747 }, // SE
      { latitude: -31.487927, longitude: -64.240630 }, // SW
    ],
  },
  D: {
    center: { latitude: -31.487787, longitude: -64.241338 },
    bounds: {
      north: -31.487653,
      south: -31.487921,
      west:  -64.241776,
      east:  -64.240899,
    },
    polygon: [
      { latitude: -31.487659, longitude: -64.241776 }, // NW
      { latitude: -31.487653, longitude: -64.240920 }, // NE
      { latitude: -31.487921, longitude: -64.240899 }, // SE
      { latitude: -31.487916, longitude: -64.241771 }, // SW
    ],
  },
  E: {
    center: { latitude: -31.487763, longitude: -64.242987 },
    bounds: {
      north: -31.487626,
      south: -31.487900,
      west:  -64.243130,
      east:  -64.241845,
    },
    polygon: [
      { latitude: -31.487626, longitude: -64.243130 }, // NW
      { latitude: -31.487645, longitude: -64.241873 }, // NE
      { latitude: -31.487900, longitude: -64.241845 }, // SE
      { latitude: -31.487886, longitude: -64.243124 }, // SW
    ],
  },
  F: {
    center: { latitude: -31.488149, longitude: -64.242588 },
    bounds: {
      north: -31.488038,
      south: -31.488259,
      west:  -64.243382,
      east:  -64.241794,
    },
    polygon: [
      { latitude: -31.488038, longitude: -64.243370 }, // NW
      { latitude: -31.488061, longitude: -64.241815 }, // NE
      { latitude: -31.488258, longitude: -64.241794 }, // SE
      { latitude: -31.488259, longitude: -64.243382 }, // SW
    ],
  },
  G: {
    center: { latitude: -31.488176, longitude: -64.240534 },
    bounds: {
      north: -31.488038,
      south: -31.488315,
      west:  -64.241755,
      east:  -64.240313,
    },
    polygon: [
      { latitude: -31.488038, longitude: -64.241755 }, // NW
      { latitude: -31.488066, longitude: -64.240364 }, // NE
      { latitude: -31.488315, longitude: -64.240313 }, // SE
      { latitude: -31.488245, longitude: -64.241737 }, // SW
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────
// Spot data — los statuses reales vienen de Supabase.
// Acá solo definimos la estructura (IDs, posiciones, layout).
// ─────────────────────────────────────────────────────────────────────

function createSpots(zoneId: string, count: number): ParkingSpot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${zoneId}${i + 1}`,
    number: i + 1,
    status: "available" as SpotStatus,
  }));
}

export const initialParkingData: ParkingZone[] = [
  {
    id: "A",
    name: "Estacionamiento Norte",
    spotLayout: { rows: 8, cols: 16 },
    hileraLayout: {
      numHileras: 4,
      spotsPerSubRow: 16,
      subRowLatFracs: [0.09, 0.20, 0.36, 0.47, 0.62, 0.73, 0.82, 0.91],
      lngStart: 0.04,
      lngEnd: 0.96,
    },
    spots: createSpots("A", 128),
    ...ZONE_COORDS.A,
  },
  {
    id: "B",
    name: "Zona B",
    spotLayout: { rows: 2, cols: 25 },
    spots: createSpots("B", 50),
    ...ZONE_COORDS.B,
  },
  {
    id: "C",
    name: "Zona C",
    spotLayout: { rows: 2, cols: 25 },
    spots: createSpots("C", 50),
    ...ZONE_COORDS.C,
  },
  {
    id: "D",
    name: "Zona D",
    spotLayout: { rows: 2, cols: 25 },
    spots: createSpots("D", 50),
    ...ZONE_COORDS.D,
  },
  {
    id: "E",
    name: "Zona E",
    spotLayout: { rows: 2, cols: 25 },
    spots: createSpots("E", 50),
    ...ZONE_COORDS.E,
  },
  {
    id: "F",
    name: "Zona F",
    spotLayout: { rows: 2, cols: 25 },
    spots: createSpots("F", 50),
    ...ZONE_COORDS.F,
  },
  {
    id: "G",
    name: "Zona G",
    spotLayout: { rows: 2, cols: 25 },
    spots: createSpots("G", 50),
    ...ZONE_COORDS.G,
  },
];

// Devuelve los 4 vértices GPS de un espacio individual (NW, NE, SE, SW)
export function getSpotPolygon(zone: ParkingZone, spotIndex: number): LatLng[] {
  const { north, south, east, west } = zone.bounds;
  const zoneH = north - south; // positivo
  const zoneW = east - west;   // positivo

  if (zone.hileraLayout) {
    const { spotsPerSubRow, subRowLatFracs, lngStart, lngEnd } = zone.hileraLayout;
    const spotsPerHilera = spotsPerSubRow * 2;
    const hilera = Math.floor(spotIndex / spotsPerHilera);
    const posInHilera = spotIndex % spotsPerHilera;
    const subRow = Math.floor(posInHilera / spotsPerSubRow);
    const col = posInHilera % spotsPerSubRow;

    const globalSubRow = hilera * 2 + subRow;
    const latFrac = subRowLatFracs[globalSubRow] ?? 0.5;
    const lngFrac = lngStart + (col / (spotsPerSubRow - 1)) * (lngEnd - lngStart);

    const centerLat = north - latFrac * zoneH;
    const centerLng = west + lngFrac * zoneW;

    // Ancho: 90% de la celda de grilla
    const halfW = ((lngEnd - lngStart) * zoneW / spotsPerSubRow) * 0.45;

    // Alto: basado en la brecha hacia las sub-filas adyacentes
    const prevFrac = subRowLatFracs[globalSubRow - 1];
    const nextFrac = subRowLatFracs[globalSubRow + 1];
    const gapUp   = prevFrac !== undefined ? latFrac - prevFrac : latFrac;
    const gapDown  = nextFrac !== undefined ? nextFrac - latFrac : 1 - latFrac;
    const halfH    = Math.min(gapUp, gapDown) * zoneH * 0.44;

    return [
      { latitude: centerLat + halfH, longitude: centerLng - halfW },
      { latitude: centerLat + halfH, longitude: centerLng + halfW },
      { latitude: centerLat - halfH, longitude: centerLng + halfW },
      { latitude: centerLat - halfH, longitude: centerLng - halfW },
    ];
  }

  // Layout genérico de grilla
  const { rows, cols } = zone.spotLayout;
  const row = Math.floor(spotIndex / cols);
  const col = spotIndex % cols;
  const halfH = (zoneH / rows) * 0.43;
  const halfW = (zoneW / cols) * 0.43;
  const centerLat = north - (row + 0.5) * (zoneH / rows);
  const centerLng = west + (col + 0.5) * (zoneW / cols);

  return [
    { latitude: centerLat + halfH, longitude: centerLng - halfW },
    { latitude: centerLat + halfH, longitude: centerLng + halfW },
    { latitude: centerLat - halfH, longitude: centerLng + halfW },
    { latitude: centerLat - halfH, longitude: centerLng - halfW },
  ];
}

export function getSpotCoordinate(zone: ParkingZone, spotIndex: number): LatLng {
  const { north, south, east, west } = zone.bounds;

  if (zone.hileraLayout) {
    const { numHileras, spotsPerSubRow, subRowLatFracs, lngStart, lngEnd } = zone.hileraLayout;
    const spotsPerHilera = spotsPerSubRow * 2;
    const hilera = Math.floor(spotIndex / spotsPerHilera);
    const posInHilera = spotIndex % spotsPerHilera;
    const subRow = Math.floor(posInHilera / spotsPerSubRow);
    const col = posInHilera % spotsPerSubRow;

    const globalSubRow = hilera * 2 + subRow;
    const latFrac = subRowLatFracs[globalSubRow] ?? 0.5;
    const lngFrac = spotsPerSubRow === 1
      ? (lngStart + lngEnd) / 2
      : lngStart + (col / (spotsPerSubRow - 1)) * (lngEnd - lngStart);

    return {
      latitude: north - latFrac * (north - south),
      longitude: west + lngFrac * (east - west),
    };
  }

  const { rows, cols } = zone.spotLayout;
  const row = Math.floor(spotIndex / cols);
  const col = spotIndex % cols;
  const latStep = (north - south) / rows;
  const lngStep = (east - west) / cols;
  return {
    latitude: north - (row + 0.5) * latStep,
    longitude: west + (col + 0.5) * lngStep,
  };
}

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

// ─────────────────────────────────────────────────────────────────────
// Geofence del Campus UCC — coords reales
// ─────────────────────────────────────────────────────────────────────
export const UCC_CAMPUS_POLYGON: LatLng[] = [
  { latitude: -31.486158, longitude: -64.246006 }, // NW
  { latitude: -31.486224, longitude: -64.239596 }, // NE
  { latitude: -31.488466, longitude: -64.239541 }, // SE
  { latitude: -31.488075, longitude: -64.247047 }, // SW
];

// Ray-casting: devuelve true si el punto está dentro del polígono
export function isInsideCampus(point: LatLng, polygon: LatLng[] = UCC_CAMPUS_POLYGON): boolean {
  const { latitude: px, longitude: py } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude, yi = polygon[i].longitude;
    const xj = polygon[j].latitude, yj = polygon[j].longitude;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
