import {
  zoneLayerComparator,
  spotsLayerComparator,
  spotPolygonComparator,
  ZoneLayerProps,
  SpotsLayerProps,
  SpotPolygonProps,
} from "@/lib/memo-comparators";
import { ParkingZone, ParkingSpot, SpotStatus } from "@/lib/parking-data";

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeSpot(id: string, status: SpotStatus): ParkingSpot {
  return { id, number: parseInt(id.slice(1)), status };
}

function makeZone(id: string, spots: ParkingSpot[]): ParkingZone {
  return {
    id,
    name: `Zona ${id}`,
    spots,
    spotLayout: { rows: 1, cols: spots.length },
    polygon: [],
    center: { latitude: 0, longitude: 0 },
    bounds: { north: 0, south: 0, east: 0, west: 0 },
  };
}

const noop = () => {};

// ── zoneLayerComparator ───────────────────────────────────────────────────
// true  = igual → NO re-renderizar
// false = distinto → SÍ re-renderizar

describe("zoneLayerComparator", () => {
  const zonesA: ParkingZone[] = [
    makeZone("A", [makeSpot("A1", "available"), makeSpot("A2", "occupied")]),
    makeZone("B", [makeSpot("B1", "available")]),
  ];

  const base: ZoneLayerProps = { zones: zonesA, focusedZoneId: null, onZonePress: noop };

  it("mismas props → true (no re-renderizar)", () => {
    expect(zoneLayerComparator(base, base)).toBe(true);
  });

  it("nuevo array de zones con mismos statuses → true", () => {
    // El caso crítico del freeze: zones es un nuevo array pero los datos son iguales
    const zonesACopy: ParkingZone[] = [
      makeZone("A", [makeSpot("A1", "available"), makeSpot("A2", "occupied")]),
      makeZone("B", [makeSpot("B1", "available")]),
    ];
    expect(zoneLayerComparator(base, { ...base, zones: zonesACopy })).toBe(true);
  });

  it("spot pasa de 'occupied' a 'reported' → true (available no cambia)", () => {
    const zonesModified: ParkingZone[] = [
      makeZone("A", [makeSpot("A1", "available"), makeSpot("A2", "reported")]),
      makeZone("B", [makeSpot("B1", "available")]),
    ];
    expect(zoneLayerComparator(base, { ...base, zones: zonesModified })).toBe(true);
  });

  it("spot pasa de 'available' a 'occupied' → false (conteo disponibles cambia)", () => {
    const zonesModified: ParkingZone[] = [
      makeZone("A", [makeSpot("A1", "occupied"), makeSpot("A2", "occupied")]),
      makeZone("B", [makeSpot("B1", "available")]),
    ];
    expect(zoneLayerComparator(base, { ...base, zones: zonesModified })).toBe(false);
  });

  it("focusedZoneId cambia de null a 'A' → false", () => {
    expect(zoneLayerComparator(base, { ...base, focusedZoneId: "A" })).toBe(false);
  });

  it("focusedZoneId cambia de 'A' a 'B' → false", () => {
    const prev = { ...base, focusedZoneId: "A" };
    const next = { ...base, focusedZoneId: "B" };
    expect(zoneLayerComparator(prev, next)).toBe(false);
  });

  it("cantidad de zonas cambia → false", () => {
    const zonesExtra = [...zonesA, makeZone("C", [makeSpot("C1", "available")])];
    expect(zoneLayerComparator(base, { ...base, zones: zonesExtra })).toBe(false);
  });
});

// ── spotsLayerComparator ──────────────────────────────────────────────────

