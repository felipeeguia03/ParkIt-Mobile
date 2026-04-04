import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback } from "react-native";
import { Car, MapPin } from "lucide-react-native";
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
  if (!zone || !spot) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
    >
      <TouchableWithoutFeedback onPress={() => onOpenChange(false)}>
        <View className="flex-1 bg-black/50 items-center justify-center px-6">
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-3xl p-6 w-full max-w-sm">
              <Text className="text-xl font-semibold text-center text-gray-900 mb-1">
                Confirmar Estacionamiento
              </Text>
              <Text className="text-sm text-gray-500 text-center mb-6">
                ¿Estás seguro de que quieres estacionar aquí?
              </Text>

              <View className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 items-center mb-6">
                <View className="w-16 h-16 bg-emerald-100 rounded-full items-center justify-center mb-4">
                  <Car size={32} color="#059669" />
                </View>
                <Text className="text-3xl font-bold text-emerald-700 mb-1">{spot.id}</Text>
                <View className="flex-row items-center gap-1">
                  <MapPin size={14} color="#6b7280" />
                  <Text className="text-sm text-gray-500">{zone.name}</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onConfirm}
                className="bg-emerald-600 rounded-2xl py-4 items-center mb-3"
              >
                <Text className="text-white font-semibold text-base">Estacionar aquí</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onOpenChange(false)}
                className="py-3 items-center"
              >
                <Text className="text-gray-500 font-medium">Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
