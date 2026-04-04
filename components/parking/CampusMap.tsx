import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
} from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { ParkingZone, ParkingSpot, getZoneStats } from "@/lib/parking-data";

interface CampusMapProps {
  zones: ParkingZone[];
  onSpotSelect: (zone: ParkingZone, spot: ParkingSpot) => void;
  onReportSpot: (zone: ParkingZone, spot: ParkingSpot) => void;
}

const SCREEN_WIDTH = Dimensions.get("window").width - 32; // px-4 on each side
const MAP_HEIGHT = SCREEN_WIDTH * 1.25; // 4:5 aspect ratio

export function CampusMap({ zones, onSpotSelect, onReportSpot }: CampusMapProps) {
  const [selectedZone, setSelectedZone] = useState<ParkingZone | null>(null);

  const handleZonePress = (zone: ParkingZone) => {
    setSelectedZone(zone);
  };

  const handleBack = () => {
    setSelectedZone(null);
  };

  if (selectedZone) {
    const stats = getZoneStats(selectedZone);
    return (
      <View className="flex-1 bg-white rounded-2xl overflow-hidden shadow-lg">
        {/* Zone Header */}
        <View className="flex-row items-center gap-2 p-4 border-b border-gray-100">
          <TouchableOpacity
            onPress={handleBack}
            className="w-9 h-9 items-center justify-center rounded-xl bg-gray-100"
          >
            <ChevronLeft size={20} color="#4f46e5" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="font-semibold text-lg text-indigo-600">{selectedZone.name}</Text>
            <Text className="text-sm text-gray-400">
              {stats.available} disponibles de {selectedZone.spots.length}
            </Text>
          </View>
        </View>

        {/* Spots Grid */}
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View className="flex-row flex-wrap gap-2">
            {selectedZone.spots.map((spot) => (
              <SpotButton
                key={spot.id}
                spot={spot}
                onSelect={() => onSpotSelect(selectedZone, spot)}
                onReport={() => onReportSpot(selectedZone, spot)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Legend */}
        <View className="px-4 py-3 border-t border-gray-100 flex-row justify-center gap-5">
          <View className="flex-row items-center gap-1.5">
            <View className="w-3 h-3 rounded bg-emerald-500" />
            <Text className="text-xs text-gray-400">Disponible</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="w-3 h-3 rounded bg-rose-500" />
            <Text className="text-xs text-gray-400">Ocupado</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="w-3 h-3 rounded bg-amber-500" />
            <Text className="text-xs text-gray-400">Reportado</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View>
      {/* Satellite map with zone overlays */}
      <View
        className="relative rounded-2xl overflow-hidden shadow-lg"
        style={{ width: SCREEN_WIDTH, height: MAP_HEIGHT }}
      >
        <Image
          source={{
            uri: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WhatsApp%20Image%202026-03-29%20at%2019.32.42-UiUCbwXOfndfU3CaHlvTmWJbSZRLUt.jpeg",
          }}
          style={{ width: SCREEN_WIDTH, height: MAP_HEIGHT }}
          resizeMode="cover"
        />

        {/* Dark overlay */}
        <View className="absolute inset-0 bg-black/20" />

        {/* Zone overlays */}
        {zones.map((zone) => (
          <ZoneOverlay
            key={zone.id}
            zone={zone}
            mapWidth={SCREEN_WIDTH}
            mapHeight={MAP_HEIGHT}
            onPress={() => handleZonePress(zone)}
          />
        ))}
      </View>

      {/* Legend */}
      <View className="mt-4 flex-row justify-center gap-5">
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 rounded-full bg-emerald-500" />
          <Text className="text-xs text-gray-400">Alta disponibilidad</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 rounded-full bg-amber-500" />
          <Text className="text-xs text-gray-400">Media</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 rounded-full bg-rose-500" />
          <Text className="text-xs text-gray-400">Lleno</Text>
        </View>
      </View>
    </View>
  );
}

interface ZoneOverlayProps {
  zone: ParkingZone;
  mapWidth: number;
  mapHeight: number;
  onPress: () => void;
}

function ZoneOverlay({ zone, mapWidth, mapHeight, onPress }: ZoneOverlayProps) {
  const stats = getZoneStats(zone);
  const availabilityPercent = (stats.available / stats.total) * 100;

  const bgColor =
    availabilityPercent > 40
      ? "rgba(16,185,129,0.5)"
      : availabilityPercent > 15
      ? "rgba(245,158,11,0.5)"
      : "rgba(239,68,68,0.5)";

  const borderColor =
    availabilityPercent > 40
      ? "#10b981"
      : availabilityPercent > 15
      ? "#f59e0b"
      : "#ef4444";

  const top = (zone.position.top / 100) * mapHeight;
  const left = (zone.position.left / 100) * mapWidth;
  const width = (zone.position.width / 100) * mapWidth;
  const height = (zone.position.height / 100) * mapHeight;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        position: "absolute",
        top,
        left,
        width,
        height,
        backgroundColor: bgColor,
        borderWidth: 2,
        borderColor,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
      }}
      activeOpacity={0.75}
    >
      <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
        {zone.id}
      </Text>
      <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 10, fontWeight: "500" }}>
        {stats.available}/{stats.total}
      </Text>
    </TouchableOpacity>
  );
}

interface SpotButtonProps {
  spot: ParkingSpot;
  onSelect: () => void;
  onReport: () => void;
}

function SpotButton({ spot, onSelect, onReport }: SpotButtonProps) {
  const isAvailable = spot.status === "available";
  const isOccupied = spot.status === "occupied";
  const isReported = spot.status === "reported";

  const handlePress = () => {
    if (isAvailable) onSelect();
    else if (isOccupied) onReport();
  };

  const bgColor = isAvailable
    ? "rgba(16,185,129,0.15)"
    : isOccupied
    ? "rgba(239,68,68,0.15)"
    : "rgba(245,158,11,0.15)";

  const borderColor = isAvailable
    ? "#10b981"
    : isOccupied
    ? "#ef4444"
    : "#f59e0b";

  const textColor = isAvailable
    ? "#065f46"
    : isOccupied
    ? "#991b1b"
    : "#92400e";

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isReported}
      style={{
        width: 52,
        height: 52,
        backgroundColor: bgColor,
        borderWidth: 2,
        borderColor,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        opacity: isReported ? 0.6 : 1,
      }}
      activeOpacity={0.7}
    >
      <Text style={{ color: textColor, fontSize: 12, fontWeight: "600" }}>
        {spot.id.replace(/[A-Z]/g, "")}
      </Text>
    </TouchableOpacity>
  );
}
