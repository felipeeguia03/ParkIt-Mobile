import "../global.css";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/context/AuthContext";

function RootNavigator() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "login";
    if (!user && !inAuth) {
      router.replace("/login");
    } else if (user && inAuth) {
      router.replace("/(tabs)");
    }
  }, [user, segments, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
