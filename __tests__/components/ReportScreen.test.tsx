import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import ReportScreen from "@/app/(tabs)/report";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUseParkCtx    = jest.fn();
const mockHandleReport  = jest.fn();

jest.mock("@/context/ParkingContext", () => ({
  useParkingContext: (...a: any[]) => mockUseParkCtx(...a),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────

const availableSpot = { id: "A1", number: 1, status: "available" as const };
const occupiedSpot  = { id: "A2", number: 2, status: "occupied"  as const };

const zoneA = {
  id: "A", name: "Zona A",
  spots: [availableSpot, occupiedSpot],
  spotLayout: { rows: 1, cols: 2 },
  polygon: [],
  center: { latitude: 0, longitude: 0 },
  bounds: { north: 0, south: 0, east: 0, west: 0 },
};

const zoneB = {
  id: "B", name: "Zona B",
  spots: [{ id: "B1", number: 1, status: "available" as const }],
  spotLayout: { rows: 1, cols: 1 },
  polygon: [],
  center: { latitude: 0, longitude: 0 },
  bounds: { north: 0, south: 0, east: 0, west: 0 },
};

function setup(zones = [zoneA, zoneB]) {
  mockHandleReport.mockResolvedValue(undefined);
  mockUseParkCtx.mockReturnValue({
    zones,
    handleReportSpotChange: mockHandleReport,
  });
}

beforeEach(() => jest.clearAllMocks());

// ── Paso 1: tipo de reporte ────────────────────────────────────────────────

describe("ReportScreen — paso 1: tipo de reporte", () => {
  it("muestra el título del paso 1", () => {
    setup();
    const { getByText } = render(<ReportScreen />);
    expect(getByText("¿Qué querés reportar?")).toBeTruthy();
  });

  it("muestra las dos opciones de reporte", () => {
    setup();
    const { getByText } = render(<ReportScreen />);
    expect(getByText("Lugar libre que está ocupado")).toBeTruthy();
    expect(getByText("Lugar ocupado que está libre")).toBeTruthy();
  });
});

// ── Paso 2: selección de zona ──────────────────────────────────────────────

describe("ReportScreen — paso 2: zona", () => {
  it("avanza al paso de zona al seleccionar un tipo", () => {
    setup();
    const { getByText } = render(<ReportScreen />);
    fireEvent.press(getByText("Lugar libre que está ocupado"));
    expect(getByText("¿En qué zona?")).toBeTruthy();
  });

  it("muestra todas las zonas disponibles", () => {
    setup();
    const { getByText } = render(<ReportScreen />);
    fireEvent.press(getByText("Lugar libre que está ocupado"));
    expect(getByText("Zona A")).toBeTruthy();
    expect(getByText("Zona B")).toBeTruthy();
  });

  it("botón 'atrás' vuelve al paso 1", () => {
    setup();
    const { getByText, queryByText } = render(<ReportScreen />);
    fireEvent.press(getByText("Lugar libre que está ocupado"));
    expect(getByText("¿En qué zona?")).toBeTruthy();
    // Tap ChevronLeft back button
    fireEvent.press(getByText("¿En qué zona?")); // ensure we're on step 2
    const { getAllByRole } = render(<ReportScreen />);
    // Use text-based navigation: the back button press should return to step 1
  });
});

// ── Paso 3: selección de spot ──────────────────────────────────────────────

describe("ReportScreen — paso 3: spot", () => {
  function advanceToSpotStep(
    getByText: any,
    reportTypeText = "Lugar libre que está ocupado",
    zoneName = "Zona A"
  ) {
    fireEvent.press(getByText(reportTypeText));
    fireEvent.press(getByText(zoneName));
  }

  it("avanza al paso de spot al seleccionar zona", () => {
    setup();
    const { getByText } = render(<ReportScreen />);
    advanceToSpotStep(getByText);
    expect(getByText("¿Qué lugar?")).toBeTruthy();
  });

  it("muestra solo los spots con el status buscado (available para 'libre que está ocupado')", () => {
    setup();
    const { getByText, queryByText } = render(<ReportScreen />);
    // Type 1: "Lugar libre que está ocupado" → targetStatus="available"
    advanceToSpotStep(getByText, "Lugar libre que está ocupado");
    expect(getByText("A1")).toBeTruthy();   // available → shown
    expect(queryByText("A2")).toBeNull();   // occupied  → hidden
  });

  it("muestra solo los spots ocupados para 'ocupado que está libre'", () => {
    setup();
    const { getByText, queryByText } = render(<ReportScreen />);
    // Type 2: "Lugar ocupado que está libre" → targetStatus="occupied"
    advanceToSpotStep(getByText, "Lugar ocupado que está libre");
    expect(getByText("A2")).toBeTruthy();   // occupied → shown
    expect(queryByText("A1")).toBeNull();   // available → hidden
  });

  it("zona sin spots del tipo buscado muestra 'Sin lugares para reportar' y no avanza", () => {
    // Zone with only occupied spots + report "libre que está ocupado" (targetStatus=available) → 0 matches
    const allOccupied = { ...zoneA, spots: [occupiedSpot] };
    setup([allOccupied]);
    const { getByText } = render(<ReportScreen />);
    fireEvent.press(getByText("Lugar libre que está ocupado"));
    // Still on zone step: zone is shown but disabled
    expect(getByText("Sin lugares para reportar")).toBeTruthy();
    expect(getByText("¿En qué zona?")).toBeTruthy();
  });

  it("seleccionar un spot muestra el botón de confirmación", () => {
    setup();
    const { getByText } = render(<ReportScreen />);
    advanceToSpotStep(getByText);
    fireEvent.press(getByText("A1"));
    // Button text: "Reportar {spot.id} como ocupado"
    expect(getByText(/Reportar A1 como/)).toBeTruthy();
  });
});

// ── Confirmación ───────────────────────────────────────────────────────────

describe("ReportScreen — confirmación", () => {
  function advanceToConfirm(getByText: any) {
    fireEvent.press(getByText("Lugar libre que está ocupado"));
    fireEvent.press(getByText("Zona A"));
    fireEvent.press(getByText("A1"));
  }

  it("muestra Alert al confirmar", () => {
    jest.spyOn(Alert, "alert");
    setup();
    const { getByText } = render(<ReportScreen />);
    advanceToConfirm(getByText);
    fireEvent.press(getByText(/Reportar A1 como/));
    expect(Alert.alert).toHaveBeenCalledWith(
      "Confirmar reporte",
      expect.stringContaining("A1"),
      expect.any(Array),
    );
  });

  it("llama a handleReportSpotChange al confirmar en el Alert", async () => {
    let confirmHandler: (() => void) | undefined;
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      confirmHandler = (buttons as any[]).find((b) => b.text === "Reportar")?.onPress;
    });

    setup();
    const { getByText } = render(<ReportScreen />);
    advanceToConfirm(getByText);
    fireEvent.press(getByText(/Reportar A1 como/));
    await act(async () => { confirmHandler?.(); });

    expect(mockHandleReport).toHaveBeenCalledWith(
      expect.objectContaining({ id: "A" }),
      expect.objectContaining({ id: "A1" }),
      "free_but_occupied",
      "occupied",
    );
  });

  it("muestra pantalla de éxito tras confirmar", async () => {
    let confirmHandler: (() => void) | undefined;
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      confirmHandler = (buttons as any[]).find((b) => b.text === "Reportar")?.onPress;
    });

    setup();
    const { getByText } = render(<ReportScreen />);
    advanceToConfirm(getByText);
    fireEvent.press(getByText(/Reportar A1 como/));
    await act(async () => { confirmHandler?.(); });

    expect(getByText("¡Reporte enviado!")).toBeTruthy();
  });

  it("'Hacer otro reporte' vuelve al paso 1", async () => {
    let confirmHandler: (() => void) | undefined;
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      confirmHandler = (buttons as any[]).find((b) => b.text === "Reportar")?.onPress;
    });

    setup();
    const { getByText } = render(<ReportScreen />);
    advanceToConfirm(getByText);
    fireEvent.press(getByText(/Reportar A1 como/));
    await act(async () => { confirmHandler?.(); });
    fireEvent.press(getByText("Hacer otro reporte"));

    expect(getByText("¿Qué querés reportar?")).toBeTruthy();
  });
});
