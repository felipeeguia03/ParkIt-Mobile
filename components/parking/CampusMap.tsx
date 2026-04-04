import { useRef, useState, useCallback, useEffect, useMemo, memo, Fragment } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, InteractionManager,
} from "react-native";
import MapView, { Polygon, Marker, Polyline, Region } from "react-native-maps";
import { LatLng } from "@/lib/parking-data";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Navigation, ArrowLeft } from "lucide-react-native";
import {
  ParkingZone, ParkingSpot, getZoneStats, getSpotPolygon, getSpotCoordinate,
} from "@/lib/parking-data";
import {
  zoneLayerComparator, spotsLayerComparator, spotPolygonComparator,
} from "@/lib/memo-comparators";

const CAMPUS_CENTER = { latitude: -31.48743, longitude: -64.24213 };
const INITIAL_REGION: Region = {
  ...CAMPUS_CENTER,
  latitudeDelta: 0.005,
  longitudeDelta: 0.009,
};

// Los números de los spots son legibles recién cuando el delta es menor a este umbral
const NUMBERS_ZOOM_THRESHOLD = 0.0018;

const ENTRANCE: LatLng = { latitude: -31.486208, longitude: -64.246113 };

const TRUNK: LatLng[] = [
  { latitude: -31.486208, longitude: -64.246113 },
  { latitude: -31.486252, longitude: -64.243648 },
  { latitude: -31.486502, longitude: -64.243627 },
  { latitude: -31.486779, longitude: -64.243637 },
  { latitude: -31.486925, longitude: -64.243442 },
  { latitude: -31.487256, longitude: -64.243431 },
  { latitude: -31.487480, longitude: -64.243426 },
  { latitude: -31.487901, longitude: -64.243414 },
  { latitude: -31.487947, longitude: -64.242771 },
  { latitude: -31.487949, longitude: -64.242184 },
  { latitude: -31.487953, longitude: -64.240722 },
  { latitude: -31.487223, longitude: -64.240744 },
  { latitude: -31.486569, longitude: -64.240760 },
];

const ZONE_ROUTES: Record<string, LatLng[]> = {
  A: [...TRUNK, { latitude: -31.485874, longitude: -64.240751 }],
  B: [...TRUNK],
  C: [...TRUNK.slice(0, 11), { latitude: -31.487814, longitude: -64.240422 }],
  D: [...TRUNK.slice(0, 10), { latitude: -31.487787, longitude: -64.241338 }],
  E: [...TRUNK.slice(0, 9),  { latitude: -31.487763, longitude: -64.242987 }],
  F: [...TRUNK.slice(0, 9),  { latitude: -31.487763, longitude: -64.242987 }, { latitude: -31.488149, longitude: -64.242588 }],
  G: [...TRUNK.slice(0, 11), { latitude: -31.488176, longitude: -64.240534 }],
};

// ─────────────────────────────────────────────
// ZoneLayer
// ─────────────────────────────────────────────
function ZoneLayerFn({
  zones,
  focusedZoneId,
  onZonePress,
}: {
  zones: ParkingZone[];
  focusedZoneId: string | null;
  onZonePress: (zone: ParkingZone) => void;
}) {
  // Fix 2: precalcular stats una sola vez por render en vez de llamar
  // getZoneStats(zone) dos veces por zona (una en polygons, otra en markers).
  const statsMap = useMemo(
    () => new Map(zones.map((z) => [z.id, getZoneStats(z)])),
    [zones]
  );

  return (
    <>
      {zones.map((zone) => {
        const stats = statsMap.get(zone.id)!;
        const pct = stats.available / stats.total;
        const isFocused = focusedZoneId === zone.id;
        const fill =
          pct > 0.4 ? "rgba(16,185,129,0.35)"
          : pct > 0.15 ? "rgba(245,158,11,0.35)"
          : "rgba(239,68,68,0.35)";
        const stroke = pct > 0.4 ? "#10b981" : pct > 0.15 ? "#f59e0b" : "#ef4444";
        return (
          <Polygon
            key={zone.id}
            coordinates={zone.polygon}
            fillColor={isFocused ? "rgba(79,70,229,0.15)" : fill}
            strokeColor={isFocused ? "#4f46e5" : stroke}
            strokeWidth={isFocused ? 3 : 2}
            tappable
            onPress={() => onZonePress(zone)}
          />
        );
      })}
      {zones.map((zone) => {
        const stats = statsMap.get(zone.id)!;
        const pct = stats.available / stats.total;
        const color = pct > 0.4 ? "#10b981" : pct > 0.15 ? "#f59e0b" : "#ef4444";
        return (
          <Marker
            key={`lbl-${zone.id}`}
            coordinate={zone.center}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => onZonePress(zone)}
          >
            <View style={[styles.zoneLabel, { borderColor: color }]}>
              <Text style={[styles.zoneLabelId, { color }]}>{zone.id}</Text>
              <Text style={styles.zoneLabelCount}>
                {stats.available}/{stats.total}
              </Text>
            </View>
          </Marker>
        );
      })}
    </>
  );
}

