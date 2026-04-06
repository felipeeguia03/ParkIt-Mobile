import React from "react";
import { render, act } from "@testing-library/react-native";
import * as ExpoRouter from "expo-router";
import RootLayout from "@/app/_layout";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUseAuth = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

// expo-router mock ya está en __mocks__/expo-router.ts con
// useRouter y useSegments como jest.fn().

// ── Helpers ────────────────────────────────────────────────────────────────

const mockUser = { id: "u1", email: "juan@ucc.edu.ar", name: "Juan", role: "user" as const };

function setup({
  user = null as typeof mockUser | null,
  loading = false,
  segments = [] as string[],
} = {}) {
  const mockReplace = jest.fn();
  (ExpoRouter.useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, navigate: jest.fn(), push: jest.fn(), back: jest.fn() });
  (ExpoRouter.useSegments as jest.Mock).mockReturnValue(segments);
  mockUseAuth.mockReturnValue({ user, loading });
  return { mockReplace };
}

beforeEach(() => jest.clearAllMocks());

// ── Loading ────────────────────────────────────────────────────────────────

describe("RootNavigator — loading", () => {
  it("muestra ActivityIndicator mientras loading=true", () => {
    setup({ loading: true });
    const { getByTestId } = render(<RootLayout />);
    // ActivityIndicator de RN tiene testID implícito por tipo de componente
    // lo buscamos por el hecho de que NO renderiza el Stack
    expect(() => getByTestId("activity-indicator")).not.toThrow();
  });

  it("no redirige mientras loading=true, aunque no haya usuario", () => {
    const { mockReplace } = setup({ user: null, loading: true, segments: [] });
    render(<RootLayout />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("no redirige mientras loading=true, aunque haya usuario en login", () => {
    const { mockReplace } = setup({ user: mockUser, loading: true, segments: ["login"] });
    render(<RootLayout />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// ── Sin usuario ────────────────────────────────────────────────────────────

describe("RootNavigator — sin usuario autenticado", () => {
  it("redirige a /login cuando no hay usuario y no está en login", async () => {
    const { mockReplace } = setup({ user: null, loading: false, segments: [] });
    render(<RootLayout />);
    await act(async () => {});
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("redirige a /login cuando segments es ['(tabs)']", async () => {
    const { mockReplace } = setup({ user: null, loading: false, segments: ["(tabs)"] });
    render(<RootLayout />);
    await act(async () => {});
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("NO redirige si ya está en la pantalla de login", async () => {
    const { mockReplace } = setup({ user: null, loading: false, segments: ["login"] });
    render(<RootLayout />);
    await act(async () => {});
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// ── Con usuario ────────────────────────────────────────────────────────────

describe("RootNavigator — con usuario autenticado", () => {
  it("redirige a /(tabs) si el usuario está en la pantalla de login", async () => {
    const { mockReplace } = setup({ user: mockUser, loading: false, segments: ["login"] });
    render(<RootLayout />);
    await act(async () => {});
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });

  it("NO redirige si el usuario ya está en los tabs", async () => {
    const { mockReplace } = setup({ user: mockUser, loading: false, segments: ["(tabs)"] });
    render(<RootLayout />);
    await act(async () => {});
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("NO redirige si el usuario está en cualquier otra ruta autenticada", async () => {
    const { mockReplace } = setup({ user: mockUser, loading: false, segments: ["(tabs)", "map"] });
    render(<RootLayout />);
    await act(async () => {});
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// ── Cambios de estado ──────────────────────────────────────────────────────

describe("RootNavigator — cambios de auth en runtime", () => {
  it("redirige a /login cuando el usuario hace logout (user pasa a null)", async () => {
    const mockReplace = jest.fn();
    (ExpoRouter.useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, navigate: jest.fn(), push: jest.fn(), back: jest.fn() });
    (ExpoRouter.useSegments as jest.Mock).mockReturnValue(["(tabs)"]);

    // Primer render: con usuario
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false });
    const { rerender } = render(<RootLayout />);
    expect(mockReplace).not.toHaveBeenCalled();

    // Segundo render: usuario hizo logout
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    await act(async () => { rerender(<RootLayout />); });
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("redirige a /(tabs) cuando el usuario hace login estando en /login", async () => {
    const mockReplace = jest.fn();
    (ExpoRouter.useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, navigate: jest.fn(), push: jest.fn(), back: jest.fn() });
    (ExpoRouter.useSegments as jest.Mock).mockReturnValue(["login"]);

    // Primer render: sin usuario, en login
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const { rerender } = render(<RootLayout />);
    expect(mockReplace).not.toHaveBeenCalled();

    // Segundo render: login exitoso
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false });
    await act(async () => { rerender(<RootLayout />); });
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });
});
