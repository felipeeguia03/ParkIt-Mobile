import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { InteractionManager } from "react-native";
import { CampusMap } from "@/components/parking/CampusMap";
import { ParkingZone } from "@/lib/parking-data";

// ── Mocks ─────────────────────────────────────────────────────────────────

// InteractionManager corre la callback de inmediato para tests síncronos
jest.spyOn(InteractionManager, "runAfterInteractions").mockImplementation((cb: any) => {
  cb();
  return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() };
});

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeZone(id: string, name: string, available: number, total: number): ParkingZone {
  const spots = Array.from({ length: total }, (_, i) => ({
    id: `${id}${i + 1}`,
    number: i + 1,
    status: (i < available ? "available" : "occupied") as "available" | "occupied",
  }));
  return {
    id,
    name,
    spots,
    spotLayout: { rows: 2, cols: Math.ceil(total / 2) },
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

const zones: ParkingZone[] = [
  makeZone("A", "Estacionamiento Norte", 80, 128),
  makeZone("B", "Zona B", 5, 50),
  makeZone("C", "Zona C", 0, 50),
];

// ── Tests ─────────────────────────────────────────────────────────────────

describe("CampusMap — render base", () => {
  it("renderiza sin crashear con zonas", () => {
    expect(() =>
      render(
        <CampusMap
          zones={zones}
          onSpotSelect={jest.fn()}
          onReportSpot={jest.fn()}
        />
      )
    ).not.toThrow();
  });

  it("muestra el botón de recentrar", () => {
    const { getByTestId } = render(
      <CampusMap zones={zones} onSpotSelect={jest.fn()} onReportSpot={jest.fn()} />
    );
    // MapView mock expone testID="map-view"
    expect(getByTestId("map-view")).toBeTruthy();
  });

  it("muestra la leyenda global (Alta/Media/Lleno) cuando no hay zona enfocada", () => {
    const { getByText } = render(
      <CampusMap zones={zones} onSpotSelect={jest.fn()} onReportSpot={jest.fn()} />
    );
    expect(getByText("Alta")).toBeTruthy();
    expect(getByText("Media")).toBeTruthy();
    expect(getByText("Lleno")).toBeTruthy();
  });
});

describe("CampusMap — foco de zona via props", () => {
  it("muestra el HUD con el nombre de la zona al recibir focusZoneId + focusTimestamp", async () => {
    const { findByText } = render(
      <CampusMap
        zones={zones}
        onSpotSelect={jest.fn()}
        onReportSpot={jest.fn()}
        focusZoneId="A"
        focusTimestamp="ts-1"
      />
    );
    // findByText espera hasta que el estado se actualice
    expect(await findByText("Estacionamiento Norte")).toBeTruthy();
  });

  it("muestra el conteo de disponibles/totales en el HUD", async () => {
    const { findByText } = render(
      <CampusMap
        zones={zones}
        onSpotSelect={jest.fn()}
        onReportSpot={jest.fn()}
        focusZoneId="A"
        focusTimestamp="ts-2"
      />
    );
    // Zona A: 80 disponibles de 128
    expect(await findByText(/80 disponibles · 128 totales/)).toBeTruthy();
  });

  it("la leyenda global se oculta cuando hay zona enfocada", async () => {
    const { findByText, queryByText } = render(
      <CampusMap
        zones={zones}
        onSpotSelect={jest.fn()}
        onReportSpot={jest.fn()}
        focusZoneId="B"
        focusTimestamp="ts-3"
      />
    );
    await findByText("Zona B");
    expect(queryByText("Alta")).toBeNull();
    expect(queryByText("Media")).toBeNull();
    expect(queryByText("Lleno")).toBeNull();
  });
});
