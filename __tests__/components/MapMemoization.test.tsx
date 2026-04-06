/**
 * Render-granularity integration tests.
 *
 * These tests verify that React.memo actually calls the comparators when
 * CampusMap re-renders, and that the correct number of re-renders fires.
 *
 * Strategy: mock @/lib/memo-comparators with jest.fn() wrappers using
 * jest.requireActual() inside the factory so the real logic still runs,
 * then import the mocked module to observe calls / return values.
 */

import React from "react";
import { render, act } from "@testing-library/react-native";
import { InteractionManager } from "react-native";

// ── Spy on comparators BEFORE CampusMap loads ─────────────────────────────
// jest.requireActual inside the factory avoids the recursive-import issue.

jest.mock("@/lib/memo-comparators", () => {
  const real = jest.requireActual("@/lib/memo-comparators");
  return {
    zoneLayerComparator:   jest.fn(real.zoneLayerComparator),
    spotsLayerComparator:  jest.fn(real.spotsLayerComparator),
    spotPolygonComparator: jest.fn(real.spotPolygonComparator),
  };
});

// Now import the module — we get the jest.fn() wrappers
import * as mockComparators from "@/lib/memo-comparators";
import { CampusMap } from "@/components/parking/CampusMap";
import type { ParkingZone, ParkingSpot, SpotStatus } from "@/lib/parking-data";

// Typed aliases for convenience
const mockZoneLayer   = mockComparators.zoneLayerComparator   as jest.Mock;
const mockSpotsLayer  = mockComparators.spotsLayerComparator  as jest.Mock;
const mockSpotPolygon = mockComparators.spotPolygonComparator as jest.Mock;

// ── InteractionManager + RAF: run callbacks synchronously ─────────────────
// Without this, spotRenderCount starts at 0 and SpotPolygons never mount.

jest.spyOn(InteractionManager, "runAfterInteractions").mockImplementation((cb: any) => {
  cb();
  return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() };
});

// Make RAF fire immediately so the spot-batching loop settles before assertions.
jest.spyOn(global, "requestAnimationFrame").mockImplementation((cb) => {
  cb(0);
  return 0;
});

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeSpot(id: string, status: SpotStatus = "available"): ParkingSpot {
  return { id, number: parseInt(id.slice(1), 10) || 1, status };
}

function makeZone(id: string, spots: ParkingSpot[]): ParkingZone {
  return {
    id,
    name: `Zona ${id}`,
    spots,
    spotLayout: { rows: 2, cols: Math.ceil(spots.length / 2) },
    polygon: [
      { latitude: -31.485, longitude: -64.240 },
      { latitude: -31.485, longitude: -64.241 },
      { latitude: -31.486, longitude: -64.241 },
      { latitude: -31.486, longitude: -64.240 },
    ],
    center: { latitude: -31.4855, longitude: -64.2405 },
    bounds: { north: -31.485, south: -31.486, east: -64.240, west: -64.241 },
  };
}

const noop = jest.fn();

beforeEach(() => {
  mockZoneLayer.mockClear();
  mockSpotsLayer.mockClear();
  mockSpotPolygon.mockClear();
  noop.mockClear();
});

// ══════════════════════════════════════════════════════════════════════════
// ZoneLayer comparator integration
// ══════════════════════════════════════════════════════════════════════════