describe("spotsLayerComparator", () => {
  const zone = makeZone("A", [
    makeSpot("A1", "available"),
    makeSpot("A2", "available"),
    makeSpot("A3", "occupied"),
  ]);

  const base: SpotsLayerProps = {
    zone,
    showNumbers: false,
    onSpotPress: noop,
    renderCount: 3,
  };

  it("mismas props → true", () => {
    expect(spotsLayerComparator(base, base)).toBe(true);
  });

  it("nueva referencia de zone con mismos statuses → true", () => {
    // Caso crítico: zones se recrea en cada Realtime update de otra zona
    const zoneCopy = makeZone("A", [
      makeSpot("A1", "available"),
      makeSpot("A2", "available"),
      makeSpot("A3", "occupied"),
    ]);
    expect(spotsLayerComparator(base, { ...base, zone: zoneCopy })).toBe(true);
  });

  it("un spot cambia status → false (para pasar props nuevos a SpotPolygon hijos)", () => {
    const zoneModified = makeZone("A", [
      makeSpot("A1", "available"),
      makeSpot("A2", "available"),
      makeSpot("A3", "available"), // cambió
    ]);
    expect(spotsLayerComparator(base, { ...base, zone: zoneModified })).toBe(false);
  });

  it("renderCount sube (RAF batch) → false", () => {
    expect(spotsLayerComparator(base, { ...base, renderCount: 16 })).toBe(false);
  });

  it("renderCount baja a 0 (reset por cambio de zona) → false", () => {
    expect(spotsLayerComparator(base, { ...base, renderCount: 0 })).toBe(false);
  });

  it("showNumbers cambia → false", () => {
    expect(spotsLayerComparator(base, { ...base, showNumbers: true })).toBe(false);
  });

  it("zone.id cambia (cambio de zona) → false", () => {
    const zoneB = makeZone("B", [makeSpot("B1", "available")]);
    expect(spotsLayerComparator(base, { ...base, zone: zoneB })).toBe(false);
  });

  it("spots.length cambia → false", () => {
    const zoneLonger = makeZone("A", [
      makeSpot("A1", "available"),
      makeSpot("A2", "available"),
      makeSpot("A3", "occupied"),
      makeSpot("A4", "available"),
    ]);
    expect(spotsLayerComparator(base, { ...base, zone: zoneLonger })).toBe(false);
  });
});

// ── spotPolygonComparator ─────────────────────────────────────────────────

describe("spotPolygonComparator", () => {
  const spot = makeSpot("A3", "occupied");
  const zone = makeZone("A", [spot]);

  const base: SpotPolygonProps = {
    spot,
    zone,
    idx: 0,
    showNumbers: false,
    onPress: noop,
  };

  it("mismas props → true (no re-renderizar)", () => {
    expect(spotPolygonComparator(base, base)).toBe(true);
  });

  it("mismo status, nueva referencia de spot → true", () => {
    const spotCopy = makeSpot("A3", "occupied");
    expect(spotPolygonComparator(base, { ...base, spot: spotCopy })).toBe(true);
  });

  it("status cambia de 'occupied' a 'available' → false", () => {
    expect(spotPolygonComparator(base, { ...base, spot: makeSpot("A3", "available") })).toBe(false);
  });

  it("status cambia de 'available' a 'reported' → false", () => {
    const avail = { ...base, spot: makeSpot("A3", "available") };
    const reported = { ...base, spot: makeSpot("A3", "reported") };
    expect(spotPolygonComparator(avail, reported)).toBe(false);
  });

  it("showNumbers cambia → false", () => {
    expect(spotPolygonComparator(base, { ...base, showNumbers: true })).toBe(false);
  });

  it("onPress cambia de referencia → true (no afecta: deps vacíos garantizan estabilidad)", () => {
    // handleSpotPress tiene deps=[] → onPress NUNCA cambia en runtime.
    // Este test documenta que el comparador ignora intencionalmente onPress.
    const newPress = () => {};
    expect(spotPolygonComparator(base, { ...base, onPress: newPress })).toBe(true);
  });

  it("zone o idx cambian → true (geometría estática calculada con useMemo([]))", () => {
    const zone2 = makeZone("B", [makeSpot("B1", "occupied")]);
    expect(spotPolygonComparator(base, { ...base, zone: zone2, idx: 1 })).toBe(true);
  });
});
