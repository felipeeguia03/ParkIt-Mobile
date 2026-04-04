import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Car, MapPin, CheckCircle } from "lucide-react-native";
import { ParkingSpot, ParkingZone } from "@/lib/parking-data";

interface ConfirmParkingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone: ParkingZone | null;
  spot: ParkingSpot | null;
  onConfirm: () => void;
}

export function ConfirmParkingModal({
  open,
  onOpenChange,
  zone,
  spot,
  onConfirm,
}: ConfirmParkingModalProps) {
  const insets = useSafeAreaInsets();

  if (!zone || !spot) return null;

  return (
    <Modal
      visible={open}
      transparent={false}
      animationType="slide"
      onRequestClose={() => onOpenChange(false)}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Estás estacionado en</Text>
          <Text style={styles.headerSub}>{zone.name}</Text>
        </View>

        {/* Spot number hero */}
        <View style={styles.heroWrap}>
          <View style={styles.heroCircle}>
            <Car size={52} color="#059669" />
          </View>
          <Text style={styles.spotId}>{spot.id}</Text>
          <View style={styles.zoneBadge}>
            <MapPin size={16} color="#6b7280" />
            <Text style={styles.zoneBadgeText}>{zone.name}</Text>
          </View>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <CheckCircle size={20} color="#059669" />
            <Text style={styles.infoText}>Lugar verificado como disponible</Text>
          </View>
          <View style={styles.infoRow}>
            <MapPin size={20} color="#4f46e5" />
            <Text style={styles.infoText}>Zona {zone.id} · Lugar #{spot.number}</Text>
          </View>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
            <Text style={styles.confirmBtnText}>Estacionar aquí</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => onOpenChange(false)} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 28,
  },
  header: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  headerLabel: {
    fontSize: 28,
    fontWeight: "800",
    color: "#064e3b",
    textAlign: "center",
  },
  headerSub: {
    fontSize: 15,
    color: "#059669",
    marginTop: 4,
    fontWeight: "500",
  },
  heroWrap: {
    alignItems: "center",
    marginTop: 32,
    marginBottom: 32,
  },
  heroCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#d1fae5",
    borderWidth: 3,
    borderColor: "#6ee7b7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  spotId: {
    fontSize: 80,
    fontWeight: "900",
    color: "#065f46",
    lineHeight: 88,
    letterSpacing: -2,
  },
  zoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1fae5",
  },
  zoneBadgeText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "#d1fae5",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoText: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
  actions: {
    gap: 12,
  },
  confirmBtn: {
    backgroundColor: "#059669",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "500",
  },
});
