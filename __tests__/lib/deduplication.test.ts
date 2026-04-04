import { SpotStatus } from "@/lib/parking-data";

// Lógica de deduplicación extraída del handler de Realtime en useParkingState.
// Se testea como función pura para verificar los 4 casos de la Fase 2b.

function handleRealtimeUpdate(
  pendingOptimistic: Map<string, SpotStatus>,
  id: string,
  status: SpotStatus,
  applyUpdate: (id: string, status: SpotStatus) => void
): void {
  const expected = pendingOptimistic.get(id);
  if (expected !== undefined) {
    pendingOptimistic.delete(id);
    if (expected === status) return; // eco del propio optimistic → ignorar
  }
  applyUpdate(id, status);
}

describe("deduplicación optimistic + Realtime (Fase 2b)", () => {
  it("Realtime con mismo status que optimistic → update ignorado", () => {
    const pending = new Map<string, SpotStatus>([["A3", "occupied"]]);
    const applyUpdate = jest.fn();

    handleRealtimeUpdate(pending, "A3", "occupied", applyUpdate);

    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it("Realtime con mismo status → limpia el pendingOptimistic", () => {
    const pending = new Map<string, SpotStatus>([["A3", "occupied"]]);

    handleRealtimeUpdate(pending, "A3", "occupied", jest.fn());

    expect(pending.has("A3")).toBe(false);
  });

  it("Realtime con status distinto → update aplicado (servidor corrigió)", () => {
    const pending = new Map<string, SpotStatus>([["A3", "occupied"]]);
    const applyUpdate = jest.fn();

    // Esperábamos "occupied" pero el server mandó "available" (corrección)
    handleRealtimeUpdate(pending, "A3", "available", applyUpdate);

    expect(applyUpdate).toHaveBeenCalledWith("A3", "available");
  });

  it("Realtime sin optimistic pendiente → update aplicado normalmente", () => {
    const pending = new Map<string, SpotStatus>(); // vacío
    const applyUpdate = jest.fn();

    handleRealtimeUpdate(pending, "B1", "occupied", applyUpdate);

    expect(applyUpdate).toHaveBeenCalledWith("B1", "occupied");
  });

  it("dos spots en vuelo simultáneo → cada uno deduplica independientemente", () => {
    const pending = new Map<string, SpotStatus>([
      ["A3", "occupied"],
      ["B2", "available"],
    ]);
    const applyUpdate = jest.fn();

    // A3: eco del optimistic → ignorar
    handleRealtimeUpdate(pending, "A3", "occupied", applyUpdate);
    // B2: eco del optimistic → ignorar
    handleRealtimeUpdate(pending, "B2", "available", applyUpdate);

    expect(applyUpdate).not.toHaveBeenCalled();
    expect(pending.size).toBe(0);
  });

  it("Realtime de spot distinto no limpia el pending de otro spot", () => {
    const pending = new Map<string, SpotStatus>([["A3", "occupied"]]);
    const applyUpdate = jest.fn();

    // C1 llega, A3 sigue pendiente
    handleRealtimeUpdate(pending, "C1", "occupied", applyUpdate);

    expect(applyUpdate).toHaveBeenCalledWith("C1", "occupied");
    expect(pending.has("A3")).toBe(true); // A3 sigue pendiente
  });

  it("segundo Realtime del mismo spot (sin optimistic) → aplicado", () => {
    const pending = new Map<string, SpotStatus>([["A3", "occupied"]]);
    const applyUpdate = jest.fn();

    // Primer eco → ignorado y limpiado
    handleRealtimeUpdate(pending, "A3", "occupied", applyUpdate);
    // Segundo evento (otro usuario lo cambió después) → aplicado
    handleRealtimeUpdate(pending, "A3", "available", applyUpdate);

    expect(applyUpdate).toHaveBeenCalledTimes(1);
    expect(applyUpdate).toHaveBeenCalledWith("A3", "available");
  });
});
