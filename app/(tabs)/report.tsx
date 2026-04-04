import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, CheckCircle } from "lucide-react-native";
import { useParkingContext } from "@/context/ParkingContext";
import { ParkingZone, ParkingSpot, SpotStatus, getZoneStats } from "@/lib/parking-data";

type ReportType = "occupied_but_free" | "free_but_occupied";
type Step = "type" | "zone" | "spot" | "done";

const REPORT_OPTIONS: {
  type: ReportType;
  emoji: string;
  title: string;
  description: string;
  targetStatus: SpotStatus;   // estado actual que muestra la app
  newStatus: SpotStatus;      // estado real que el usuario reporta
  accentColor: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    type: "free_but_occupied",
    emoji: "🚗",
    title: "Lugar libre que está ocupado",
    description: "La app lo muestra disponible pero hay un auto estacionado.",
    targetStatus: "available",
    newStatus: "occupied",
    accentColor: "#dc2626",
    bgColor: "#fff1f2",
    borderColor: "#fecdd3",
  },
  {
    type: "occupied_but_free",
    emoji: "✅",
    title: "Lugar ocupado que está libre",
    description: "La app lo muestra ocupado pero el espacio está vacío.",
    targetStatus: "occupied",
    newStatus: "available",
    accentColor: "#059669",
    bgColor: "#ecfdf5",
    borderColor: "#a7f3d0",
  },
];