// Fase 3a: ZoneLayer solo re-renderiza cuando:
//   - cambia la zona enfocada (color indigo)
//   - cambia el conteo de spots disponibles en alguna zona (puede cruzar umbral de color)
// Un spot que pasa de "occupied" → "reported" no cambia el conteo de disponibles
// → ZoneLayer no re-renderiza → 0 operaciones nativas en ZoneLayer.
const ZoneLayer = memo(ZoneLayerFn, zoneLayerComparator);

// ─────────────────────────────────────────────
// SpotPolygon — Fase 1: spot individual memoizado
//
// Cada spot es su propio componente con memo. Cuando Realtime actualiza
// el status de 1 spot, solo ese SpotPolygon re-renderiza su Polygon nativo.
// Los otros N-1 spots pasan el memo check y no tocan el hilo de UI.
//
// Resultado: 1 operación nativa en vez de N cuando cambia 1 spot.
// ─────────────────────────────────────────────
const SpotPolygon = memo(
  function SpotPolygon({
    spot,
    zone,
    idx,
    showNumbers,
    onPress,
  }: {
    spot: ParkingSpot;
    zone: ParkingZone;
    idx: number;
    showNumbers: boolean;
    onPress: (spot: ParkingSpot) => void;
  }) {
    // Geometría estática: origin y angle del zone no cambian en runtime.
    // deps vacíos: se calcula una vez al montar y nunca más.
    const coords = useMemo(() => getSpotPolygon(zone, idx), []);
    const center = useMemo(() => getSpotCoordinate(zone, idx), []);

    const fill =
      spot.status === "available" ? "rgba(16,185,129,0.75)"
      : spot.status === "occupied" ? "rgba(239,68,68,0.72)"
      : "rgba(245,158,11,0.72)";
    const stroke =
      spot.status === "available" ? "#059669"
      : spot.status === "occupied" ? "#dc2626"
      : "#d97706";

    return (
      <Fragment>
        <Polygon
          coordinates={coords}
          fillColor={fill}
          strokeColor={stroke}
          strokeWidth={1.5}
          tappable
          onPress={() => onPress(spot)}
        />
        {showNumbers && (
          <Marker
            coordinate={center}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => onPress(spot)}
          >
            <Text style={styles.spotNumber}>{spot.number}</Text>
          </Marker>
        )}
      </Fragment>
    );
  },
  spotPolygonComparator
);

// ─────────────────────────────────────────────
// SpotsLayer
// showNumbers: solo cuando el mapa está suficientemente zoomeado
// renderCount: cuántos spots mostrar (batching incremental para no bloquear el hilo JS)
// ─────────────────────────────────────────────
const SpotsLayer = memo(
function SpotsLayer({
  zone,
  showNumbers,
  onSpotPress,
  renderCount,
}: {
  zone: ParkingZone;
  showNumbers: boolean;
  onSpotPress: (spot: ParkingSpot) => void;
  renderCount: number;
}) {
  return (
    <>
      {zone.spots.slice(0, renderCount).map((spot, idx) => (
        <SpotPolygon
          key={spot.id}
          spot={spot}
          zone={zone}
          idx={idx}
          showNumbers={showNumbers}
          onPress={onSpotPress}
        />
      ))}
    </>
  );
},
  spotsLayerComparator
);

