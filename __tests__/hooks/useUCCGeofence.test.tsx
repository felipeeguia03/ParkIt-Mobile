import { renderHook, act } from "@testing-library/react-native";
import { useUCCGeofence } from "@/hooks/useUCCGeofence";

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockGetForeground      = jest.fn();
const mockGetCurrentPosition = jest.fn();

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: (...a: any[]) => mockGetForeground(...a),
  getCurrentPositionAsync:       (...a: any[]) => mockGetCurrentPosition(...a),
  Accuracy: { Balanced: 3 },
}));

// isInsideCampus: función pura de ray-casting — la controlamos para
// desacoplar el geofence de la geometría del campus real en los tests.
const mockIsInsideCampus = jest.fn();

jest.mock("@/lib/parking-data", () => ({
  ...jest.requireActual("@/lib/parking-data"),
  isInsideCampus: (...a: any[]) => mockIsInsideCampus(...a),
}));

// Coordenadas de ejemplo
const INSIDE_COORDS  = { latitude: -31.4874, longitude: -64.2421 };
const OUTSIDE_COORDS = { latitude: -31.4200, longitude: -64.1800 };

function makeLoc(coords: { latitude: number; longitude: number }) {
  return { coords: { ...coords, altitude: 0, accuracy: 10, speed: 0, heading: 0 } };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Por defecto: sin permiso
  mockGetForeground.mockResolvedValue({ status: "undetermined" });
  mockIsInsideCampus.mockReturnValue(false);
});

// ── Estado inicial ────────────────────────────────────────────────────────

describe("useUCCGeofence — estado inicial", () => {
  it("empieza en 'unknown'", () => {
    mockGetForeground.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useUCCGeofence());
    expect(result.current.status).toBe("unknown");
    expect(result.current.userLocation).toBeNull();
  });
});

// ── Sin permiso de ubicación ──────────────────────────────────────────────

describe("useUCCGeofence — sin permiso", () => {
  it("se queda en 'unknown' y no llama a getCurrentPosition", async () => {
    mockGetForeground.mockResolvedValue({ status: "denied" });
    const { result } = renderHook(() => useUCCGeofence());
    await act(async () => {});

    expect(result.current.status).toBe("unknown");
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it("se queda en 'unknown' con status 'undetermined'", async () => {
    mockGetForeground.mockResolvedValue({ status: "undetermined" });
    const { result } = renderHook(() => useUCCGeofence());
    await act(async () => {});

    expect(result.current.status).toBe("unknown");
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });
});

// ── Con permiso — dentro/fuera del campus ─────────────────────────────────

describe("useUCCGeofence — con permiso", () => {
  beforeEach(() => {
    mockGetForeground.mockResolvedValue({ status: "granted" });
  });

  it("devuelve 'inside' cuando isInsideCampus retorna true", async () => {
    mockGetCurrentPosition.mockResolvedValue(makeLoc(INSIDE_COORDS));
    mockIsInsideCampus.mockReturnValue(true);

    const { result } = renderHook(() => useUCCGeofence());
    await act(async () => {});

    expect(result.current.status).toBe("inside");
    expect(result.current.userLocation).toEqual(INSIDE_COORDS);
  });

  it("devuelve 'outside' cuando isInsideCampus retorna false", async () => {
    mockGetCurrentPosition.mockResolvedValue(makeLoc(OUTSIDE_COORDS));
    mockIsInsideCampus.mockReturnValue(false);

    const { result } = renderHook(() => useUCCGeofence());
    await act(async () => {});

    expect(result.current.status).toBe("outside");
    expect(result.current.userLocation).toEqual(OUTSIDE_COORDS);
  });

  it("pasa las coordenadas correctas a isInsideCampus", async () => {
    mockGetCurrentPosition.mockResolvedValue(makeLoc(INSIDE_COORDS));
    mockIsInsideCampus.mockReturnValue(true);

    const { result } = renderHook(() => useUCCGeofence());
    await act(async () => {});

    expect(mockIsInsideCampus).toHaveBeenCalledWith(INSIDE_COORDS);
  });

  it("vuelve a 'unknown' si getCurrentPosition lanza", async () => {
    mockGetCurrentPosition.mockRejectedValue(new Error("GPS timeout"));

    const { result } = renderHook(() => useUCCGeofence());
    await act(async () => {});

    expect(result.current.status).toBe("unknown");
    expect(result.current.userLocation).toBeNull();
  });
});

// ── recheck ───────────────────────────────────────────────────────────────

describe("useUCCGeofence — recheck", () => {
  it("recheck re-evalúa el estado con datos frescos", async () => {
    mockGetForeground.mockResolvedValue({ status: "granted" });
    mockGetCurrentPosition.mockResolvedValue(makeLoc(OUTSIDE_COORDS));
    mockIsInsideCampus.mockReturnValue(false);

    const { result } = renderHook(() => useUCCGeofence());
    await act(async () => {});
    expect(result.current.status).toBe("outside");

    // La ubicación del usuario cambia → ahora está dentro
    mockGetCurrentPosition.mockResolvedValue(makeLoc(INSIDE_COORDS));
    mockIsInsideCampus.mockReturnValue(true);

    await act(async () => { await result.current.recheck(); });
    expect(result.current.status).toBe("inside");
    expect(result.current.userLocation).toEqual(INSIDE_COORDS);
  });

  it("recheck con permiso denegado → status vuelve a 'unknown'", async () => {
    // Empieza con permiso concedido
    mockGetForeground.mockResolvedValue({ status: "granted" });
    mockGetCurrentPosition.mockResolvedValue(makeLoc(INSIDE_COORDS));
    mockIsInsideCampus.mockReturnValue(true);

    const { result } = renderHook(() => useUCCGeofence());
    await act(async () => {});
    expect(result.current.status).toBe("inside");

    // El permiso se revocó entre medias
    mockGetForeground.mockResolvedValue({ status: "denied" });

    await act(async () => { await result.current.recheck(); });
    expect(result.current.status).toBe("unknown");
  });

  it("recheck llama a getCurrentPosition cada vez", async () => {
    mockGetForeground.mockResolvedValue({ status: "granted" });
    mockGetCurrentPosition.mockResolvedValue(makeLoc(INSIDE_COORDS));
    mockIsInsideCampus.mockReturnValue(true);

    const { result } = renderHook(() => useUCCGeofence());
    await act(async () => {});
    await act(async () => { await result.current.recheck(); });
    await act(async () => { await result.current.recheck(); });

    // 1 del mount + 2 rechecks = 3 llamadas
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(3);
  });
});

// ── isInsideCampus (función pura) — verificación de integración ───────────
// Testeamos que el hook pasa las coords sin modificar a isInsideCampus.
// La lógica interna de ray-casting está cubierta en __tests__/lib/

describe("useUCCGeofence — delegación correcta a isInsideCampus", () => {
  it("no modifica las coordenadas antes de pasarlas", async () => {
    const rawCoords = { latitude: -31.4874321, longitude: -64.2421456 };
    mockGetForeground.mockResolvedValue({ status: "granted" });
    mockGetCurrentPosition.mockResolvedValue(makeLoc(rawCoords));
    mockIsInsideCampus.mockReturnValue(true);

    const { result } = renderHook(() => useUCCGeofence());
    await act(async () => {});

    expect(mockIsInsideCampus).toHaveBeenCalledWith(rawCoords);
    expect(result.current.userLocation).toEqual(rawCoords);
  });
});
