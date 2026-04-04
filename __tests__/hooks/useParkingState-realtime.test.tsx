import { renderHook, act } from "@testing-library/react-native";
import { useParkingState } from "@/hooks/useParkingState";
import { ParkingZone, ParkingSpot, SpotStatus } from "@/lib/parking-data";

// ── Realtime channel mock ──────────────────────────────────────────────────
// Guardamos el callback que el hook registra para poder dispararlo en los tests.

type RealtimePayload = { new: { id: string; status: SpotStatus } };

let capturedOnPayload: ((payload: RealtimePayload) => void) | null = null;

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ then: (cb: any) => cb({ data: [], error: null }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: () => Promise.resolve({ error: null }),
    }),
    channel: () => ({
      on: function (_event: string, _filter: any, cb: (p: RealtimePayload) => void) {
        capturedOnPayload = cb;
        return this;
      },
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

// ── Tests de Realtime ──────────────────────────────────────────────────────

describe("useParkingState — Realtime (Fase 2b)", () => {
  beforeEach(() => {
    capturedOnPayload = null;
  });

  it("Realtime actualiza el status de un spot en zones", async () => {
    const { result } = renderHook(() => useParkingState());

    act(() => {
      result.current.setZones([makeZone("A")]);
    });

    expect(capturedOnPayload).not.toBeNull();

    await act(async () => {
      capturedOnPayload!({ new: { id: "A1", status: "occupied" } });
    });

    const spot = result.current.zones[0].spots.find((s) => s.id === "A1");
    expect(spot?.status).toBe("occupied");
  });

  it("Realtime no modifica zonas que no contienen el spot", async () => {
    const { result } = renderHook(() => useParkingState());
    const zoneA = makeZone("A");
    const zoneB = makeZone("B");

    act(() => { result.current.setZones([zoneA, zoneB]); });

    const zoneARef = result.current.zones[0];

    await act(async () => {
      capturedOnPayload!({ new: { id: "B1", status: "occupied" } });
    });

    // Zona A no cambió → misma referencia de objeto (updateOneSpot optimization)
    expect(result.current.zones[0]).toBe(zoneARef);
  });

  it("deduplication: eco del propio optimistic → no vuelve a aplicar", async () => {
    const { result } = renderHook(() => useParkingState());
    const zone = makeZone("A");
    const spot = zone.spots[0]; // A1, available

    act(() => {
      result.current.setZones([zone]);
      result.current.handleSpotSelect(zone, spot);
    });

    // Confirmar parking → optimistic "occupied" + pendingOptimistic.set("A1", "occupied")
    await act(async () => {
      await result.current.handleConfirmParking();
    });

    expect(result.current.zones[0].spots[0].status).toBe("occupied");

    // Simular eco de Realtime con mismo status (debería ignorarse, no volver a setZones)
    const zonesSnapshot = result.current.zones;

    await act(async () => {
      capturedOnPayload!({ new: { id: "A1", status: "occupied" } });
    });

    // La referencia a zones debe ser la misma (dedup filtró el eco)
    expect(result.current.zones).toBe(zonesSnapshot);
  });

  it("deduplication: Realtime con status diferente → sí aplica corrección del servidor", async () => {
    const { result } = renderHook(() => useParkingState());
    const zone = makeZone("A");
    const spot = zone.spots[0]; // A1

    act(() => {
      result.current.setZones([zone]);
      result.current.handleSpotSelect(zone, spot);
    });

    // Optimistic: "occupied"
    await act(async () => {
      await result.current.handleConfirmParking();
    });

    // Servidor responde con status distinto al optimístico → debe aplicarse
    await act(async () => {
      capturedOnPayload!({ new: { id: "A1", status: "available" } });
    });

    const updatedSpot = result.current.zones[0].spots.find((s) => s.id === "A1");
    expect(updatedSpot?.status).toBe("available");
  });

  it("Realtime desconocido (no en pendingOptimistic) → aplica directamente", async () => {
    const { result } = renderHook(() => useParkingState());

    act(() => { result.current.setZones([makeZone("A")]); });

    await act(async () => {
      capturedOnPayload!({ new: { id: "A2", status: "occupied" } });
    });

    const spot = result.current.zones[0].spots.find((s) => s.id === "A2");
    expect(spot?.status).toBe("occupied");
  });
});
