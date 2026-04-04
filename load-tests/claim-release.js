/**
 * k6 — Stress test de claim + release concurrente
 *
 * 20 usuarios distintos reclaman y liberan spots en paralelo.
 * Verifica que las escrituras concurrentes no generan errores de DB
 * ni condiciones de carrera visibles desde la API.
 *
 * Correr:
 *   k6 run load-tests/claim-release.js \
 *     -e SUPABASE_URL=https://tu-proyecto.supabase.co \
 *     -e SUPABASE_ANON_KEY=eyJ... \
 *     -e SUPABASE_SERVICE_KEY=eyJ...
 *
 * IMPORTANTE: usa el service key para escribir (bypasea RLS en load test).
 * En producción real los writes van autenticados vía JWT de usuario.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Counter } from "k6/metrics";

const claimErrors = new Rate("claim_errors");
const releaseErrors = new Rate("release_errors");
const concurrentConflicts = new Counter("concurrent_conflicts");

export const options = {
  scenarios: {
    concurrent_parkers: {
      executor: "constant-vus",
      vus: 20,
      duration: "1m",
    },
  },
  thresholds: {
    claim_errors:   ["rate<0.02"],   // menos del 2% de claims fallidos
    release_errors: ["rate<0.02"],
    http_req_duration: ["p(95)<1200"],
  },
};

const BASE_URL = __ENV.SUPABASE_URL;
const SERVICE_KEY = __ENV.SUPABASE_SERVICE_KEY;

const HEADERS = {
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=minimal",
};

// Cada VU usa un spot distinto para evitar colisiones artificiales.
// Spots B1–B20 (zona B tiene 50 spots en el seed).
export default function () {
  const spotId = `B${__VU}`;
  const zoneId = "B";
  const now = new Date().toISOString();

  // ── CLAIM ─────────────────────────────────────────────────────────
  const claimRes = http.patch(
    `${BASE_URL}/rest/v1/parking_spots?id=eq.${spotId}`,
    JSON.stringify({ status: "occupied", updated_at: now }),
    { headers: HEADERS }
  );

  const claimOk = check(claimRes, {
    "claim 200/204": (r) => r.status === 200 || r.status === 204,
  });
  claimErrors.add(!claimOk);

  if (claimRes.status === 409) concurrentConflicts.add(1);

  sleep(Math.random() * 2 + 1); // simula el tiempo estacionado (1-3s en el test)

  // ── RELEASE ───────────────────────────────────────────────────────
  const releaseRes = http.patch(
    `${BASE_URL}/rest/v1/parking_spots?id=eq.${spotId}`,
    JSON.stringify({ status: "available", updated_at: new Date().toISOString() }),
    { headers: HEADERS }
  );

  const releaseOk = check(releaseRes, {
    "release 200/204": (r) => r.status === 200 || r.status === 204,
  });
  releaseErrors.add(!releaseOk);

  sleep(0.5);
}
