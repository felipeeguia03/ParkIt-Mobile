import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// ── Mock de Supabase ───────────────────────────────────────────────────────
// jest.mock es hoisted, así que definimos los fns dentro del factory y los
// recuperamos con require() después de la declaración.

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

// Referencia tipada a los mocks para poder configurarlos en cada test
import { supabase } from "@/lib/supabase";
const mockGetSession        = supabase.auth.getSession        as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;
const mockSignIn            = supabase.auth.signInWithPassword as jest.Mock;
const mockSignOut           = supabase.auth.signOut           as jest.Mock;

// ── Helpers ────────────────────────────────────────────────────────────────

const noSubscription = {
  data: { subscription: { unsubscribe: jest.fn() } },
};

function makeSupabaseUser(overrides: Record<string, any> = {}) {
  return {
    id: "user-uuid-123",
    email: "felipe.eguia@ucc.edu.ar",
    user_metadata: {},
    ...overrides,
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  // Por defecto: sesión vacía, sin cambios de auth
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockOnAuthStateChange.mockReturnValue(noSubscription);
});

// ── useAuth fuera del provider ─────────────────────────────────────────────

describe("useAuth — fuera del provider", () => {
  it("lanza error si se usa fuera de AuthProvider", () => {
    // Suprimir el error de consola que React imprime en este caso
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used inside AuthProvider"
    );
    spy.mockRestore();
  });
});

// ── Estado inicial ─────────────────────────────────────────────────────────

describe("AuthProvider — estado inicial", () => {
  it("empieza con loading=true mientras resuelve getSession", async () => {
    // Nunca resuelve → loading permanece true
    mockGetSession.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it("loading=false y user=null cuando no hay sesión", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("carga el user cuando hay sesión persistida", async () => {
    const supabaseUser = makeSupabaseUser();
    mockGetSession.mockResolvedValue({
      data: { session: { user: supabaseUser } },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.user).not.toBeNull();
    expect(result.current.user?.id).toBe("user-uuid-123");
    expect(result.current.user?.email).toBe("felipe.eguia@ucc.edu.ar");
  });
});

// ── mapUser ────────────────────────────────────────────────────────────────

describe("AuthProvider — mapUser", () => {
  async function getUserFrom(overrides: Record<string, any> = {}) {
    mockGetSession.mockResolvedValue({
      data: { session: { user: makeSupabaseUser(overrides) } },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    return result.current.user!;
  }

  it("deriva el nombre del email si no hay metadata", async () => {
    const user = await getUserFrom({ email: "juan.perez@ucc.edu.ar", user_metadata: {} });
    expect(user.name).toBe("Juan Perez");
  });

  it("usa metadata.name si está disponible", async () => {
    const user = await getUserFrom({
      user_metadata: { name: "Juan Pérez García" },
    });
    expect(user.name).toBe("Juan Pérez García");
  });

  it("rol por defecto es 'user'", async () => {
    const user = await getUserFrom();
    expect(user.role).toBe("user");
  });

  it("usa metadata.role si está disponible", async () => {
    const user = await getUserFrom({ user_metadata: { role: "admin" } });
    expect(user.role).toBe("admin");
  });
});

// ── login ──────────────────────────────────────────────────────────────────

describe("AuthProvider — login", () => {
  async function getLogin() {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    return result.current.login;
  }

  it("rechaza email sin dominio @ucc.edu.ar (no llama a Supabase)", async () => {
    const login = await getLogin();
    let res: any;
    await act(async () => { res = await login("juan@gmail.com", "pass123"); });
    expect(res).toEqual({ success: false, error: "Usá tu mail institucional (@ucc.edu.ar)" });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("rechaza contraseña vacía (no llama a Supabase)", async () => {
    const login = await getLogin();
    let res: any;
    await act(async () => { res = await login("juan@ucc.edu.ar", ""); });
    expect(res).toEqual({ success: false, error: "Ingresá tu contraseña" });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("traduce 'Invalid login credentials' al español", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const login = await getLogin();
    let res: any;
    await act(async () => { res = await login("juan@ucc.edu.ar", "wrongpass"); });
    expect(res).toEqual({ success: false, error: "Email o contraseña incorrectos" });
  });

  it("devuelve error genérico para otros fallos de red", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Network timeout" } });
    const login = await getLogin();
    let res: any;
    await act(async () => { res = await login("juan@ucc.edu.ar", "pass123"); });
    expect(res).toEqual({ success: false, error: "Error al conectar con el servidor" });
  });

  it("devuelve success:true cuando Supabase acepta las credenciales", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const login = await getLogin();
    let res: any;
    await act(async () => { res = await login("juan@ucc.edu.ar", "correcto"); });
    expect(res).toEqual({ success: true });
  });

  it("normaliza el email (trim + lowercase) antes de enviarlo a Supabase", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const login = await getLogin();
    await act(async () => { await login("  JUAN@UCC.EDU.AR  ", "pass"); });
    expect(mockSignIn).toHaveBeenCalledWith({
      email: "juan@ucc.edu.ar",
      password: "pass",
    });
  });
});

// ── logout ─────────────────────────────────────────────────────────────────

describe("AuthProvider — logout", () => {
  it("llama a supabase.auth.signOut", async () => {
    mockSignOut.mockResolvedValue({});
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    await act(async () => { await result.current.logout(); });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

// ── onAuthStateChange ──────────────────────────────────────────────────────

describe("AuthProvider — onAuthStateChange", () => {
  it("actualiza el user cuando el listener dispara con nueva sesión", async () => {
    let fireChange: ((event: string, session: any) => void) | undefined;
    mockOnAuthStateChange.mockImplementation((cb: any) => {
      fireChange = cb;
      return noSubscription;
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    const newUser = makeSupabaseUser({ email: "otro@ucc.edu.ar" });
    await act(async () => {
      fireChange?.("SIGNED_IN", { user: newUser });
    });

    expect(result.current.user?.email).toBe("otro@ucc.edu.ar");
  });

  it("limpia el user cuando el listener dispara con session=null (logout externo)", async () => {
    let fireChange: ((event: string, session: any) => void) | undefined;
    mockOnAuthStateChange.mockImplementation((cb: any) => {
      fireChange = cb;
      return noSubscription;
    });
    // Empieza con sesión activa
    mockGetSession.mockResolvedValue({
      data: { session: { user: makeSupabaseUser() } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.user).not.toBeNull();

    await act(async () => { fireChange?.("SIGNED_OUT", null); });
    expect(result.current.user).toBeNull();
  });
});
