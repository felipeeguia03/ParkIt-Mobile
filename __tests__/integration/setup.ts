/**
 * Helpers para tests de integración contra Supabase local.
 * Requiere: supabase start
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const LOCAL_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.SUPABASE_TEST_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/** Cliente anónimo (sin sesión) */
export const anonClient = createClient(LOCAL_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Cliente con service role — bypasea RLS, solo para setup/teardown */
export const adminClient = createClient(LOCAL_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
}

let createdUserIds: string[] = [];

/**
 * Crea un usuario de test con email @ucc.edu.ar.
 * Lo registra para limpieza automática en cleanupAllTestUsers().
 */
export async function createTestUser(
  emailPrefix = "test.user",
  password = "TestPass123!"
): Promise<TestUser> {
  const email = `${emailPrefix}.${Date.now()}@ucc.edu.ar`;

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip confirmation email en local
  });

  if (error || !data.user) {
    throw new Error(`No se pudo crear usuario de test: ${error?.message}`);
  }

  createdUserIds.push(data.user.id);

  // Cliente autenticado como este usuario
  const userClient = createClient(LOCAL_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await userClient.auth.signInWithPassword({ email, password });

  return { id: data.user.id, email, password, client: userClient };
}

/**
 * Elimina todos los usuarios creados en esta suite.
 * Llamar en afterAll.
 */
export async function cleanupAllTestUsers(): Promise<void> {
  await Promise.all(
    createdUserIds.map((id) => adminClient.auth.admin.deleteUser(id))
  );
  createdUserIds = [];
}

/**
 * Resetea el status de un spot a 'available' y borra sus eventos/reportes de test.
 */
export async function resetSpot(spotId: string): Promise<void> {
  await adminClient
    .from("parking_spots")
    .update({ status: "available" })
    .eq("id", spotId);
}
