import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { MyParkingCard } from "@/components/parking/MyParkingCard";
import { ParkingZone, ParkingSpot } from "@/lib/parking-data";
import * as ExpoRouter from "expo-router";

// ── Fixtures ──────────────────────────────────────────────────────────────

const zone: ParkingZone = {
  id: "B",
  name: "Zona B",
  spots: [],
  spotLayout: { rows: 1, cols: 1 },
  polygon: [],
  center: { latitude: 0, longitude: 0 },
  bounds: { north: 0, south: 0, east: 0, west: 0 },
};

const spot: ParkingSpot = { id: "B7", number: 7, status: "occupied" };

// Hora fija para snapshots deterministas
const parkedAt = new Date("2026-04-04T10:30:00");

// ── Tests ─────────────────────────────────────────────────────────────────

describe("MyParkingCard — contenido", () => {
  it("muestra el ID del spot", () => {
    const { getByText } = render(
      <MyParkingCard zone={zone} spot={spot} parkedAt={parkedAt} onLeave={jest.fn()} />
    );
    expect(getByText("B7")).toBeTruthy();
  });

  it("muestra el nombre de la zona", () => {
    const { getByText } = render(
      <MyParkingCard zone={zone} spot={spot} parkedAt={parkedAt} onLeave={jest.fn()} />
    );
    expect(getByText("Zona B")).toBeTruthy();
  });

  it("muestra la hora de inicio con el prefijo 'Desde las'", () => {
    const { getByText } = render(
      <MyParkingCard zone={zone} spot={spot} parkedAt={parkedAt} onLeave={jest.fn()} />
    );
    expect(getByText(/Desde las/)).toBeTruthy();
  });
});

describe("MyParkingCard — interacciones", () => {
  it("llama a onLeave al presionar 'Liberar lugar'", () => {
    const onLeave = jest.fn();
    const { getByText } = render(
      <MyParkingCard zone={zone} spot={spot} parkedAt={parkedAt} onLeave={onLeave} />
    );
    fireEvent.press(getByText("Liberar lugar"));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("navega al mapa con focusZoneId correcto al presionar 'Ver en mapa'", () => {
    const mockNavigate = jest.fn();
    jest.spyOn(ExpoRouter, "useRouter").mockReturnValue({
      navigate: mockNavigate,
      push: jest.fn(),
      back: jest.fn(),
    } as any);

    const { getByText } = render(
      <MyParkingCard zone={zone} spot={spot} parkedAt={parkedAt} onLeave={jest.fn()} />
    );
    fireEvent.press(getByText("Ver en mapa"));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/(tabs)/map",
        params: expect.objectContaining({ focusZoneId: "B" }),
      })
    );
    jest.restoreAllMocks();
  });
});
