import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Alert, InteractionManager } from "react-native";
import {
  ParkingZone,
  ParkingSpot,
  SpotStatus,
  initialParkingData,
  getTotalStats,
  getSpotCoordinate,
} from "@/lib/parking-data";
import { applyStatusMap, updateOneSpot } from "@/lib/parking-utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface UserParking {
  zone: ParkingZone;
  spot: ParkingSpot;
  parkedAt: Date;
}

type SpotRow = { id: string; status: SpotStatus };

// ──────────────────────────────────────────────────────────────────────────

export function useParkingState() {
  const { user } = useAuth();

  const [zones, setZones] = useState<ParkingZone[]>(() => initialParkingData);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<ParkingZone | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [userParking, setUserParking] = useState<UserParking | null>(null);
  const [spotIndex, setSpotIndex] = useState(0);
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // ── Refs para estado mutable (Fase 2a) ───────────────────────────────────
  // Permiten que los handlers tengan deps vacíos ([]) sin stale closures.
  // Patrón: el ref siempre tiene el valor fresco del último render.
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const userParkingRef = useRef<UserParking | null>(null);
  useEffect(() => { userParkingRef.current = userParking; }, [userParking]);

  const selectedZoneRef = useRef<ParkingZone | null>(null);
  useEffect(() => { selectedZoneRef.current = selectedZone; }, [selectedZone]);

  const selectedSpotRef = useRef<ParkingSpot | null>(null);
  useEffect(() => { selectedSpotRef.current = selectedSpot; }, [selectedSpot]);

  const currentAvailableSpotRef = useRef<{ zone: ParkingZone; spot: ParkingSpot } | null>(null);

  // ── Deduplicación optimistic + Realtime (Fase 2b) ────────────────────────
  // Cuando hacemos un optimistic update, guardamos el spotId y el status esperado.
  // Si Realtime llega con el mismo status → es el eco de nuestro propio update → ignorar.
  // Si Realtime llega con status distinto → el servidor corrigió → aplicar.
  const pendingOptimistic = useRef<Map<string, SpotStatus>>(new Map());

  // ── Carga inicial desde Supabase ─────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("parking_spots")
      .select("id, status")
      .then(({ data, error }) => {
        if (data) {
          const map = new Map(
            (data as SpotRow[]).map((r) => [r.id, r.status])
          );
          setZones((prev) => applyStatusMap(prev, map));
        }
        if (error) console.error("[ParkIt] Error cargando spots:", error.message);
        setLoading(false);
      });
  }, []);

  // ── Realtime: escucha cambios de cualquier usuario ───────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("parking_spots_live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "parking_spots" },
        (payload) => {
          const { id, status } = payload.new as SpotRow;

          // Fase 2b: verificar si es eco de nuestro propio optimistic update.
          const expected = pendingOptimistic.current.get(id);
          if (expected !== undefined) {
            pendingOptimistic.current.delete(id);
            if (expected === status) return; // mismo status → ignorar
            // status distinto → el servidor corrigió → aplicar igual (cae al setZones de abajo)
          }

          // Fix 3: diferir hasta que React Native termine animaciones activas.
          InteractionManager.runAfterInteractions(() => {
            setZones((prev) => updateOneSpot(prev, id, status));
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Derivados ────────────────────────────────────────────────────────────

  const totalStats = useMemo(() => getTotalStats(zones), [zones]);

  const availableSpots = useMemo(() => {
    const spots: { zone: ParkingZone; spot: ParkingSpot }[] = [];
    const filtered = zoneFilter ? zones.filter((z) => z.id === zoneFilter) : zones;
    filtered.forEach((zone) =>
      zone.spots.forEach((spot) => {
        if (spot.status === "available") spots.push({ zone, spot });
      })
    );
    return spots;
  }, [zones, zoneFilter]);

  const currentAvailableSpot = availableSpots[spotIndex] ?? null;
  // Mantener ref sincronizado para handleQuickSelect
  currentAvailableSpotRef.current = currentAvailableSpot;

  // ── Navegación por spots ─────────────────────────────────────────────────

  const handleNextSpot = useCallback(() => {
    setSpotIndex((prev) => {
      const len = currentAvailableSpotRef.current !== null
        ? (availableSpots?.length ?? 0)
        : 0;
      return len > 0 ? (prev + 1) % len : prev;
    });
  }, [availableSpots.length]);

  const handlePrevSpot = useCallback(() => {
    setSpotIndex((prev) => {
      const len = availableSpots.length;
      return len > 0 ? (prev - 1 + len) % len : prev;
    });
  }, [availableSpots.length]);

  const handleZoneFilterChange = useCallback((zoneId: string | null) => {
    setZoneFilter(zoneId);
    setSpotIndex(0);
  }, []);

  // ── Selección de spots ───────────────────────────────────────────────────

  // Fase 2a: deps vacíos. Lee userParking y currentAvailableSpot vía refs.
  const handleQuickSelect = useCallback(() => {
    if (userParkingRef.current) {
      const p = userParkingRef.current;
      Alert.alert(
        "Ya tenés un lugar activo",
        `Estás en Zona ${p.zone.id} · lugar ${p.spot.number}. Liberalo antes de elegir otro.`,
        [{ text: "Entendido" }]
      );
      return;
    }
    const cur = currentAvailableSpotRef.current;
    if (cur) {
      setSelectedZone(cur.zone);
      setSelectedSpot(cur.spot);
      setConfirmModalOpen(true);
    }
  }, []);

  // Fase 2a: deps vacíos. Lee userParking vía ref; state setters son estables.
  const handleSpotSelect = useCallback((zone: ParkingZone, spot: ParkingSpot) => {
    if (userParkingRef.current) {
      const p = userParkingRef.current;
      Alert.alert(
        "Ya tenés un lugar activo",
        `Estás en Zona ${p.zone.id} · lugar ${p.spot.number}. Liberalo antes de elegir otro.`,
        [{ text: "Entendido" }]
      );
      return;
    }
    if (spot.status === "available") {
      setSelectedZone(zone);
      setSelectedSpot(spot);
      setConfirmModalOpen(true);
    }
  }, []);

  const handleReportSpot = useCallback((zone: ParkingZone, spot: ParkingSpot) => {
    if (spot.status === "occupied") {
      setSelectedZone(zone);
      setSelectedSpot(spot);
      setReportModalOpen(true);
    }
  }, []);

  // ── Estacionar ───────────────────────────────────────────────────────────

  // user leído vía ref → deps vacíos, referencia permanentemente estable.
  const handleConfirmParking = useCallback(async () => {
    const zone = selectedZoneRef.current;
    const spot = selectedSpotRef.current;
    const user = userRef.current;
    if (!zone || !spot || !user) return;

    pendingOptimistic.current.set(spot.id, "occupied");
    setZones((prev) => updateOneSpot(prev, spot.id, "occupied"));
    setUserParking({
      zone,
      spot: { ...spot, status: "occupied" },
      parkedAt: new Date(),
    });
    setConfirmModalOpen(false);

    const now = new Date().toISOString();
    const [{ error: spotErr }, { error: eventErr }] = await Promise.all([
      supabase
        .from("parking_spots")
        .update({ status: "occupied", updated_at: now })
        .eq("id", spot.id),
      supabase.from("parking_events").insert({
        user_id: user.id,
        spot_id: spot.id,
        zone_id: zone.id,
        action: "claim",
      }),
    ]);

    if (spotErr) console.error("[ParkIt] claim spot:", spotErr.message);
    if (eventErr) console.error("[ParkIt] claim event:", eventErr.message);
  }, []);

  // ── Liberar ──────────────────────────────────────────────────────────────

  const handleLeaveParking = useCallback(async () => {
    const parking = userParkingRef.current;
    const user = userRef.current;
    if (!parking || !user) return;

    const duration = Math.round(
      (Date.now() - parking.parkedAt.getTime()) / 60000
    );

    pendingOptimistic.current.set(parking.spot.id, "available");
    setZones((prev) => updateOneSpot(prev, parking.spot.id, "available"));
    setUserParking(null);

    const now = new Date().toISOString();
    const [{ error: spotErr }, { error: eventErr }] = await Promise.all([
      supabase
        .from("parking_spots")
        .update({ status: "available", updated_at: now })
        .eq("id", parking.spot.id),
      supabase.from("parking_events").insert({
        user_id: user.id,
        spot_id: parking.spot.id,
        zone_id: parking.zone.id,
        action: "release",
        duration_minutes: duration,
      }),
    ]);

    if (spotErr) console.error("[ParkIt] release spot:", spotErr.message);
    if (eventErr) console.error("[ParkIt] release event:", eventErr.message);
  }, []);

  // ── Reporte rápido (modal — siempre "libre marcado como ocupado") ─────────

  const handleReportConfirm = useCallback(async () => {
    const zone = selectedZoneRef.current;
    const spot = selectedSpotRef.current;
    const user = userRef.current;
    if (!zone || !spot || !user) return;

    pendingOptimistic.current.set(spot.id, "reported");
    setZones((prev) => updateOneSpot(prev, spot.id, "reported"));
    setReportModalOpen(false);

    const now = new Date().toISOString();
    const [{ error: spotErr }, { error: repErr }] = await Promise.all([
      supabase
        .from("parking_spots")
        .update({ status: "reported", updated_at: now })
        .eq("id", spot.id),
      supabase.from("spot_reports").insert({
        user_id: user.id,
        spot_id: spot.id,
        zone_id: zone.id,
        type: "free_but_occupied",
      }),
    ]);

    if (spotErr) console.error("[ParkIt] report spot:", spotErr.message);
    if (repErr) console.error("[ParkIt] spot_report:", repErr.message);
  }, []);

  // ── Reporte desde pantalla de reportes (con tipo y nuevo estado) ──────────

  const handleReportSpotChange = useCallback(async (
    zone: ParkingZone,
    spot: ParkingSpot,
    reportType: "occupied_but_free" | "free_but_occupied",
    newStatus: SpotStatus
  ) => {
    const user = userRef.current;
    if (!user) return;

    pendingOptimistic.current.set(spot.id, newStatus);
    setZones((prev) => updateOneSpot(prev, spot.id, newStatus));

    const now = new Date().toISOString();
    const [{ error: spotErr }, { error: repErr }] = await Promise.all([
      supabase
        .from("parking_spots")
        .update({ status: newStatus, updated_at: now })
        .eq("id", spot.id),
      supabase.from("spot_reports").insert({
        user_id: user.id,
        spot_id: spot.id,
        zone_id: zone.id,
        type: reportType,
      }),
    ]);

    if (spotErr) console.error("[ParkIt] report change spot:", spotErr.message);
    if (repErr) console.error("[ParkIt] report change event:", repErr.message);
  }, []);

  return {
    zones,
    setZones,
    loading,
    totalStats,
    availableSpots,
    currentAvailableSpot,
    spotIndex,
    zoneFilter,
    userParking,
    selectedZone,
    selectedSpot,
    confirmModalOpen,
    reportModalOpen,
    setConfirmModalOpen,
    setReportModalOpen,
    handleNextSpot,
    handlePrevSpot,
    handleZoneFilterChange,
    handleQuickSelect,
    handleSpotSelect,
    handleReportSpot,
    handleConfirmParking,
    handleReportConfirm,
    handleReportSpotChange,
    handleLeaveParking,
  };
}
