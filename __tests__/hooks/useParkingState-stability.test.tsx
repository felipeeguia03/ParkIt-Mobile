import { renderHook, act } from "@testing-library/react-native";
import { useParkingState } from "@/hooks/useParkingState";
import { ParkingZone, ParkingSpot, SpotStatus } from "@/lib/parking-data";

// ── Mocks ─────────────────────────────────────────────────────────────────

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ then: (cb: any) => cb({ data: [], error: null }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: () => Promise.resolve({ error: null }),
    }),
    channel: () => ({
      on: function () { return this; },
      subscribe: () => ({}),
    }),
    removeChannel: jest.fn(),
  },
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-test-1", name: "Test User" } }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeSpot(id: string, status: SpotStatus): ParkingSpot {
  return { id, number: parseInt(id.slice(1)), status };
}

function makeZone(id: string): ParkingZone {
  return {
    id,
    name: `Zona ${id}`,
    spots: [makeSpot(`${id}1`, "available"), makeSpot(`${id}2`, "available")],
    spotLayout: { rows: 1, cols: 2 },
    polygon: [],
    center: { latitude: 0, longitude: 0 },
    bounds: { north: 0, south: 0, east: 0, west: 0 },
  };
}

// ── Tests de estabilidad de referencia ────────────────────────────────────

describe("useParkingState — estabilidad de handlers (Fase 2a)", () => {
  it("handleSpotSelect mantiene referencia tras setZones", () => {
    const { result } = renderHook(() => useParkingState());

    const ref1 = result.current.handleSpotSelect;

    act(() => {
      result.current.setZones([makeZone("A"), makeZone("B")]);
    });

    const ref2 = result.current.handleSpotSelect;
    expect(ref1).toBe(ref2);
  });

  it("handleReportSpot mantiene referencia tras setZones", () => {
    const { result } = renderHook(() => useParkingState());

    const ref1 = result.current.handleReportSpot;

    act(() => {
      result.current.setZones([makeZone("A")]);
    });

    expect(result.current.handleReportSpot).toBe(ref1);
  });

  it("handleConfirmParking mantiene referencia tras setZones", () => {
    const { result } = renderHook(() => useParkingState());
    const ref1 = result.current.handleConfirmParking;

    act(() => { result.current.setZones([makeZone("A")]); });

    expect(result.current.handleConfirmParking).toBe(ref1);
  });

  it("handleLeaveParking mantiene referencia tras setZones", () => {
    const { result } = renderHook(() => useParkingState());
    const ref1 = result.current.handleLeaveParking;

    act(() => { result.current.setZones([makeZone("A")]); });

    expect(result.current.handleLeaveParking).toBe(ref1);
  });

  it("handleReportConfirm mantiene referencia tras setZones", () => {
    const { result } = renderHook(() => useParkingState());
    const ref1 = result.current.handleReportConfirm;

    act(() => { result.current.setZones([makeZone("A")]); });

    expect(result.current.handleReportConfirm).toBe(ref1);
  });

  it("handlers estables a través de 10 setZones consecutivos", () => {
    const { result } = renderHook(() => useParkingState());

    const refs = {
      handleSpotSelect:   result.current.handleSpotSelect,
      handleReportSpot:   result.current.handleReportSpot,
      handleConfirmParking: result.current.handleConfirmParking,
      handleLeaveParking: result.current.handleLeaveParking,
    };

    for (let i = 0; i < 10; i++) {
      act(() => { result.current.setZones([makeZone("A"), makeZone("B")]); });
    }

    expect(result.current.handleSpotSelect).toBe(refs.handleSpotSelect);
    expect(result.current.handleReportSpot).toBe(refs.handleReportSpot);
    expect(result.current.handleConfirmParking).toBe(refs.handleConfirmParking);
    expect(result.current.handleLeaveParking).toBe(refs.handleLeaveParking);
  });
});

// ── Tests de lógica de negocio ─────────────────────────────────────────────

