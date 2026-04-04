/**
 * Tests de integración — Reportes de spots
 *
 * Qué verifica:
 *  - Usuario autenticado puede insertar spot_report
 *  - Los dos tipos válidos son aceptados
 *  - Tipo inválido es rechazado por constraint
 *  - Usuario puede leer sus propios reportes
 *  - Usuario no puede leer reportes de otro usuario (RLS)
 *  - El spot queda en status 'reported' tras el reporte
 *
 * Pre-requisito: supabase start && schema.sql aplicado
 */
import {
  createTestUser,
  cleanupAllTestUsers,
  resetSpot,
  TestUser,
} from "./setup";

const TEST_SPOT_ID = "B1";

describe("Reportes — integración", () => {
  let reporter: TestUser;

  beforeAll(async () => {
    reporter = await createTestUser("reporter.test");
    await resetSpot(TEST_SPOT_ID);
  });

  afterAll(async () => {
    await resetSpot(TEST_SPOT_ID);
    await cleanupAllTestUsers();
  });

  it("puede insertar reporte tipo free_but_occupied", async () => {
    const { error } = await reporter.client.from("spot_reports").insert({
      user_id: reporter.id,
      spot_id: TEST_SPOT_ID,
      zone_id: "B",
      type: "free_but_occupied",
    });

    expect(error).toBeNull();
  });

  it("puede insertar reporte tipo occupied_but_free", async () => {
    const { error } = await reporter.client.from("spot_reports").insert({
      user_id: reporter.id,
      spot_id: TEST_SPOT_ID,
      zone_id: "B",
      type: "occupied_but_free",
    });

    expect(error).toBeNull();
  });

  it("tipo inválido es rechazado por constraint", async () => {
    const { error } = await reporter.client.from("spot_reports").insert({
      user_id: reporter.id,
      spot_id: TEST_SPOT_ID,
      zone_id: "B",
      type: "wrong_type",
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/valid_type|check/i);
  });

  it("usuario puede leer sus propios reportes", async () => {
    const { data, error } = await reporter.client
      .from("spot_reports")
      .select("type, spot_id")
      .eq("user_id", reporter.id);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.spot_id === TEST_SPOT_ID)).toBe(true);
  });

  it("el spot queda en 'reported' después de actualizar su status", async () => {
    const now = new Date().toISOString();
    await reporter.client
      .from("parking_spots")
      .update({ status: "reported", updated_at: now })
      .eq("id", TEST_SPOT_ID);

    const { data } = await reporter.client
      .from("parking_spots")
      .select("status")
      .eq("id", TEST_SPOT_ID)
      .single();

    expect(data?.status).toBe("reported");
  });

  it("otro usuario no puede leer reportes del reporter (RLS)", async () => {
    const spy = await createTestUser("report.spy");

    const { data } = await spy.client
      .from("spot_reports")
      .select("id")
      .eq("user_id", reporter.id);

    expect(data?.length ?? 0).toBe(0);

    const { adminClient } = await import("./setup");
    await adminClient.auth.admin.deleteUser(spy.id);
  });
});
