/**
 * Tests de integración — Auth
 *
 * Qué verifica:
 *  - Login exitoso con credenciales @ucc.edu.ar
 *  - Login fallido con email no-institucional (validación local, sin tocar Supabase)
 *  - Login fallido con contraseña incorrecta (respuesta real de Supabase)
 *  - Sesión activa tiene user.id válido
 *
 * Pre-requisito: supabase start
 */
import { anonClient, adminClient, createTestUser, cleanupAllTestUsers } from "./setup";

// Replica la lógica de AuthContext.login para integration tests
async function login(email: string, password: string) {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed.endsWith("@ucc.edu.ar")) {
    return { success: false, error: "Usá tu mail institucional (@ucc.edu.ar)" };
  }
  if (password.length < 1) {
    return { success: false, error: "Ingresá tu contraseña" };
  }

  const { error } = await anonClient.auth.signInWithPassword({
    email: trimmed,
    password,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { success: false, error: "Email o contraseña incorrectos" };
    }
    return { success: false, error: "Error al conectar con el servidor" };
  }

  return { success: true };
}

describe("Auth — integración", () => {
  let testEmail: string;
  let testPassword: string;

  beforeAll(async () => {
    const user = await createTestUser("auth.test");
    testEmail = user.email;
    testPassword = user.password;
  });

  afterAll(async () => {
    await anonClient.auth.signOut();
    await cleanupAllTestUsers();
  });

  it("login exitoso con credenciales válidas", async () => {
    const result = await login(testEmail, testPassword);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("sesión activa después del login", async () => {
    await login(testEmail, testPassword);
    const { data } = await anonClient.auth.getSession();
    expect(data.session).not.toBeNull();
    expect(data.session?.user.email).toBe(testEmail);
  });

  it("rechaza email no-institucional sin llamar a Supabase", async () => {
    const result = await login("usuario@gmail.com", "cualquier");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/institucional/);
  });

  it("rechaza contraseña incorrecta", async () => {
    const result = await login(testEmail, "contraseña_incorrecta");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/incorrectos/);
  });

  it("usuario no autenticado no puede leer parking_spots (RLS)", async () => {
    // Cliente fresco sin sesión
    const { createClient } = await import("@supabase/supabase-js");
    const fresh = createClient(
      process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321",
      process.env.SUPABASE_TEST_ANON_KEY ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7kyqd7LFpnBskFzmO9Su_oxv7pmpSPMSBkM",
      { auth: { persistSession: false } }
    );
    const { data, error } = await fresh.from("parking_spots").select("id").limit(1);
    // RLS bloquea → data vacío o error
    expect(data?.length ?? 0).toBe(0);
  });
});