describe("useParkingState — lógica de selección", () => {
  it("handleSpotSelect con spot 'available' → abre confirmModal", () => {
    const { result } = renderHook(() => useParkingState());
    const zone = makeZone("A");
    const spot = zone.spots[0]; // available

    act(() => {
      result.current.handleSpotSelect(zone, spot);
    });

    expect(result.current.confirmModalOpen).toBe(true);
    expect(result.current.selectedSpot?.id).toBe(spot.id);
    expect(result.current.selectedZone?.id).toBe(zone.id);
  });

  it("handleSpotSelect con spot 'occupied' → no abre modal", () => {
    const { result } = renderHook(() => useParkingState());
    const zone = makeZone("A");
    const spot = { ...zone.spots[0], status: "occupied" as SpotStatus };

    act(() => {
      result.current.handleSpotSelect(zone, spot);
    });

    expect(result.current.confirmModalOpen).toBe(false);
  });

  it("handleReportSpot con spot 'occupied' → abre reportModal", () => {
    const { result } = renderHook(() => useParkingState());
    const zone = makeZone("A");
    const spot = { ...zone.spots[0], status: "occupied" as SpotStatus };

    act(() => {
      result.current.handleReportSpot(zone, spot);
    });

    expect(result.current.reportModalOpen).toBe(true);
  });

  it("handleReportSpot con spot 'available' → no abre modal", () => {
    const { result } = renderHook(() => useParkingState());
    const zone = makeZone("A");

    act(() => {
      result.current.handleReportSpot(zone, zone.spots[0]); // available
    });

    expect(result.current.reportModalOpen).toBe(false);
  });
});

// ── Tests de flujo de estacionamiento ─────────────────────────────────────

describe("useParkingState — flujo claim/release", () => {
  it("handleConfirmParking → userParking se setea con zona y spot correctos", async () => {
    const { result } = renderHook(() => useParkingState());
    const zone = makeZone("A");
    const spot = zone.spots[0];

    // Seleccionar spot primero
    act(() => { result.current.handleSpotSelect(zone, spot); });

    await act(async () => {
      await result.current.handleConfirmParking();
    });

    expect(result.current.userParking?.zone.id).toBe("A");
    expect(result.current.userParking?.spot.id).toBe(spot.id);
    expect(result.current.userParking?.parkedAt).toBeInstanceOf(Date);
  });

  it("handleConfirmParking → spot pasa a 'occupied' en zones", async () => {
    const { result } = renderHook(() => useParkingState());
    const zone = makeZone("A");
    const spot = zone.spots[0];

    act(() => {
      result.current.setZones([zone]);
      result.current.handleSpotSelect(zone, spot);
    });

    await act(async () => {
      await result.current.handleConfirmParking();
    });

    const updatedSpot = result.current.zones[0].spots.find((s) => s.id === spot.id);
    expect(updatedSpot?.status).toBe("occupied");
  });

  it("handleConfirmParking → cierra el modal", async () => {
    const { result } = renderHook(() => useParkingState());
    const zone = makeZone("A");

    act(() => { result.current.handleSpotSelect(zone, zone.spots[0]); });
    expect(result.current.confirmModalOpen).toBe(true);

    await act(async () => { await result.current.handleConfirmParking(); });

    expect(result.current.confirmModalOpen).toBe(false);
  });

  it("handleLeaveParking → userParking vuelve a null", async () => {
    const { result } = renderHook(() => useParkingState());
    const zone = makeZone("A");

    act(() => { result.current.handleSpotSelect(zone, zone.spots[0]); });
    await act(async () => { await result.current.handleConfirmParking(); });

    expect(result.current.userParking).not.toBeNull();

    await act(async () => { await result.current.handleLeaveParking(); });

    expect(result.current.userParking).toBeNull();
  });

  it("handleLeaveParking → spot vuelve a 'available'", async () => {
    const { result } = renderHook(() => useParkingState());
    const zone = makeZone("A");
    const spot = zone.spots[0];

    act(() => {
      result.current.setZones([zone]);
      result.current.handleSpotSelect(zone, spot);
    });
    await act(async () => { await result.current.handleConfirmParking(); });
    await act(async () => { await result.current.handleLeaveParking(); });

    const updatedSpot = result.current.zones[0].spots.find((s) => s.id === spot.id);
    expect(updatedSpot?.status).toBe("available");
  });
});
