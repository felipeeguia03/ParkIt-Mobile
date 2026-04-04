import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Car, MapPin, Clock, LogOut, Navigation } from "lucide-react-native";
import { useRouter } from "expo-router";
import { ParkingSpot, ParkingZone } from "@/lib/parking-data";

interface MyParkingCardProps {
  zone: ParkingZone;
  spot: ParkingSpot;
  parkedAt: Date;
  onLeave: () => void;
}

export function MyParkingCard({ zone, spot, parkedAt, onLeave }: MyParkingCardProps) {
  const router = useRouter();

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  const handleViewOnMap = () => {
    router.navigate({
      pathname: "/(tabs)/map",
      params: { focusZoneId: zone.id, t: String(Date.now()) },
    });
  };

  return (
    <View style={styles.card}>
      {/* Spot number */}
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>Estás estacionado en</Text>
          <Text style={styles.spotId}>{spot.id}</Text>
        </View>
        <View style={styles.iconBox}>
          <Car size={28} color="#059669" />
        </View>
      </View>

      {/* Details */}
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <MapPin size={15} color="#059669" />
          <Text style={styles.detailText}>{zone.name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Clock size={15} color="#059669" />
          <Text style={styles.detailText}>Desde las {formatTime(parkedAt)}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={handleViewOnMap}
          activeOpacity={0.8}
        >
          <Navigation size={15} color="#4f46e5" />
          <Text style={styles.mapBtnText}>Ver en mapa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={onLeave}
          activeOpacity={0.8}
        >
          <LogOut size={15} color="#e11d48" />
          <Text style={styles.leaveBtnText}>Liberar lugar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ecfdf5",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "#a7f3d0",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  label: { fontSize: 12, color: "#059669", opacity: 0.7, marginBottom: 2 },
  spotId: { fontSize: 40, fontWeight: "800", color: "#065f46", lineHeight: 44 },
  iconBox: {
    width: 52,
    height: 52,
    backgroundColor: "#d1fae5",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  details: { gap: 6, marginBottom: 18 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 13, color: "#065f46", opacity: 0.8 },
  actions: { flexDirection: "row", gap: 10 },
  mapBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
  },
  mapBtnText: { color: "#4f46e5", fontWeight: "600", fontSize: 13 },
  leaveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#fecdd3",
    backgroundColor: "#fff1f2",
  },
  leaveBtnText: { color: "#e11d48", fontWeight: "600", fontSize: 13 },
});
