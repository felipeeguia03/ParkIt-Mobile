/**
 * k6 — Lectura concurrente de parking_spots
 *
 * Simula 50 usuarios consultando el estado de los spots simultáneamente.
 * Escenario típico: apertura del campus por la mañana.
 *
 * Correr:
 *   k6 run load-tests/concurrent-reads.js \
 *     -e SUPABASE_URL=https://tu-proyecto.supabase.co \
 *     -e SUPABASE_ANON_KEY=eyJ...
 *
 * Thresholds:
 *   - p95 < 800ms  (percentil 95 bajo 800ms)
 *   - error rate < 1%
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const spotReadDuration = new Trend("spot_read_duration");

export const options = {
  scenarios: {
    morning_rush: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },  // rampa de subida
        { duration: "1m",  target: 50 },  // carga sostenida
        { duration: "20s", target: 0 },   // rampa de bajada
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<800"],
    errors: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY = __ENV.SUPABASE_ANON_KEY;

const HEADERS = {
  "apikey": ANON_KEY,
  "Authorization": `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
};

export default function () {
  const start = Date.now();

  const res = http.get(
    `${BASE_URL}/rest/v1/parking_spots?select=id,status`,
    { headers: HEADERS }
  );

  spotReadDuration.add(Date.now() - start);

  const ok = check(res, {
    "status 200": (r) => r.status === 200,
    "tiene datos": (r) => {
      const body = r.json();
      return Array.isArray(body) && body.length > 0;
    },
  });

  errorRate.add(!ok);
  sleep(1);
}
