import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ReportSpotModal } from "@/components/parking/ReportSpotModal";
import { ParkingZone, ParkingSpot } from "@/lib/parking-data";

// ── Fixtures ──────────────────────────────────────────────────────────────

const zone: ParkingZone = {
  id: "C",
  name: "Zona C",
  spots: [],
  spotLayout: { rows: 1, cols: 1 },
  polygon: [],
  center: { latitude: 0, longitude: 0 },
  bounds: { north: 0, south: 0, east: 0, west: 0 },
};

const spot: ParkingSpot = { id: "C15", number: 15, status: "occupied" };

// ── Tests ─────────────────────────────────────────────────────────────────

describe("ReportSpotModal — guard de nulos", () => {
  it("no renderiza nada si zone es null", () => {
    const { toJSON } = render(
      <ReportSpotModal open zone={null} spot={spot} onOpenChange={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });

  it("no renderiza nada si spot es null", () => {
    const { toJSON } = render(
      <ReportSpotModal open zone={zone} spot={null} onOpenChange={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });
});

describe("ReportSpotModal — contenido", () => {
  it("muestra el ID del spot", () => {
    const { getByText } = render(
      <ReportSpotModal open zone={zone} spot={spot} onOpenChange={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(getByText("C15")).toBeTruthy();
  });

  it("muestra el nombre de la zona", () => {
    const { getByText } = render(
      <ReportSpotModal open zone={zone} spot={spot} onOpenChange={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(getByText("Zona C")).toBeTruthy();
  });
});

describe("ReportSpotModal — interacciones", () => {
  it("llama a onConfirm al presionar 'Reportar como ocupado'", () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ReportSpotModal open zone={zone} spot={spot} onOpenChange={jest.fn()} onConfirm={onConfirm} />
    );
    fireEvent.press(getByText("Reportar como ocupado"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("llama a onOpenChange(false) al presionar 'Cancelar'", () => {
    const onOpenChange = jest.fn();
    const { getByText } = render(
      <ReportSpotModal open zone={zone} spot={spot} onOpenChange={onOpenChange} onConfirm={jest.fn()} />
    );
    fireEvent.press(getByText("Cancelar"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
