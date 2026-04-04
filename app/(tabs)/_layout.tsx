import { Tabs } from "expo-router";
import { Home, Map, AlertTriangle, MoreHorizontal } from "lucide-react-native";
import { ParkingProvider } from "@/context/ParkingContext";

export default function TabsLayout() {
  return (
    <ParkingProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#4f46e5",
          tabBarInactiveTintColor: "#9ca3af",
          tabBarStyle: {
            position: "absolute",
            backgroundColor: "rgba(255,255,255,0.97)",
            borderTopColor: "#f3f4f6",
            borderTopWidth: 1,
            paddingTop: 4,
            height: 60,
            elevation: 20,
            marginBottom: 12,
            marginHorizontal: 16,
            borderRadius: 20,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "500",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Inicio",
            tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: "Mapa",
            tabBarIcon: ({ color, size }) => <Map size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="report"
          options={{
            title: "Reportar",
            tabBarIcon: ({ color, size }) => <AlertTriangle size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: "Más",
            tabBarIcon: ({ color, size }) => <MoreHorizontal size={size} color={color} />,
          }}
        />
      </Tabs>
    </ParkingProvider>
  );
}
