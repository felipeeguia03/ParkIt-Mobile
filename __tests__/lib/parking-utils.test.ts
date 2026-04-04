import { applyStatusMap, updateOneSpot } from "@/lib/parking-utils";
import { ParkingZone, SpotStatus } from "@/lib/parking-data";

// ── Fixture mínima ────────────────────────────────────────────────────────

function makeZone(id: string, spots: { id: string; status: SpotStatus }[]): ParkingZone {
  return {
    id,
    name: `Zona ${id}`,
    spots: spots.map((s, i) => ({ ...s, number: i + 1 })),
    spotLayout: { rows: 1, cols: spots.length },
    polygon: [],
    center: { latitude: 0, longitude: 0 },
    bounds: { north: 0, south: 0, east: 0, west: 0 },
  };
}

const BASE_ZONES: ParkingZone[] = [
  makeZone("A", [
    { id: "A1", status: "available" },
    { id: "A2", status: "available" },
    { id: "A3", status: "occupied" },
  ]),
  makeZone("B", [
    { id: "B1", status: "available" },
    { id: "B2", status: "occupied" },
  ]),
];

// ── updateOneSpot ─────────────────────────────────────────────────────────

describe("updateOneSpot", () => {
  it("cambia el status del spot correcto", () => {
    const result = updateOneSpot(BASE_ZONES, "A1", "occupied");
    const spot = result[0].spots.find((s) => s.id === "A1")!;
    expect(spot.status).toBe("occupied");
  });

  it("no modifica otros spots de la misma zona", () => {
    const result = updateOneSpot(BASE_ZONES, "A1", "occupied");
    const a2 = result[0].spots.find((s) => s.id === "A2")!;
    const a3 = result[0].spots.find((s) => s.id === "A3")!;
    expect(a2.status).toBe("available");
    expect(a3.status).toBe("occupied");
  });

  it("no modifica zonas que no contienen el spot", () => {
    const result = updateOneSpot(BASE_ZONES, "A1", "occupied");
    expect(result[1].spots[0].status).toBe("available");
    expect(result[1].spots[1].status).toBe("occupied");
  });

  it("spotId inexistente devuelve array con mismos statuses", () => {
    const result = updateOneSpot(BASE_ZONES, "Z99", "occupied");
    result.forEach((zone, zi) =>
      zone.spots.forEach((s, si) =>
        expect(s.status).toBe(BASE_ZONES[zi].spots[si].status)
      )
    );
  });

  it("devuelve un array nuevo (inmutabilidad)", () => {
    const result = updateOneSpot(BASE_ZONES, "A1", "occupied");
    expect(result).not.toBe(BASE_ZONES);
  });

  it("la zona que contiene el spot tiene nueva referencia", () => {
    const result = updateOneSpot(BASE_ZONES, "A1", "occupied");
    expect(result[0]).not.toBe(BASE_ZONES[0]);
  });

  it("la zona que NO contiene el spot conserva la misma referencia", () => {
    const result = updateOneSpot(BASE_ZONES, "A1", "occupied");
    // Zona B no fue tocada — React.memo puede aprovechar esta igualdad referencial
    expect(result[1]).toBe(BASE_ZONES[1]);
  });

  it("puede cambiar a status 'reported'", () => {
    const result = updateOneSpot(BASE_ZONES, "A3", "reported");
    expect(result[0].spots[2].status).toBe("reported");
  });
});

// ── applyStatusMap ────────────────────────────────────────────────────────

describe("applyStatusMap", () => {
  it("aplica el Map a los spots correspondientes", () => {
    const map = new Map<string, SpotStatus>([
      ["A1", "occupied"],
      ["B2", "reported"],
    ]);
    const result = applyStatusMap(BASE_ZONES, map);
    expect(result[0].spots[0].status).toBe("occupied");  // A1
    expect(result[1].spots[1].status).toBe("reported");  // B2
  });

  it("Map vacío devuelve los mismos statuses", () => {
    const result = applyStatusMap(BASE_ZONES, new Map());
    result.forEach((zone, zi) =>
      zone.spots.forEach((s, si) =>
        expect(s.status).toBe(BASE_ZONES[zi].spots[si].status)
      )
    );
  });

  it("spotId que no existe en zones es ignorado silenciosamente", () => {
    const map = new Map<string, SpotStatus>([["Z99", "occupied"]]);
    const result = applyStatusMap(BASE_ZONES, map);
    result.forEach((zone, zi) =>
      zone.spots.forEach((s, si) =>
        expect(s.status).toBe(BASE_ZONES[zi].spots[si].status)
      )
    );
  });

  it("actualiza múltiples spots en múltiples zonas en un solo pase", () => {
    const map = new Map<string, SpotStatus>([
      ["A1", "occupied"],
      ["A2", "reported"],
      ["B1", "occupied"],
    ]);
    const result = applyStatusMap(BASE_ZONES, map);
    expect(result[0].spots[0].status).toBe("occupied");
    expect(result[0].spots[1].status).toBe("reported");
    expect(result[1].spots[0].status).toBe("occupied");
  });

  it("devuelve array nuevo (inmutabilidad)", () => {
    const result = applyStatusMap(BASE_ZONES, new Map());
    expect(result).not.toBe(BASE_ZONES);
  });
});
