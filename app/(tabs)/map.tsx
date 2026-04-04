import { useCallback, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPin } from "lucide-react-native";
import { useParkingContext } from "@/context/ParkingContext";
import { useLocalSearchParams } from "expo-router";
import { CampusMap } from "@/components/parking/CampusMap";
import { ConfirmParkingModal } from "@/components/parking/ConfirmParkingModal";
import { ReportSpotModal } from "@/components/parking/ReportSpotModal";
import { useLocationPermission } from "@/hooks/useLocationPermission";
import { useUCCGeofence } from "@/hooks/useUCCGeofence";
import { ParkingZone, ParkingSpot } from "@/lib/parking-data";

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { focusZoneId, t } = useLocalSearchParams<{ focusZoneId?: string; t?: string }>();
  const { status, setStatus, requestPermission } = useLocationPermission();
  const { status: geofenceStatus, recheck } = useUCCGeofence();
  const {
    zones,
    selectedZone,
    selectedSpot,
    confirmModalOpen,
    reportModalOpen,
    setConfirmModalOpen,
    setReportModalOpen,
    handleSpotSelect: baseHandleSpotSelect,
    handleReportSpot: baseHandleReportSpot,
    handleConfirmParking,
    handleReportConfirm,
  } = useParkingContext();

  // Ref para geofenceStatus: evita que el callback cambie de referencia
  // cada vez que el geofence pasa de "unknown" → "inside"/"outside".
  const geofenceStatusRef = useRef(geofenceStatus);
  useEffect(() => { geofenceStatusRef.current = geofenceStatus; }, [geofenceStatus]);

  const handleSpotSelect = useCallback(async (zone: ParkingZone, spot: ParkingSpot) => {
    await recheck();
    if (geofenceStatusRef.current === "outside") {
      Alert.alert(
        "Estás fuera del campus",
        "Solo podés reclamar un lugar de estacionamiento cuando estés dentro del campus UCC.",
        [{ text: "Entendido" }]
      );
      return;
    }
    baseHandleSpotSelect(zone, spot);
  }, [recheck, baseHandleSpotSelect]);

  const handleReportSpot = useCallback(
    (zone: ParkingZone, spot: ParkingSpot) => baseHandleReportSpot(zone, spot),
    [baseHandleReportSpot]
  );

  if (status === "denied") {
    return (
      <View style={[styles.permissionScreen, { paddingTop: insets.top }]}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <MapPin size={32} color="#4f46e5" />
          </View>
          <Text style={styles.permissionTitle}>Ubicación desactivada</Text>
          <Text style={styles.permissionBody}>
            Para ver tu posición en el mapa activá el permiso desde{" "}
            <Text style={{ fontWeight: "700" }}>Configuración → ParkIt → Ubicación</Text>.
          </Text>
          <Text style={styles.permissionNote}>
            El mapa del campus igual funciona sin tu ubicación.
          </Text>
        </View>
      </View>
    );
  }

  if (status === "undetermined") {
    return (
      <View style={[styles.permissionScreen, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <MapPin size={32} color="#4f46e5" />
          </View>
          <Text style={styles.permissionTitle}>¿Dónde estás en el campus?</Text>
          <Text style={styles.permissionBody}>
            ParkIt puede mostrarte tu posición en el mapa para que encuentres el
            estacionamiento más cercano.
          </Text>
          <TouchableOpacity style={styles.allowBtn} onPress={requestPermission}>
            <Text style={styles.allowBtnText}>Permitir ubicación</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={() => setStatus("denied")}>
            <Text style={styles.skipBtnText}>Ahora no</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <CampusMap
        zones={zones}
        onSpotSelect={handleSpotSelect}
        onReportSpot={handleReportSpot}
        focusZoneId={focusZoneId}
        focusTimestamp={t}
      />
      <ConfirmParkingModal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        zone={selectedZone}
        spot={selectedSpot}
        onConfirm={handleConfirmParking}
      />
      <ReportSpotModal
        open={reportModalOpen}
        onOpenChange={setReportModalOpen}
        zone={selectedZone}
        spot={selectedSpot}
        onConfirm={handleReportConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  permissionScreen: {
    flex: 1,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  permissionCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  permissionIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 12,
  },
  permissionBody: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 8,
  },
  permissionNote: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 28,
  },
  allowBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 16,
    paddingVertical: 15,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  allowBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  skipBtn: {
    paddingVertical: 10,
    width: "100%",
    alignItems: "center",
  },
  skipBtnText: {
    color: "#94a3b8",
    fontSize: 14,
  },
});
