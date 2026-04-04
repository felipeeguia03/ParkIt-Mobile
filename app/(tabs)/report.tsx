import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertTriangle } from "lucide-react-native";
import { useRouter } from "expo-router";

export default function ReportScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-gray-50 px-4 pt-3">
      <View className="bg-white rounded-2xl p-6 items-center shadow-sm">
        <View className="w-16 h-16 rounded-2xl bg-red-50 items-center justify-center mb-4">
          <AlertTriangle size={32} color="#ef4444" />
        </View>
        <Text className="font-semibold text-lg text-gray-900 mb-2">
          Reportar lugar ocupado
        </Text>
        <Text className="text-sm text-gray-400 text-center mb-6">
          Si ves un lugar marcado como libre pero está ocupado, reportalo desde el mapa.
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/map")}
          className="bg-indigo-600 rounded-2xl py-4 px-8 w-full items-center"
        >
          <Text className="text-white font-semibold">Ir al mapa</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