// ─────────────────────────────────────────────
// RouteLayer
// ─────────────────────────────────────────────
const RouteLayer = memo(function RouteLayer({
  coords,
  destZone,
}: {
  coords: LatLng[];
  destZone: ParkingZone | null;
}) {
  return (
    <>
      <Polyline
        coordinates={coords}
        strokeColor="#4f46e5"
        strokeWidth={4}
        lineCap="round"
        lineJoin="round"
      />
      <Marker coordinate={ENTRANCE} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
        <View style={styles.entranceMarker}>
          <Text style={styles.entranceMarkerText}>Entrada</Text>
        </View>
      </Marker>
      {destZone && (
        <Marker coordinate={destZone.center} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.destMarker}>
            <Text style={styles.destMarkerText}>{destZone.id}</Text>
          </View>
        </Marker>
      )}
    </>
  );
});

// ─────────────────────────────────────────────
// CampusMap
// ─────────────────────────────────────────────
interface CampusMapProps {
  zones: ParkingZone[];
  onSpotSelect: (zone: ParkingZone, spot: ParkingSpot) => void;
  onReportSpot: (zone: ParkingZone, spot: ParkingSpot) => void;
  focusZoneId?: string;      // zona a enfocar al entrar al mapa
  focusTimestamp?: string;   // timestamp único por cada pedido de foco
}

