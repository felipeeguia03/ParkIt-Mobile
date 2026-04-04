import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useParkingContext } from "@/context/ParkingContext";
import { CampusMap } from "@/components/parking/CampusMap";
import { ConfirmParkingModal } from "@/components/parking/ConfirmParkingModal";
import { ReportSpotModal } from "@/components/parking/ReportSpotModal";

export default function MapScreen() {
  const {
    zones,
    selectedZone,
    selectedSpot,
    confirmModalOpen,
    reportModalOpen,
    setConfirmModalOpen,
    setReportModalOpen,
    handleSpotSelect,
    handleReportSpot,
    handleConfirmParking,
    handleReportConfirm,
  } = useParkingContext();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-4 pt-3 pb-2">
        <Text className="text-lg font-semibold text-gray-900">Mapa del Campus</Text>
        <Text className="text-sm text-gray-400">Tocá una zona para ver los lugares</Text>
      </View>

      <View className="flex-1 px-4 pb-4">
        <CampusMap
          zones={zones}
          onSpotSelect={handleSpotSelect}
          onReportSpot={handleReportSpot}
        />
      </View>

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
