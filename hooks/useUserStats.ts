import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface UserStats {
  sessions: number;
  totalMinutes: number;
  favoriteZone: string | null;
  reports: number;
}

export function useUserStats(userId: string | undefined) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    Promise.all([
      // Sesiones totales (claims)
      supabase
        .from("parking_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("action", "claim"),

      // Tiempo total estacionado
      supabase
        .from("parking_events")
        .select("duration_minutes")
        .eq("user_id", userId)
        .eq("action", "release")
        .not("duration_minutes", "is", null),

      // Zona más usada
      supabase
        .from("parking_events")
        .select("zone_id")
        .eq("user_id", userId)
        .eq("action", "claim"),

      // Reportes enviados
      supabase
        .from("spot_reports")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]).then(([claims, durations, zones, reports]) => {
      const sessions = claims.count ?? 0;

      const totalMinutes = (durations.data ?? []).reduce(
        (sum, row) => sum + (row.duration_minutes ?? 0),
        0
      );

      // Zona favorita: la más repetida
      const zoneCounts: Record<string, number> = {};
      for (const row of zones.data ?? []) {
        zoneCounts[row.zone_id] = (zoneCounts[row.zone_id] ?? 0) + 1;
      }
      const favoriteZone =
        Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      setStats({
        sessions,
        totalMinutes,
        favoriteZone,
        reports: reports.count ?? 0,
      });
      setLoading(false);
    });
  }, [userId]);

  return { stats, loading };
}
