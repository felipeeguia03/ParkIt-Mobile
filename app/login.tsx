import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { login, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const handleLogin = async () => {
    setError("");
    const result = await login(email, password);
    if (result.success) {
      router.replace("/(tabs)");
    } else {
      setError(result.error ?? "Error al iniciar sesión");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / branding */}
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>P</Text>
            </View>
            <Text style={styles.appName}>ParkIt UCC</Text>
            <Text style={styles.appSub}>Sistema de estacionamiento del campus</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciá sesión</Text>
            <Text style={styles.cardSub}>
              Usá tu cuenta institucional UCC
            </Text>

            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Correo institucional</Text>
              <View style={[styles.inputRow, emailFocused && styles.inputFocused]}>
                <Mail size={18} color={emailFocused ? "#4f46e5" : "#94a3b8"} />
                <TextInput
                  style={styles.input}
                  placeholder="nombre@ucc.edu.ar"
                  placeholderTextColor="#cbd5e1"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(""); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={[styles.inputRow, passFocused && styles.inputFocused]}>
                <Lock size={18} color={passFocused ? "#4f46e5" : "#94a3b8"} />
                <TextInput
                  style={styles.input}
                  placeholder="Tu contraseña UCC"
                  placeholderTextColor="#cbd5e1"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(""); }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                  {showPassword
                    ? <EyeOff size={18} color="#94a3b8" />
                    : <Eye size={18} color="#94a3b8" />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Button */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Ingresar</Text>}
            </TouchableOpacity>

            <Text style={styles.hint}>
              ¿Problemas para ingresar? Contactá al área de sistemas de UCC.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: "center",
  },
  header: { alignItems: "center", marginBottom: 32 },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  logoText: { color: "#fff", fontSize: 36, fontWeight: "800" },
  appName: { fontSize: 24, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  appSub: { fontSize: 13, color: "#94a3b8", textAlign: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: { fontSize: 20, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  cardSub: { fontSize: 13, color: "#94a3b8", marginBottom: 24 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputFocused: { borderColor: "#4f46e5", backgroundColor: "#fafaff" },
  input: { flex: 1, fontSize: 15, color: "#0f172a" },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: { color: "#dc2626", fontSize: 13, textAlign: "center" },
  btn: {
    backgroundColor: "#4f46e5",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 12, color: "#94a3b8", textAlign: "center", lineHeight: 18 },
});