export default function ReportScreen() {
  const { zones, handleReportSpotChange } = useParkingContext();

  const [step, setStep] = useState<Step>("type");
  const [reportType, setReportType] = useState<(typeof REPORT_OPTIONS)[0] | null>(null);
  const [selectedZone, setSelectedZone] = useState<ParkingZone | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);

  // Spots filtrados según lo que busca el usuario corregir
  const filteredSpots = selectedZone
    ? selectedZone.spots.filter((s) => s.status === reportType?.targetStatus)
    : [];

  const handleSelectType = (opt: (typeof REPORT_OPTIONS)[0]) => {
    setReportType(opt);
    setSelectedZone(null);
    setSelectedSpot(null);
    setStep("zone");
  };

  const handleSelectZone = (zone: ParkingZone) => {
    setSelectedZone(zone);
    setSelectedSpot(null);
    setStep("spot");
  };

  const handleSelectSpot = (spot: ParkingSpot) => {
    setSelectedSpot(spot);
  };

  const handleConfirm = () => {
    if (!selectedZone || !selectedSpot || !reportType) return;
    Alert.alert(
      "Confirmar reporte",
      `¿Reportar el lugar ${selectedSpot.id} como "${
        reportType.newStatus === "available" ? "libre" : "ocupado"
      }"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Reportar",
          style: "destructive",
          onPress: () => {
            handleReportSpotChange(
              selectedZone,
              selectedSpot,
              reportType.type,
              reportType.newStatus
            );
            setStep("done");
          },
        },
      ]
    );
  };

  const reset = () => {
    setStep("type");
    setReportType(null);
    setSelectedZone(null);
    setSelectedSpot(null);
  };

  // ── DONE ──────────────────────────────────────
  if (step === "done") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneWrap}>
          <CheckCircle size={64} color="#10b981" />
          <Text style={styles.doneTitle}>¡Reporte enviado!</Text>
          <Text style={styles.doneSub}>
            El lugar {selectedSpot?.id} fue actualizado. Gracias por mantener la info al día.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={reset}>
            <Text style={styles.doneBtnText}>Hacer otro reporte</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header con back y stepper */}
      <View style={styles.header}>
        {step !== "type" ? (
          <TouchableOpacity
            onPress={() => {
              if (step === "zone") setStep("type");
              else if (step === "spot") setStep("zone");
            }}
            style={styles.backBtn}
          >
            <ChevronLeft size={22} color="#374151" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}

        <View style={styles.stepperWrap}>
          {(["type", "zone", "spot"] as Step[]).map((s, i) => (
            <View key={s} style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={[
                  styles.stepDot,
                  (step === s ||
                    (step === "zone" && i === 0) ||
                    (step === "spot" && i <= 1)) &&
                    styles.stepDotActive,
                ]}
              >
                <Text style={styles.stepDotText}>{i + 1}</Text>
              </View>
              {i < 2 && (
                <View
                  style={[
                    styles.stepLine,
                    ((step === "zone" && i === 0) ||
                      (step === "spot" && i <= 0)) &&
                      styles.stepLineActive,
                  ]}
                />
              )}
            </View>
          ))}
        </View>

        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── STEP 1: Tipo de reporte ── */}
        {step === "type" && (
          <>
            <Text style={styles.stepTitle}>¿Qué querés reportar?</Text>
            <Text style={styles.stepSub}>
              Ayudá a mantener actualizado el estado del estacionamiento.
            </Text>
            <View style={{ gap: 14 }}>
              {REPORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  style={[
                    styles.typeCard,
                    { backgroundColor: opt.bgColor, borderColor: opt.borderColor },
                  ]}
                  onPress={() => handleSelectType(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.typeEmoji}>{opt.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.typeTitle, { color: opt.accentColor }]}>
                      {opt.title}
                    </Text>
                    <Text style={styles.typeDesc}>{opt.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── STEP 2: Zona ── */}
        {step === "zone" && reportType && (
          <>
            <Text style={styles.stepTitle}>¿En qué zona?</Text>
            <Text style={styles.stepSub}>
              Mostramos cuántos lugares con ese estado tiene cada zona.
            </Text>
            <View style={{ gap: 10 }}>
              {zones.map((zone) => {
                const count = zone.spots.filter(
                  (s) => s.status === reportType.targetStatus
                ).length;
                return (
                  <TouchableOpacity
                    key={zone.id}
                    style={[styles.zoneCard, count === 0 && styles.zoneCardDisabled]}
                    onPress={() => count > 0 && handleSelectZone(zone)}
                    activeOpacity={count > 0 ? 0.75 : 1}
                  >
                    <View
                      style={[
                        styles.zoneIdBox,
                        { backgroundColor: reportType.bgColor },
                      ]}
                    >
                      <Text
                        style={[styles.zoneId, { color: reportType.accentColor }]}
                      >
                        {zone.id}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.zoneName}>{zone.name}</Text>
                      <Text
                        style={[
                          styles.zoneCount,
                          { color: count > 0 ? reportType.accentColor : "#94a3b8" },
                        ]}
                      >
                        {count > 0
                          ? `${count} lugar${count !== 1 ? "es" : ""} para reportar`
                          : "Sin lugares para reportar"}
                      </Text>
                    </View>
                    {count > 0 && (
                      <View
                        style={[
                          styles.zoneBadge,
                          { backgroundColor: reportType.bgColor },
                        ]}
                      >
                        <Text
                          style={[styles.zoneBadgeText, { color: reportType.accentColor }]}
                        >
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* ── STEP 3: Lugar específico ── */}
        {step === "spot" && selectedZone && reportType && (
          <>
            <Text style={styles.stepTitle}>¿Qué lugar?</Text>
            <Text style={styles.stepSub}>
              Zona {selectedZone.id} · {filteredSpots.length} para reportar
            </Text>

            {filteredSpots.length === 0 ? (
              <View style={styles.emptySpots}>
                <Text style={styles.emptySpotsText}>
                  No hay lugares en ese estado en esta zona.
                </Text>
              </View>
            ) : (
              <View style={styles.spotsGrid}>
                {filteredSpots.map((spot) => {
                  const isSelected = selectedSpot?.id === spot.id;
                  return (
                    <TouchableOpacity
                      key={spot.id}
                      style={[
                        styles.spotBtn,
                        {
                          backgroundColor: isSelected
                            ? reportType.accentColor
                            : reportType.bgColor,
                          borderColor: reportType.accentColor,
                        },
                      ]}
                      onPress={() => handleSelectSpot(spot)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.spotBtnText,
                          { color: isSelected ? "#fff" : reportType.accentColor },
                        ]}
                      >
                        {spot.id}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {selectedSpot && (
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { backgroundColor: reportType.accentColor },
                ]}
                onPress={handleConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmBtnText}>
                  Reportar {selectedSpot.id} como{" "}
                  {reportType.newStatus === "available" ? "libre" : "ocupado"}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fff",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperWrap: { flexDirection: "row", alignItems: "center" },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: { backgroundColor: "#4f46e5" },
  stepDotText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  stepLine: { width: 24, height: 2, backgroundColor: "#e2e8f0" },
  stepLineActive: { backgroundColor: "#4f46e5" },
  content: { padding: 20, paddingBottom: 100 },
  stepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  stepSub: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 24,
    lineHeight: 19,
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  typeEmoji: { fontSize: 32 },
  typeTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  typeDesc: { fontSize: 13, color: "#64748b", lineHeight: 18 },
  zoneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  zoneCardDisabled: { opacity: 0.45 },
  zoneIdBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  zoneId: { fontSize: 20, fontWeight: "800" },
  zoneName: { fontSize: 14, fontWeight: "600", color: "#1e293b", marginBottom: 2 },
  zoneCount: { fontSize: 12 },
  zoneBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  zoneBadgeText: { fontSize: 13, fontWeight: "700" },
  spotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  spotBtn: {
    width: 58,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  spotBtnText: { fontSize: 12, fontWeight: "700" },
  emptySpots: {
    padding: 24,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
  },
  emptySpotsText: { color: "#94a3b8", fontSize: 14 },
  confirmBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  doneWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  doneTitle: { fontSize: 26, fontWeight: "800", color: "#0f172a" },
  doneSub: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 21,
  },
  doneBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
