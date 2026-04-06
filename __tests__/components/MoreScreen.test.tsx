import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as ExpoRouter from "expo-router";
import MoreScreen from "@/app/(tabs)/more";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockLogout = jest.fn();
const mockUseAuth = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

const mockUseUserStats = jest.fn();

jest.mock("@/hooks/useUserStats", () => ({
  useUserStats: (...args: any[]) => mockUseUserStats(...args),
}));

// Supabase mock (used by HistorialContent / ReportesContent when sheets open)
const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { from: (...a: any[]) => mockFrom(...a) },
}));

function makeBuilder(resolveWith: object = { data: [], count: 0 }) {
  const b: any = {};
  ["select", "eq", "order", "limit"].forEach((m) => { b[m] = jest.fn(() => b); });
  b.then = (onFulfilled: any) => Promise.resolve(resolveWith).then(onFulfilled);
  return b;
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const mockUser = {
  id: "u1",
  email: "juan@ucc.edu.ar",
  name: "Juan Pérez",
  role: "user" as const,
};

const mockStats = {
  sessions: 5,
  totalMinutes: 130,
  favoriteZone: "A",
  reports: 2,
};

// ── Setup ──────────────────────────────────────────────────────────────────

function setup({
  user = mockUser,
  stats = mockStats,
  statsLoading = false,
} = {}) {
  const mockBack = jest.fn();
  (ExpoRouter.useRouter as jest.Mock).mockReturnValue({
    back: mockBack,
    replace: jest.fn(),
    push: jest.fn(),
    navigate: jest.fn(),
  });
  mockUseAuth.mockReturnValue({ user, logout: mockLogout });
  mockUseUserStats.mockReturnValue({ stats, loading: statsLoading });
  mockFrom.mockReturnValue(makeBuilder());
  return { mockBack };
}

beforeEach(() => jest.clearAllMocks());

// ── Render básico ──────────────────────────────────────────────────────────

describe("MoreScreen — render básico", () => {
  it("muestra el nombre y email del usuario", () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    expect(getByText("Juan Pérez")).toBeTruthy();
    expect(getByText("juan@ucc.edu.ar")).toBeTruthy();
  });

  it("muestra '?' cuando el usuario no tiene nombre", () => {
    setup({ user: { ...mockUser, name: null as any } });
    const { getByText } = render(<MoreScreen />);
    expect(getByText("?")).toBeTruthy();
  });

  it("muestra initial del nombre en el avatar", () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    expect(getByText("J")).toBeTruthy();
  });
});

// ── Stats ──────────────────────────────────────────────────────────────────

describe("MoreScreen — stats", () => {
  it("muestra spinner mientras statsLoading=true", () => {
    setup({ statsLoading: true });
    const { getByText } = render(<MoreScreen />);
    expect(getByText("Cargando…")).toBeTruthy();
  });

  it("muestra chips de estadísticas cuando los datos están listos", () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    expect(getByText("5")).toBeTruthy();     // sessions
    expect(getByText("Sesiones")).toBeTruthy();
    expect(getByText("2 h 10 m")).toBeTruthy(); // 130 min
    expect(getByText("Tiempo total")).toBeTruthy();
    expect(getByText("Zona A")).toBeTruthy(); // favoriteZone
  });

  it("muestra '0 min' cuando totalMinutes es 0", () => {
    setup({ stats: { ...mockStats, totalMinutes: 0 } });
    const { getByText } = render(<MoreScreen />);
    expect(getByText("0 min")).toBeTruthy();
  });

  it("subtítulo de Historial refleja el número de sesiones", () => {
    setup({ stats: { ...mockStats, sessions: 3 } });
    const { getByText } = render(<MoreScreen />);
    // "sesión" + "es" → "sesiónes" (template literal preserves accent)
    expect(getByText("3 sesiónes registradas")).toBeTruthy();
  });

  it("subtítulo de Historial dice 'sesión' en singular", () => {
    setup({ stats: { ...mockStats, sessions: 1 } });
    const { getByText } = render(<MoreScreen />);
    expect(getByText("1 sesión registrada")).toBeTruthy();
  });

  it("subtítulo de Reportes refleja el número de reportes", () => {
    setup({ stats: { ...mockStats, reports: 2 } });
    const { getByText } = render(<MoreScreen />);
    expect(getByText("2 reportes enviados")).toBeTruthy();
  });
});