export function CampusMap({ zones, onSpotSelect, onReportSpot, focusZoneId, focusTimestamp }: CampusMapProps) {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  // Solo guardamos el ID — la zona fresca siempre se deriva del prop `zones`
  // Esto garantiza que los cambios de Supabase/Realtime se reflejan en el mapa
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);

  // Fix 4: useMemo garantiza que focusedZone solo cambia de referencia cuando
  // zones o focusedZoneId realmente cambian — no en cada render del padre.
  const focusedZone = useMemo(
    () => focusedZoneId ? (zones.find((z) => z.id === focusedZoneId) ?? null) : null,
    [zones, focusedZoneId]
  );

  const [routeCoords, setRouteCoords] = useState<LatLng[] | null>(null);
  const [showNumbers, setShowNumbers] = useState(false);

  // Renderizado incremental de spots: ~16 por frame para no bloquear el hilo JS
  const [spotRenderCount, setSpotRenderCount] = useState(0);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (!focusedZone) { setSpotRenderCount(0); return; }

    const total = focusedZone.spots.length;
    const BATCH = 16;
    let current = 0;

    const tick = () => {
      current = Math.min(current + BATCH, total);
      setSpotRenderCount(current);
      if (current < total) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [focusedZoneId]);

  // "Ver en mapa": espera a que todas las animaciones de navegación terminen
  // antes de tocar el mapa nativo. InteractionManager reemplaza los timeouts
  // mágicos — dispara automáticamente cuando React Native termina su trabajo.
  const processedTimestamp = useRef<string | null>(null);

  useEffect(() => {
    if (!focusZoneId || !focusTimestamp) return;
    if (focusTimestamp === processedTimestamp.current) return;
    processedTimestamp.current = focusTimestamp;

    const zone = zones.find((z) => z.id === focusZoneId);
    if (!zone) return;

    const task = InteractionManager.runAfterInteractions(() => {
      setRouteCoords(ZONE_ROUTES[focusZoneId] ?? null);
      mapRef.current?.animateToRegion(
        {
          latitude: zone.center.latitude,
          longitude: zone.center.longitude,
          latitudeDelta: 0.0012,
          longitudeDelta: 0.0012,
        },
        700
      );
      // Resetear spotRenderCount en el mismo batch que setFocusedZoneId.
      // Sin esto, el primer render de la nueva zona hereda el count de la
      // zona anterior y renderiza N spots de golpe en vez de hacerlo incremental.
      setSpotRenderCount(0);
      setFocusedZoneId(focusZoneId);
    });

    return () => task.cancel();
  }, [focusZoneId, focusTimestamp]);

  const handleZonePress = useCallback((zone: ParkingZone) => {
    setSpotRenderCount(0);
    setFocusedZoneId(zone.id);
    setRouteCoords(null);
    mapRef.current?.animateToRegion(
      {
        latitude: zone.center.latitude,
        longitude: zone.center.longitude,
        latitudeDelta: 0.0012,
        longitudeDelta: 0.0012,
      },
      600
    );
  }, []);

  // Refs para leer los callbacks más recientes sin incluirlos en deps.
  // Esto garantiza que handleSpotPress NUNCA cambie de referencia, rompiendo
  // la cadena: zones → context re-render → onSpotSelect nueva ref → handleSpotPress
  // nueva ref → SpotsLayer.memo falla → todos los spots re-renderizan de golpe.
  const focusedZoneRef = useRef(focusedZone);
  useEffect(() => { focusedZoneRef.current = focusedZone; }, [focusedZone]);
  const onSpotSelectRef = useRef(onSpotSelect);
  useEffect(() => { onSpotSelectRef.current = onSpotSelect; }, [onSpotSelect]);
  const onReportSpotRef = useRef(onReportSpot);
  useEffect(() => { onReportSpotRef.current = onReportSpot; }, [onReportSpot]);

  // Deps vacíos: handleSpotPress es la misma referencia para siempre.
  // Lee los valores actuales a través de los refs en el momento del press.
  const handleSpotPress = useCallback((spot: ParkingSpot) => {
    const zone = focusedZoneRef.current;
    if (!zone) return;
    if (spot.status === "available") onSpotSelectRef.current(zone, spot);
    else if (spot.status === "occupied") onReportSpotRef.current(zone, spot);
  }, []);

  const handleRecenter = () => {
    setSpotRenderCount(0);
    setFocusedZoneId(null);
    setRouteCoords(null);
    setShowNumbers(false);
    mapRef.current?.animateToRegion(INITIAL_REGION, 700);
  };

  // Muestra números de spots solo cuando el zoom es suficiente
  const handleRegionChangeComplete = useCallback((region: Region) => {
    setShowNumbers(region.latitudeDelta < NUMBERS_ZOOM_THRESHOLD);
  }, []);

  const focusedStats = focusedZone ? getZoneStats(focusedZone) : null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={mapRef}
        mapType="hybrid"
        style={StyleSheet.absoluteFill}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        zoomEnabled
        scrollEnabled
        rotateEnabled
        pitchEnabled
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        <ZoneLayer
          zones={zones}
          focusedZoneId={focusedZoneId}
          onZonePress={handleZonePress}
        />

        {focusedZone && (
          <SpotsLayer
            zone={focusedZone}
            showNumbers={showNumbers}
            onSpotPress={handleSpotPress}
            renderCount={spotRenderCount}
          />
        )}

        {routeCoords && (
          <RouteLayer coords={routeCoords} destZone={focusedZone} />
        )}
      </MapView>

      {/* HUD zona enfocada */}
      {focusedZone && (
        <View style={[styles.zoneHud, { top: insets.top + 12 }]}>
          <TouchableOpacity style={styles.hudBackBtn} onPress={handleRecenter} activeOpacity={0.8}>
            <ArrowLeft size={16} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.hudZoneName}>{focusedZone.name}</Text>
            {focusedStats && (
              <Text style={styles.hudZoneSub}>
                {focusedStats.available} disponibles · {focusedStats.total} totales
              </Text>
            )}
          </View>
          <View style={styles.hudLegend}>
            <LegendDot color="#10b981" label="Libre" />
            <LegendDot color="#ef4444" label="Ocupado" />
          </View>
        </View>
      )}

      {/* HUD ruta activa */}
      {routeCoords && !focusedZone && (
        <View style={[styles.routeHud, { top: insets.top + 12 }]}>
          <Text style={styles.routeHudText}>
            Ruta al campus · Tocá tu zona para ver los lugares
          </Text>
        </View>
      )}

      {/* Botón recentrar */}
      <TouchableOpacity
        style={[styles.recenterBtn, { bottom: insets.bottom + 72 }]}
        onPress={handleRecenter}
        activeOpacity={0.85}
      >
        <Navigation size={20} color="#4f46e5" />
      </TouchableOpacity>

      {/* Leyenda global */}
      {!focusedZone && (
        <View style={[styles.legend, { bottom: insets.bottom + 72 }]}>
          <LegendDot color="#10b981" label="Alta" />
          <LegendDot color="#f59e0b" label="Media" />
          <LegendDot color="#ef4444" label="Lleno" />
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zoneLabel: {
    backgroundColor: "rgba(0,0,0,0.72)",
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
  },
  zoneLabelId: { fontWeight: "800", fontSize: 18 },
  zoneLabelCount: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "600" },
  spotNumber: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  zoneHud: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(15,23,42,0.88)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  hudBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  hudZoneName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  hudZoneSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 1 },
  hudLegend: { gap: 5, alignItems: "flex-end" },
  routeHud: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  routeHudText: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center" },
  entranceMarker: {
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  entranceMarkerText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  destMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#10b981",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  destMarkerText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  recenterBtn: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  legend: {
    position: "absolute",
    left: 16,
    flexDirection: "row",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
});
