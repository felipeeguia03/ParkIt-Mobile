import { requestMapFocus, consumeMapFocus } from "@/lib/mapBus";
import type { ParkingZone } from "@/lib/parking-data";

function makeZone(id: string): ParkingZone {
  return {
    id,
    name: `Zona ${id}`,
    spots: [],
    spotLayout: { rows: 1, cols: 1 },
    polygon: [],
    center: { latitude: 0, longitude: 0 },
    bounds: { north: 0, south: 0, east: 0, west: 0 },
  };
}

// Reset singleton state between tests by consuming any leftover
beforeEach(() => { consumeMapFocus(); });

describe("mapBus", () => {
  it("consumeMapFocus devuelve null cuando no hay pedido pendiente", () => {
    expect(consumeMapFocus()).toBeNull();
  });

  it("consumeMapFocus devuelve el pedido tras requestMapFocus", () => {
    const zone = makeZone("A");
    requestMapFocus(zone);
    const req = consumeMapFocus();
    expect(req).not.toBeNull();
    expect(req?.zone).toBe(zone);
  });

  it("consumeMapFocus limpia el pedido (segunda llamada devuelve null)", () => {
    requestMapFocus(makeZone("A"));
    consumeMapFocus();
    expect(consumeMapFocus()).toBeNull();
  });

  it("múltiples requestMapFocus → el último gana", () => {
    const zoneA = makeZone("A");
    const zoneB = makeZone("B");
    requestMapFocus(zoneA);
    requestMapFocus(zoneB);
    const req = consumeMapFocus();
    expect(req?.zone).toBe(zoneB);
  });
});