// ── Secciones del menú ─────────────────────────────────────────────────────

describe("MoreScreen — secciones del menú", () => {
  it("muestra todas las secciones", () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    expect(getByText("Mi cuenta")).toBeTruthy();
    expect(getByText("Estacionamiento")).toBeTruthy();
    expect(getByText("Información del campus")).toBeTruthy();
    expect(getByText("Soporte")).toBeTruthy();
  });

  it("muestra los ítems de Mi cuenta", () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    expect(getByText("Editar perfil")).toBeTruthy();
    expect(getByText("Notificaciones")).toBeTruthy();
  });

  it("muestra los ítems de Información del campus", () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    expect(getByText("Reglamento de uso")).toBeTruthy();
    expect(getByText("Zonas del campus")).toBeTruthy();
    expect(getByText("Horarios")).toBeTruthy();
  });

  it("muestra los ítems de Soporte", () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    expect(getByText("Centro de ayuda")).toBeTruthy();
    expect(getByText("Reportar un problema")).toBeTruthy();
    expect(getByText("Contacto")).toBeTruthy();
  });
});

// ── Logout ─────────────────────────────────────────────────────────────────

describe("MoreScreen — logout", () => {
  it("muestra Alert al tocar Cerrar sesión", () => {
    jest.spyOn(Alert, "alert");
    setup();
    const { getByText } = render(<MoreScreen />);
    fireEvent.press(getByText("Cerrar sesión"));
    expect(Alert.alert).toHaveBeenCalledWith(
      "Cerrar sesión",
      "¿Seguro que querés salir?",
      expect.any(Array),
    );
  });

  it("llama a logout al confirmar en el Alert", () => {
    let destructiveHandler: (() => void) | undefined;
    jest.spyOn(Alert, "alert").mockImplementation((_title, _msg, buttons) => {
      destructiveHandler = (buttons as any[]).find((b) => b.style === "destructive")?.onPress;
    });
    setup();
    const { getByText } = render(<MoreScreen />);
    fireEvent.press(getByText("Cerrar sesión"));
    destructiveHandler?.();
    expect(mockLogout).toHaveBeenCalled();
  });
});

// ── Sheets ─────────────────────────────────────────────────────────────────

describe("MoreScreen — apertura de sheets", () => {
  it("abre el sheet de Historial al tocar el ítem", async () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    await act(async () => { fireEvent.press(getByText("Historial de uso")); });
    // HistorialContent empty state — unique to the sheet
    expect(getByText("Sin sesiones aún")).toBeTruthy();
  });

  it("abre el sheet de Reglamento al tocar el ítem", async () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    await act(async () => { fireEvent.press(getByText("Reglamento de uso")); });
    expect(getByText("Uso exclusivo universitario")).toBeTruthy();
  });

  it("abre el sheet de Horarios al tocar el ítem", async () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    await act(async () => { fireEvent.press(getByText("Horarios")); });
    expect(getByText("Lunes – Viernes")).toBeTruthy();
  });

  it("abre el sheet de Zonas al tocar el ítem", async () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    await act(async () => { fireEvent.press(getByText("Zonas del campus")); });
    expect(getByText("Total campus")).toBeTruthy();
  });

  it("abre el sheet de Ayuda al tocar el ítem", async () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    await act(async () => { fireEvent.press(getByText("Centro de ayuda")); });
    expect(getByText("¿Cómo registro un lugar?")).toBeTruthy();
  });

  it("abre el sheet de Contacto al tocar el ítem", async () => {
    setup();
    const { getByText } = render(<MoreScreen />);
    await act(async () => { fireEvent.press(getByText("Contacto")); });
    // Phone number only appears inside ContactoContent
    expect(getByText("(0351) 493-8000 int. 248")).toBeTruthy();
  });
});
