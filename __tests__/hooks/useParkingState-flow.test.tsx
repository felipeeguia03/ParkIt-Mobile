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
  useAuth: () => ({ user: { id: "user-1", name: "Test" } }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeSpot(id: string, status: SpotStatus): ParkingSpot {
  return { id, number: parseInt(id.slice(-1)), status };
}

function makeZone(id: string, spots: ParkingSpot[] = []): ParkingZone {
  const defaultSpots = spots.length
    ? spots
    : [makeSpot(`${id}1`, "available"), makeSpot(`${id}2`, "available")];
  return {
    id,
    name: `Zona ${id}`,
    spots: defaultSpots,
    spotLayout: { rows: 1, cols: defaultSpots.length },
    polygon: [],
    center: { latitude: 0, longitude: 0 },
    bounds: { north: 0, south: 0, east: 0, west: 0 },
  };
}

// ── availableSpots derivados ──────────────────────────────────────────────

describe("useParkingState — availableSpots", () => {
  it("devuelve todos los spots disponibles de todas las zonas", () => {
    const { result } = renderHook(() => useParkingState());

    const zoneA = makeZone("A", [
      makeSpot("A1", "available"),
      makeSpot("A2", "occupied"),
    ]);
    const zoneB = makeZone("B", [
      makeSpot("B1", "available"),
      makeSpot("B2", "available"),
    ]);

    act(() => { result.current.setZones([zoneA, zoneB]); });

    expect(result.current.availableSpots).toHaveLength(3);
  });

  it("no incluye spots occupied ni reported", () => {
    const { result } = renderHook(() => useParkingState());

    const zone = makeZone("A", [
      makeSpot("A1", "occupied"),
      makeSpot("A2", "reported"),
      makeSpot("A3", "available"),
    ]);

    act(() => { result.current.setZones([zone]); });

    expect(result.current.availableSpots).toHaveLength(1);
    expect(result.current.availableSpots[0].spot.id).toBe("A3");
  });

  it("filtra por zoneFilter cuando se establece", () => {
    const { result } = renderHook(() => useParkingState());

    const zoneA = makeZone("A"); // 2 available
    const zoneB = makeZone("B"); // 2 available

    act(() => {
      result.current.setZones([zoneA, zoneB]);
      result.current.handleZoneFilterChange("A");
    });

    expect(result.current.availableSpots).toHaveLength(2);
    expect(result.current.availableSpots.every((s) => s.zone.id === "A")).toBe(true);
  });

  it("sin filtro, devuelve spots de todas las zonas", () => {
    const { result } = renderHook(() => useParkingState());

    act(() => {
      result.current.setZones([makeZone("A"), makeZone("B")]);
      result.current.handleZoneFilterChange(null);
    });

    expect(result.current.availableSpots).toHaveLength(4);
  });
});

// ── Carrusel de spots ─────────────────────────────────────────────────────

describe("useParkingState — carrusel de spots", () => {
  it("currentAvailableSpot empieza en índice 0", () => {
    const { result } = renderHook(() => useParkingState());

    const zone = makeZone("A", [
      makeSpot("A1", "available"),
      makeSpot("A2", "available"),
    ]);

    act(() => { result.current.setZones([zone]); });

    expect(result.current.currentAvailableSpot?.spot.id).toBe("A1");
  });

  it("handleNextSpot avanza el carrusel", () => {
    const { result } = renderHook(() => useParkingState());

    act(() => {
      result.current.setZones([makeZone("A")]); // A1, A2 disponibles
    });

    act(() => { result.current.handleNextSpot(); });

    expect(result.current.currentAvailableSpot?.spot.id).toBe("A2");
  });

  it("handleNextSpot hace wrap-around al principio", () => {
    const { result } = renderHook(() => useParkingState());

    act(() => { result.current.setZones([makeZone("A")]); }); // 2 spots

    act(() => { result.current.handleNextSpot(); }); // índice 1
    act(() => { result.current.handleNextSpot(); }); // wrap → índice 0

    expect(result.current.currentAvailableSpot?.spot.id).toBe("A1");
  });

  it("handlePrevSpot retrocede el carrusel con wrap-around", () => {
    const { result } = renderHook(() => useParkingState());

    act(() => { result.current.setZones([makeZone("A")]); }); // 2 spots

    act(() => { result.current.handlePrevSpot(); }); // 0 → wrap → 1

    expect(result.current.currentAvailableSpot?.spot.id).toBe("A2");
  });

  it("handleZoneFilterChange resetea el índice a 0", () => {
    const { result } = renderHook(() => useParkingState());

    act(() => {
      result.current.setZones([makeZone("A"), makeZone("B")]);
    });

    act(() => { result.current.handleNextSpot(); }); // índice 1

    act(() => { result.current.handleZoneFilterChange("A"); }); // reset → 0

    expect(result.current.currentAvailableSpot?.spot.id).toBe("A1");
  });

  it("currentAvailableSpot es null si no hay spots disponibles", () => {
    const { result } = renderHook(() => useParkingState());

    const zone = makeZone("A", [makeSpot("A1", "occupied")]);

    act(() => { result.current.setZones([zone]); });

    expect(result.current.currentAvailableSpot).toBeNull();
  });
});

// ── handleQuickSelect ─────────────────────────────────────────────────────

describe("useParkingState — handleQuickSelect", () => {
  it("abre modal de confirmación con el spot actual del carrusel", () => {
    const { result } = renderHook(() => useParkingState());

    act(() => { result.current.setZones([makeZone("A")]); });

    act(() => { result.current.handleQuickSelect(); });

    expect(result.current.confirmModalOpen).toBe(true);
    expect(result.current.selectedSpot?.id).toBe("A1");
  });

  it("no hace nada si no hay spots disponibles", () => {
    const { result } = renderHook(() => useParkingState());

    const zone = makeZone("A", [makeSpot("A1", "occupied")]);
    act(() => { result.current.setZones([zone]); });

    act(() => { result.current.handleQuickSelect(); });

    expect(result.current.confirmModalOpen).toBe(false);
  });

  it("bloquea si el usuario ya tiene parking activo (doble ocupación)", async () => {
    const { result } = renderHook(() => useParkingState());
    const zone = makeZone("A");

    // Establecer parking activo
    act(() => {
      result.current.setZones([zone]);
      result.current.handleSpotSelect(zone, zone.spots[0]);
    });
    await act(async () => { await result.current.handleConfirmParking(); });

    expect(result.current.userParking).not.toBeNull();

    // Cerrar modal para el test
    act(() => { result.current.setConfirmModalOpen(false); });

    // Intentar quickSelect de nuevo → no debe abrir modal (muestra Alert)
    act(() => { result.current.handleQuickSelect(); });

    expect(result.current.confirmModalOpen).toBe(false);
  });
});
