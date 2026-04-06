import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { Alert, InteractionManager } from "react-native";
import MapScreen from "@/app/(tabs)/map";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSetStatus    = jest.fn();
const mockRequestPerm  = jest.fn();
const mockRecheck      = jest.fn();
const mockUseLocation  = jest.fn();
const mockUseGeofence  = jest.fn();
const mockUseParkCtx   = jest.fn();

jest.mock("@/hooks/useLocationPermission", () => ({
  useLocationPermission: (...a: any[]) => mockUseLocation(...a),
}));

jest.mock("@/hooks/useUCCGeofence", () => ({
  useUCCGeofence: (...a: any[]) => mockUseGeofence(...a),
}));

jest.mock("@/context/ParkingContext", () => ({
  useParkingContext: (...a: any[]) => mockUseParkCtx(...a),
}));

// CampusMap is heavy — stub it out
jest.mock("@/components/parking/CampusMap", () => ({
  CampusMap: ({ onSpotSelect, onReportSpot }: any) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <>
        <TouchableOpacity testID="spot-select-btn" onPress={() => onSpotSelect(mockZone, mockSpot)} />
        <TouchableOpacity testID="spot-report-btn" onPress={() => onReportSpot(mockZone, mockSpot)} />
      </>
    );
  },
}));

jest.mock("@/components/parking/ConfirmParkingModal", () => ({
  ConfirmParkingModal: () => null,
}));

jest.mock("@/components/parking/ReportSpotModal", () => ({
  ReportSpotModal: () => null,
}));

jest.spyOn(InteractionManager, "runAfterInteractions").mockImplementation((cb: any) => {
  cb();
  return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() };
});

// ── Fixtures ──────────────────────────────────────────────────────────────

const mockZone = { id: "A", name: "Zona A", spots: [], spotLayout: { rows: 1, cols: 1 }, polygon: [], center: { latitude: 0, longitude: 0 }, bounds: { north: 0, south: 0, east: 0, west: 0 } };
const mockSpot = { id: "A1", number: 1, status: "available" as const };

const parkingCtxBase = {
  zones: [mockZone],
  selectedZone: null,
  selectedSpot: null,
  confirmModalOpen: false,
  reportModalOpen: false,
  setConfirmModalOpen: jest.fn(),
  setReportModalOpen: jest.fn(),
  handleSpotSelect: jest.fn(),
  handleReportSpot: jest.fn(),
  handleConfirmParking: jest.fn(),
  handleReportConfirm: jest.fn(),
};

function setup({
  locationStatus = "granted" as "granted" | "denied" | "undetermined",
  geofenceStatus = "inside" as "inside" | "outside" | "unknown",
} = {}) {
  mockUseLocation.mockReturnValue({
    status: locationStatus,
    setStatus: mockSetStatus,
    requestPermission: mockRequestPerm,
  });
  mockUseGeofence.mockReturnValue({
    status: geofenceStatus,
    recheck: mockRecheck,
  });
  mockUseParkCtx.mockReturnValue({ ...parkingCtxBase });
  mockRecheck.mockResolvedValue(undefined);
}

beforeEach(() => jest.clearAllMocks());

// ── Permission states ──────────────────────────────────────────────────────

describe("MapScreen — estados de permiso de ubicación", () => {
  it("muestra la pantalla de permiso cuando status='undetermined'", () => {
    setup({ locationStatus: "undetermined" });
    const { getByText } = render(<MapScreen />);
    expect(getByText("¿Dónde estás en el campus?")).toBeTruthy();
    expect(getByText("Permitir ubicación")).toBeTruthy();
  });

  it("muestra mensaje de denegado cuando status='denied'", () => {
    setup({ locationStatus: "denied" });
    const { getByText } = render(<MapScreen />);
    expect(getByText("Ubicación desactivada")).toBeTruthy();
  });

  it("muestra el mapa cuando status='granted'", () => {
    setup({ locationStatus: "granted" });
    const { getByTestId } = render(<MapScreen />);
    expect(getByTestId("spot-select-btn")).toBeTruthy();
  });

  it("'Permitir ubicación' llama a requestPermission", () => {
    setup({ locationStatus: "undetermined" });
    const { getByText } = render(<MapScreen />);
    fireEvent.press(getByText("Permitir ubicación"));
    expect(mockRequestPerm).toHaveBeenCalled();
  });

  it("'Ahora no' setea status='denied'", () => {
    setup({ locationStatus: "undetermined" });
    const { getByText } = render(<MapScreen />);
    fireEvent.press(getByText("Ahora no"));
    expect(mockSetStatus).toHaveBeenCalledWith("denied");
  });
});

// ── Geofence guard ─────────────────────────────────────────────────────────

describe("MapScreen — geofence guard en handleSpotSelect", () => {
  it("llama a recheck() antes de intentar reclamar un lugar", async () => {
    setup({ locationStatus: "granted", geofenceStatus: "inside" });
    const { getByTestId } = render(<MapScreen />);

    await act(async () => { fireEvent.press(getByTestId("spot-select-btn")); });

    expect(mockRecheck).toHaveBeenCalled();
  });

  it("muestra Alert cuando el usuario está fuera del campus", async () => {
    jest.spyOn(Alert, "alert");
    // recheck resolves THEN geofenceStatus reads as "outside" via ref
    mockRecheck.mockImplementationOnce(async () => {
      // Simulate geofenceStatus changing to outside during recheck
    });
    setup({ locationStatus: "granted", geofenceStatus: "outside" });
    const { getByTestId } = render(<MapScreen />);

    await act(async () => { fireEvent.press(getByTestId("spot-select-btn")); });

    expect(Alert.alert).toHaveBeenCalledWith(
      "Estás fuera del campus",
      expect.any(String),
      expect.any(Array),
    );
  });

  it("NO llama a handleSpotSelect del contexto cuando está fuera del campus", async () => {
    setup({ locationStatus: "granted", geofenceStatus: "outside" });
    const { getByTestId } = render(<MapScreen />);

    await act(async () => { fireEvent.press(getByTestId("spot-select-btn")); });

    expect(parkingCtxBase.handleSpotSelect).not.toHaveBeenCalled();
  });

  it("sí llama a handleSpotSelect del contexto cuando está dentro del campus", async () => {
    setup({ locationStatus: "granted", geofenceStatus: "inside" });
    const { getByTestId } = render(<MapScreen />);

    await act(async () => { fireEvent.press(getByTestId("spot-select-btn")); });

    expect(parkingCtxBase.handleSpotSelect).toHaveBeenCalledWith(mockZone, mockSpot);
  });
});
