import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, Car, MapPin, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useParkingContext } from "@/context/ParkingContext";
import { MyParkingCard } from "@/components/parking/MyParkingCard";
import { ConfirmParkingModal } from "@/components/parking/ConfirmParkingModal";
import { ReportSpotModal } from "@/components/parking/ReportSpotModal";

export default function HomeScreen() {
  const {
    zones,
    totalStats,
    availableSpots,
    currentAvailableSpot,
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
    handleConfirmParking,
    handleReportConfirm,
    handleLeaveParking,
  } = useParkingContext();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1 px-4 pt-3"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="w-10 h-10 rounded-full bg-indigo-100 items-center justify-center">
            <Car size={18} color="#4f46e5" />
          </View>
          <Text className="text-base font-semibold text-gray-900">Hola, Usuario!</Text>
          <TouchableOpacity className="w-10 h-10 items-center justify-center">
            <Bell size={20} color="#4f46e5" />
          </TouchableOpacity>
        </View>

        {/* Brand Card */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-3">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 rounded-xl bg-indigo-600 items-center justify-center">
              <Text className="text-white font-bold text-lg">P</Text>
            </View>
            <View>
              <Text className="font-semibold text-gray-900">ParkIt Campus</Text>
              <View className="mt-0.5 px-2 py-0.5 bg-indigo-100 rounded-full self-start">
                <Text className="text-xs text-indigo-700 font-medium">UCC Estacionamiento</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Spot Selector */}
        <View className="bg-white rounded-2xl p-4 shadow-sm mb-3">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm text-gray-400">Lugar disponible</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-1">
                <TouchableOpacity
                  onPress={() => handleZoneFilterChange(null)}
                  className={`px-2 py-1 rounded-lg ${
                    zoneFilter === null ? "bg-indigo-600" : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      zoneFilter === null ? "text-white" : "text-gray-400"
                    }`}
                  >
                    Todas
                  </Text>
                </TouchableOpacity>
                {zones.map((zone) => (
                  <TouchableOpacity
                    key={zone.id}
                    onPress={() => handleZoneFilterChange(zone.id)}
                    className={`px-2 py-1 rounded-lg ${
                      zoneFilter === zone.id ? "bg-indigo-600" : "bg-gray-100"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        zoneFilter === zone.id ? "text-white" : "text-gray-400"
                      }`}
                    >
                      {zone.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={handlePrevSpot}
              disabled={availableSpots.length === 0}
              className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center"
            >
              <ChevronLeft size={20} color="#374151" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleQuickSelect}
              disabled={!currentAvailableSpot}
              className="flex-1 mx-3 py-3 rounded-xl bg-indigo-50 border border-indigo-200 items-center"
            >
              {currentAvailableSpot ? (
                <>
                  <Text className="text-3xl font-bold text-indigo-600">
                    {currentAvailableSpot.zone.id}{currentAvailableSpot.spot.number}
                  </Text>
                  <Text className="text-indigo-500 text-xs mt-1 font-medium">
                    Tocar para ocupar
                  </Text>
                </>
              ) : (
                <Text className="text-gray-400 text-sm">Sin lugares</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNextSpot}
              disabled={availableSpots.length === 0}
              className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center"
            >
              <ChevronRight size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <Text className="text-center text-xs text-gray-400 mt-2">
            {availableSpots.length} lugares
          </Text>
        </View>

        {/* Stats Grid */}
        <View className="flex-row gap-2 mb-3">
          <View className="flex-1 bg-white rounded-2xl p-3 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-bold text-emerald-500">{totalStats.available}</Text>
                <Text className="text-xs text-gray-400">Disponibles</Text>
              </View>
              <View className="w-8 h-8 rounded-lg bg-emerald-50 items-center justify-center">
                <MapPin size={16} color="#10b981" />
              </View>
            </View>
          </View>

          <View className="flex-1 bg-white rounded-2xl p-3 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-bold text-gray-800">{totalStats.total}</Text>
                <Text className="text-xs text-gray-400">Total</Text>
              </View>
              <View className="w-8 h-8 rounded-lg bg-indigo-50 items-center justify-center">
                <Car size={16} color="#4f46e5" />
              </View>
            </View>
          </View>
        </View>

        {/* My Parking */}
        {userParking && (
          <MyParkingCard
            zone={userParking.zone}
            spot={userParking.spot}
            parkedAt={userParking.parkedAt}
            onLeave={handleLeaveParking}
          />
        )}
      </ScrollView>

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
    </SafeAreaView>
  );
}
