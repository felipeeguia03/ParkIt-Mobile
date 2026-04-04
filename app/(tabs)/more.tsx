import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MoreScreen() {
  const items = ["Configuración", "Ayuda", "Acerca de"];

  return (
    <SafeAreaView className="flex-1 bg-gray-50 px-4 pt-3">
      <View className="gap-3">
        {items.map((item) => (
          <TouchableOpacity
            key={item}
            className="bg-white rounded-2xl px-4 py-4 shadow-sm"
          >
            <Text className="font-medium text-gray-900">{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}
