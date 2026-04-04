import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ConfirmParkingModal } from "@/components/parking/ConfirmParkingModal";
import { ParkingZone, ParkingSpot } from "@/lib/parking-data";

// ── Fixtures ──────────────────────────────────────────────────────────────

const zone: ParkingZone = {
  id: "A",
  name: "Estacionamiento Norte",
  spots: [],
  spotLayout: { rows: 1, cols: 1 },
  polygon: [],
  center: { latitude: 0, longitude: 0 },
  bounds: { north: 0, south: 0, east: 0, west: 0 },
};

const spot: ParkingSpot = { id: "A42", number: 42, status: "available" };

// ── Tests ─────────────────────────────────────────────────────────────────

describe("ConfirmParkingModal — guard de nulos", () => {
  it("no renderiza nada si zone es null", () => {
    const { toJSON } = render(
      <ConfirmParkingModal open zone={null} spot={spot} onOpenChange={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });

  it("no renderiza nada si spot es null", () => {
    const { toJSON } = render(
      <ConfirmParkingModal open zone={zone} spot={null} onOpenChange={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });
});

describe("ConfirmParkingModal — contenido", () => {
  it("muestra el ID del spot en el hero", () => {
    const { getByText } = render(
      <ConfirmParkingModal open zone={zone} spot={spot} onOpenChange={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(getByText("A42")).toBeTruthy();
  });

  it("muestra el nombre de la zona", () => {
    const { getAllByText } = render(
      <ConfirmParkingModal open zone={zone} spot={spot} onOpenChange={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(getAllByText("Estacionamiento Norte").length).toBeGreaterThanOrEqual(1);
  });

  it("muestra zona e ID de lugar en la info card", () => {
    const { getByText } = render(
      <ConfirmParkingModal open zone={zone} spot={spot} onOpenChange={jest.fn()} onConfirm={jest.fn()} />
    );
    expect(getByText("Zona A · Lugar #42")).toBeTruthy();
  });
});

describe("ConfirmParkingModal — interacciones", () => {
  it("llama a onConfirm al presionar 'Estacionar aquí'", () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ConfirmParkingModal open zone={zone} spot={spot} onOpenChange={jest.fn()} onConfirm={onConfirm} />
    );
    fireEvent.press(getByText("Estacionar aquí"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("llama a onOpenChange(false) al presionar 'Cancelar'", () => {
    const onOpenChange = jest.fn();
    const { getByText } = render(
      <ConfirmParkingModal open zone={zone} spot={spot} onOpenChange={onOpenChange} onConfirm={jest.fn()} />
    );
    fireEvent.press(getByText("Cancelar"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("onConfirm y onOpenChange son independientes", () => {
    const onConfirm = jest.fn();
    const onOpenChange = jest.fn();
    const { getByText } = render(
      <ConfirmParkingModal open zone={zone} spot={spot} onOpenChange={onOpenChange} onConfirm={onConfirm} />
    );
    fireEvent.press(getByText("Estacionar aquí"));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