describe("ZoneLayer — comparator se llama en re-renders de CampusMap", () => {
  it("no dispara re-render de ZoneLayer cuando occupied → reported (available no cambia)", async () => {
    const zones1 = [
      makeZone("A", [makeSpot("A1", "available"), makeSpot("A2", "occupied")]),
    ];
    const zones2 = [
      makeZone("A", [makeSpot("A1", "available"), makeSpot("A2", "reported")]),
    ];

    const { rerender } = render(
      <CampusMap zones={zones1} onSpotSelect={noop} onReportSpot={noop} />
    );
    mockZoneLayer.mockClear();

    await act(async () => {
      rerender(<CampusMap zones={zones2} onSpotSelect={noop} onReportSpot={noop} />);
    });

    expect(mockZoneLayer).toHaveBeenCalled();
    // All calls return true → ZoneLayer does NOT re-render
    const anyFalse = mockZoneLayer.mock.results.some((r) => r.value === false);
    expect(anyFalse).toBe(false);
  });

  it("sí dispara re-render de ZoneLayer cuando available → occupied", async () => {
    const zones1 = [
      makeZone("A", [makeSpot("A1", "available"), makeSpot("A2", "available")]),
    ];
    const zones2 = [
      makeZone("A", [makeSpot("A1", "occupied"), makeSpot("A2", "available")]),
    ];

    const { rerender } = render(
      <CampusMap zones={zones1} onSpotSelect={noop} onReportSpot={noop} />
    );
    mockZoneLayer.mockClear();

    await act(async () => {
      rerender(<CampusMap zones={zones2} onSpotSelect={noop} onReportSpot={noop} />);
    });

    // At least one call returns false → ZoneLayer re-renders
    const anyFalse = mockZoneLayer.mock.results.some((r) => r.value === false);
    expect(anyFalse).toBe(true);
  });

  it("no dispara re-render de ZoneLayer cuando los props son idénticos", async () => {
    const zones = [makeZone("A", [makeSpot("A1", "available")])];

    const { rerender } = render(
      <CampusMap zones={zones} onSpotSelect={noop} onReportSpot={noop} />
    );
    mockZoneLayer.mockClear();

    await act(async () => {
      rerender(<CampusMap zones={zones} onSpotSelect={noop} onReportSpot={noop} />);
    });

    const anyFalse = mockZoneLayer.mock.results.some((r) => r.value === false);
    expect(anyFalse).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// SpotPolygon comparator integration (zona enfocada)
// ══════════════════════════════════════════════════════════════════════════

describe("SpotPolygon — comparator cuando cambia 1 spot", () => {
  it("exactamente 1 comparador devuelve false cuando cambia 1 de N spots", async () => {
    const N = 4;
    const spotsV1 = Array.from({ length: N }, (_, i) => makeSpot(`A${i + 1}`, "available"));
    const spotsV2 = spotsV1.map((s, i) =>
      i === 2 ? { ...s, status: "occupied" as SpotStatus } : s
    );

    const { rerender } = render(
      <CampusMap
        zones={[makeZone("A", spotsV1)]}
        onSpotSelect={noop}
        onReportSpot={noop}
        focusZoneId="A"
        focusTimestamp="ts-1"
      />
    );
    mockSpotPolygon.mockClear();

    await act(async () => {
      rerender(
        <CampusMap
          zones={[makeZone("A", spotsV2)]}
          onSpotSelect={noop}
          onReportSpot={noop}
          focusZoneId="A"
          focusTimestamp="ts-1"
        />
      );
    });

    expect(mockSpotPolygon).toHaveBeenCalled();
    // Only 1 call returns false (the changed spot)
    const falseCount = mockSpotPolygon.mock.results.filter((r) => r.value === false).length;
    expect(falseCount).toBe(1);
  });

  it("ningún SpotPolygon re-renderiza cuando el status de todos es igual", async () => {
    const zones = [makeZone("A", [makeSpot("A1", "available"), makeSpot("A2", "occupied")])];

    const { rerender } = render(
      <CampusMap
        zones={zones}
        onSpotSelect={noop}
        onReportSpot={noop}
        focusZoneId="A"
        focusTimestamp="ts-2"
      />
    );
    mockSpotPolygon.mockClear();

    // Same content, new array reference
    const zonesCopy = [makeZone("A", [makeSpot("A1", "available"), makeSpot("A2", "occupied")])];
    await act(async () => {
      rerender(
        <CampusMap
          zones={zonesCopy}
          onSpotSelect={noop}
          onReportSpot={noop}
          focusZoneId="A"
          focusTimestamp="ts-2"
        />
      );
    });

    const falseCount = mockSpotPolygon.mock.results.filter((r) => r.value === false).length;
    expect(falseCount).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// SpotsLayer comparator integration
// ══════════════════════════════════════════════════════════════════════════

describe("SpotsLayer — comparator cuando cambia zona enfocada", () => {
  it("SpotsLayer comparator se llama al cambiar el status de un spot en zona enfocada", async () => {
    const zones1 = [makeZone("A", [makeSpot("A1", "available"), makeSpot("A2", "available")])];
    const zones2 = [makeZone("A", [makeSpot("A1", "occupied"),  makeSpot("A2", "available")])];

    const { rerender } = render(
      <CampusMap
        zones={zones1}
        onSpotSelect={noop}
        onReportSpot={noop}
        focusZoneId="A"
        focusTimestamp="ts-3"
      />
    );
    mockSpotsLayer.mockClear();

    await act(async () => {
      rerender(
        <CampusMap
          zones={zones2}
          onSpotSelect={noop}
          onReportSpot={noop}
          focusZoneId="A"
          focusTimestamp="ts-3"
        />
      );
    });

    expect(mockSpotsLayer).toHaveBeenCalled();
    const anyFalse = mockSpotsLayer.mock.results.some((r) => r.value === false);
    expect(anyFalse).toBe(true);
  });

  it("SpotsLayer no re-renderiza si los statuses de la zona son iguales", async () => {
    const zones = [makeZone("A", [makeSpot("A1", "available"), makeSpot("A2", "occupied")])];

    const { rerender } = render(
      <CampusMap
        zones={zones}
        onSpotSelect={noop}
        onReportSpot={noop}
        focusZoneId="A"
        focusTimestamp="ts-4"
      />
    );
    mockSpotsLayer.mockClear();

    const zonesCopy = [makeZone("A", [makeSpot("A1", "available"), makeSpot("A2", "occupied")])];
    await act(async () => {
      rerender(
        <CampusMap
          zones={zonesCopy}
          onSpotSelect={noop}
          onReportSpot={noop}
          focusZoneId="A"
          focusTimestamp="ts-4"
        />
      );
    });

    const anyFalse = mockSpotsLayer.mock.results.some((r) => r.value === false);
    expect(anyFalse).toBe(false);
  });
});
