import { View, Text, TouchableOpacity } from "react-native";
import { Car, MapPin, Clock, LogOut } from "lucide-react-native";
import { ParkingSpot, ParkingZone } from "@/lib/parking-data";

interface MyParkingCardProps {
  zone: ParkingZone;
  spot: ParkingSpot;
  parkedAt: Date;
  onLeave: () => void;
}

export function MyParkingCard({ zone, spot, parkedAt, onLeave }: MyParkingCardProps) {
  const formatTime = (date: Date) =>
    date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  return (
    <View className="bg-emerald-50 rounded-2xl p-5 shadow-sm">
      <View className="flex-row items-start justify-between mb-4">
        <View>
          <Text className="text-sm text-emerald-700/70 mb-1">Estas estacionado en</Text>
          <Text className="text-3xl font-bold text-emerald-700">{spot.id}</Text>
        </View>
        <View className="w-14 h-14 bg-emerald-100 rounded-2xl items-center justify-center">
          <Car size={28} color="#059669" />
        </View>
      </View>

      <View className="gap-2 mb-5">
        <View className="flex-row items-center gap-2">
          <MapPin size={16} color="#059669" />
          <Text className="text-sm text-emerald-700/70">{zone.name}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Clock size={16} color="#059669" />
          <Text className="text-sm text-emerald-700/70">Desde las {formatTime(parkedAt)}</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onLeave}
        className="flex-row items-center justify-center gap-2 border border-rose-300 rounded-xl py-3"
      >
        <LogOut size={16} color="#e11d48" />
        <Text className="text-rose-600 font-medium">Liberar lugar</Text>
      </TouchableOpacity>
    </View>
  );
}
