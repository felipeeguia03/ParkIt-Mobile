import { renderHook, act } from "@testing-library/react-native";
import { useLocationPermission } from "@/hooks/useLocationPermission";

// ── Mock expo-location ────────────────────────────────────────────────────

const mockGetForeground   = jest.fn();
const mockRequestForeground = jest.fn();

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync:  (...a: any[]) => mockGetForeground(...a),
  requestForegroundPermissionsAsync: (...a: any[]) => mockRequestForeground(...a),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Por defecto: sin permiso previo
  mockGetForeground.mockResolvedValue({ status: "undetermined" });
});

// ── Estado inicial ────────────────────────────────────────────────────────

describe("useLocationPermission — estado inicial", () => {
  it("empieza en 'undetermined' antes de que resuelva el check", () => {
    mockGetForeground.mockReturnValue(new Promise(() => {})); // nunca resuelve
    const { result } = renderHook(() => useLocationPermission());
    expect(result.current.status).toBe("undetermined");
  });

  it("pasa a 'granted' si ya había permiso otorgado previamente", async () => {
    mockGetForeground.mockResolvedValue({ status: "granted" });
    const { result } = renderHook(() => useLocationPermission());
    await act(async () => {});
    expect(result.current.status).toBe("granted");
  });

  it("pasa a 'denied' si el permiso estaba denegado", async () => {
    mockGetForeground.mockResolvedValue({ status: "denied" });
    const { result } = renderHook(() => useLocationPermission());
    await act(async () => {});
    expect(result.current.status).toBe("denied");
  });

  it("se queda en 'undetermined' si el SO devuelve ese estado", async () => {
    mockGetForeground.mockResolvedValue({ status: "undetermined" });
    const { result } = renderHook(() => useLocationPermission());
    await act(async () => {});
    expect(result.current.status).toBe("undetermined");
  });
});

// ── requestPermission ─────────────────────────────────────────────────────

describe("useLocationPermission — requestPermission", () => {
  it("devuelve true y pone status 'granted' cuando el usuario acepta", async () => {
    mockGetForeground.mockResolvedValue({ status: "undetermined" });
    mockRequestForeground.mockResolvedValue({ status: "granted" });

    const { result } = renderHook(() => useLocationPermission());
    await act(async () => {});

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.requestPermission();
    });

    expect(returned).toBe(true);
    expect(result.current.status).toBe("granted");
  });

  it("devuelve false y pone status 'denied' cuando el usuario rechaza", async () => {
    mockGetForeground.mockResolvedValue({ status: "undetermined" });
    mockRequestForeground.mockResolvedValue({ status: "denied" });

    const { result } = renderHook(() => useLocationPermission());
    await act(async () => {});

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.requestPermission();
    });

    expect(returned).toBe(false);
    expect(result.current.status).toBe("denied");
  });

  it("llama a requestForegroundPermissionsAsync exactamente una vez", async () => {
    mockGetForeground.mockResolvedValue({ status: "undetermined" });
    mockRequestForeground.mockResolvedValue({ status: "granted" });

    const { result } = renderHook(() => useLocationPermission());
    await act(async () => {});
    await act(async () => { await result.current.requestPermission(); });

    expect(mockRequestForeground).toHaveBeenCalledTimes(1);
  });
});

// ── setStatus (override manual) ───────────────────────────────────────────

describe("useLocationPermission — setStatus", () => {
  it("setStatus permite forzar el estado (ej: 'Ahora no' en la UI)", async () => {
    mockGetForeground.mockResolvedValue({ status: "undetermined" });
    const { result } = renderHook(() => useLocationPermission());
    await act(async () => {});

    act(() => { result.current.setStatus("denied"); });
    expect(result.current.status).toBe("denied");
  });
});
