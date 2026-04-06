import { renderHook, act } from "@testing-library/react-native";
import { useUserStats } from "@/hooks/useUserStats";

// ── Supabase mock ──────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: { from: (...a: any[]) => mockFrom(...a) },
}));

// Builds a chainable query builder that resolves to `resolveWith`
function makeBuilder(resolveWith: object) {
  const b: any = {};
  ["select", "eq", "not", "order", "limit"].forEach((m) => {
    b[m] = jest.fn(() => b);
  });
  // Thenable so Promise.all can await it
  b.then = (onFulfilled: (v: any) => any, onRejected?: any) =>
    Promise.resolve(resolveWith).then(onFulfilled, onRejected);
  return b;
}

// ── Setup helpers ──────────────────────────────────────────────────────────

function setupMocks({
  sessions = 0,
  durations = [] as { duration_minutes: number }[],
  zoneRows = [] as { zone_id: string }[],
  reports = 0,
} = {}) {
  mockFrom
    .mockImplementationOnce(() => makeBuilder({ count: sessions, data: null }))  // claims
    .mockImplementationOnce(() => makeBuilder({ count: null, data: durations })) // durations
    .mockImplementationOnce(() => makeBuilder({ count: null, data: zoneRows }))  // zones
    .mockImplementationOnce(() => makeBuilder({ count: reports, data: null }));  // reports
}

beforeEach(() => jest.clearAllMocks());

// ── Estado inicial ─────────────────────────────────────────────────────────

describe("useUserStats — estado inicial", () => {
  it("empieza con stats=null y loading=true", () => {
    // Never resolves
    mockFrom.mockReturnValue(makeBuilder(new Promise(() => {})));
    const { result } = renderHook(() => useUserStats("u1"));
    expect(result.current.stats).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});

// ── Sin userId ─────────────────────────────────────────────────────────────

describe("useUserStats — sin userId", () => {
  it("loading pasa a false y stats queda null cuando userId es undefined", async () => {
    const { result } = renderHook(() => useUserStats(undefined));
    await act(async () => {});
    expect(result.current.stats).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ── Cálculo de estadísticas ────────────────────────────────────────────────

describe("useUserStats — cálculo de stats", () => {
  it("cuenta sesiones correctamente", async () => {
    setupMocks({ sessions: 7 });
    const { result } = renderHook(() => useUserStats("u1"));
    await act(async () => {});
    expect(result.current.stats?.sessions).toBe(7);
    expect(result.current.loading).toBe(false);
  });

  it("suma totalMinutes de filas de duración", async () => {
    setupMocks({
      durations: [{ duration_minutes: 60 }, { duration_minutes: 45 }, { duration_minutes: 30 }],
    });
    const { result } = renderHook(() => useUserStats("u1"));
    await act(async () => {});
    expect(result.current.stats?.totalMinutes).toBe(135);
  });

  it("calcula zona favorita como la más repetida", async () => {
    setupMocks({
      zoneRows: [
        { zone_id: "A" }, { zone_id: "A" }, { zone_id: "A" },
        { zone_id: "B" }, { zone_id: "B" },
        { zone_id: "C" },
      ],
    });
    const { result } = renderHook(() => useUserStats("u1"));
    await act(async () => {});
    expect(result.current.stats?.favoriteZone).toBe("A");
  });

  it("cuenta reportes correctamente", async () => {
    setupMocks({ reports: 4 });
    const { result } = renderHook(() => useUserStats("u1"));
    await act(async () => {});
    expect(result.current.stats?.reports).toBe(4);
  });

  it("favoriteZone es null cuando no hay sesiones", async () => {
    setupMocks({ zoneRows: [] });
    const { result } = renderHook(() => useUserStats("u1"));
    await act(async () => {});
    expect(result.current.stats?.favoriteZone).toBeNull();
  });

  it("totalMinutes es 0 cuando no hay datos de duración", async () => {
    setupMocks({ durations: [] });
    const { result } = renderHook(() => useUserStats("u1"));
    await act(async () => {});
    expect(result.current.stats?.totalMinutes).toBe(0);
  });
});

// ── Todo en cero ───────────────────────────────────────────────────────────

describe("useUserStats — usuario sin actividad", () => {
  it("devuelve stats vacías coherentes", async () => {
    setupMocks();
    const { result } = renderHook(() => useUserStats("u1"));
    await act(async () => {});
    expect(result.current.stats).toEqual({
      sessions: 0,
      totalMinutes: 0,
      favoriteZone: null,
      reports: 0,
    });
    expect(result.current.loading).toBe(false);
  });
});

// ── Llamadas a Supabase ────────────────────────────────────────────────────

describe("useUserStats — consultas a Supabase", () => {
  it("realiza exactamente 4 llamadas a supabase.from", async () => {
    setupMocks();
    renderHook(() => useUserStats("u1"));
    await act(async () => {});
    expect(mockFrom).toHaveBeenCalledTimes(4);
  });

  it("consulta parking_events y spot_reports", async () => {
    setupMocks();
    renderHook(() => useUserStats("u1"));
    await act(async () => {});
    const tables = mockFrom.mock.calls.map(([t]: [string]) => t);
    expect(tables).toContain("parking_events");
    expect(tables).toContain("spot_reports");
  });
});
