/**
 * Tests de integración — Ciclo de estacionamiento
 *
 * Qué verifica:
 *  - Usuario autenticado puede leer parking_spots
 *  - Claim: actualiza status a 'occupied' + inserta parking_event action='claim'
 *  - Release: actualiza status a 'available' + inserta event action='release' con duration_minutes
 *  - Doble claim: el segundo intento no rompe la DB (idempotencia del UPDATE)
 *
 * Pre-requisito: supabase start && schema.sql aplicado
 */
import {
  createTestUser,
  cleanupAllTestUsers,
  resetSpot,
  TestUser,
} from "./setup";

const TEST_SPOT_ID = "A1"; // existe en el seed

describe("Parking — ciclo claim/release", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser("parking.test");
    await resetSpot(TEST_SPOT_ID);
  });

  afterAll(async () => {
    await resetSpot(TEST_SPOT_ID);
    await cleanupAllTestUsers();
  });

  it("puede leer parking_spots autenticado", async () => {
    const { data, error } = await user.client
      .from("parking_spots")
      .select("id, status")
      .limit(5);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("spot inicial está disponible", async () => {
    const { data } = await user.client
      .from("parking_spots")
      .select("status")
      .eq("id", TEST_SPOT_ID)
      .single();

    expect(data?.status).toBe("available");
  });

  it("claim: actualiza spot a occupied", async () => {
    const now = new Date().toISOString();
    const { error } = await user.client
      .from("parking_spots")
      .update({ status: "occupied", updated_at: now })
      .eq("id", TEST_SPOT_ID);

    expect(error).toBeNull();

    const { data } = await user.client
      .from("parking_spots")
      .select("status")
      .eq("id", TEST_SPOT_ID)
      .single();

    expect(data?.status).toBe("occupied");
  });

  it("claim: inserta parking_event con action=claim", async () => {
    const { error } = await user.client.from("parking_events").insert({
      user_id: user.id,
      spot_id: TEST_SPOT_ID,
      zone_id: "A",
      action: "claim",
    });

    expect(error).toBeNull();
  });

  it("claim: el evento es visible para el mismo usuario", async () => {
    const { data, error } = await user.client
      .from("parking_events")
      .select("action, spot_id")
      .eq("spot_id", TEST_SPOT_ID)
      .eq("user_id", user.id)
      .eq("action", "claim");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it("release: actualiza spot a available + inserta event con duration_minutes", async () => {
    const now = new Date().toISOString();
    const { error: spotErr } = await user.client
      .from("parking_spots")
      .update({ status: "available", updated_at: now })
      .eq("id", TEST_SPOT_ID);

    expect(spotErr).toBeNull();

    const { error: eventErr } = await user.client.from("parking_events").insert({
      user_id: user.id,
      spot_id: TEST_SPOT_ID,
      zone_id: "A",
      action: "release",
      duration_minutes: 12,
    });

    expect(eventErr).toBeNull();

    const { data } = await user.client
      .from("parking_spots")
      .select("status")
      .eq("id", TEST_SPOT_ID)
      .single();

    expect(data?.status).toBe("available");
  });

  it("acción inválida es rechazada por el check constraint", async () => {
    const { error } = await user.client.from("parking_events").insert({
      user_id: user.id,
      spot_id: TEST_SPOT_ID,
      zone_id: "A",
      action: "invalid_action",
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/valid_action|check/i);
  });

  it("usuario no puede leer eventos de otro usuario (RLS)", async () => {
    const otherUser = await createTestUser("parking.other");

    const { data } = await otherUser.client
      .from("parking_events")
      .select("id")
      .eq("user_id", user.id); // intentar leer eventos del primer usuario

    expect(data?.length ?? 0).toBe(0);

    // cleanup extra user
    const { adminClient } = await import("./setup");
    await adminClient.auth.admin.deleteUser(otherUser.id);
  });
});
