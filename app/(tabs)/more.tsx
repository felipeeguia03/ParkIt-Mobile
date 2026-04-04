'use client'
import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  Animated, StyleSheet, Dimensions, Alert, ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  User, Bell, History, Flag, BookOpen, MapPin,
  Clock, HelpCircle, AlertCircle, Mail,
  Info, ChevronRight, X, LogOut,
  Car, Timer, Star, ArrowLeft, CheckCircle, XCircle,
} from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useUserStats } from "@/hooks/useUserStats";
import { supabase } from "@/lib/supabase";
import { initialParkingData } from "@/lib/parking-data";

const { width: SW, height: SH } = Dimensions.get("window");
const PANEL_W = SW * 0.82;

// ─── helpers ──────────────────────────────────────────────────────────────
function formatMinutes(min: number): string {
  if (!min || min === 0) return "0 min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── tipos ────────────────────────────────────────────────────────────────
type SheetId =
  | "historial" | "reportes"
  | "reglamento" | "zonas" | "horarios"
  | "ayuda" | "problema" | "contacto"
  | "perfil" | "notificaciones"
  | null;

// ─── sheet genérico ───────────────────────────────────────────────────────
function DetailSheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SH)).current;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: open ? 0 : SH,
      damping: 26, stiffness: 280, useNativeDriver: true,
    }).start();
  }, [open]);

  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onClose}>
      <View style={sheet.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <Animated.View
          style={[
            sheet.container,
            { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideY }] },
          ]}
        >
          <View style={sheet.handle} />
          <View style={sheet.header}>
            <Text style={sheet.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={sheet.closeBtn}>
              <X size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── contenido: reglamento ────────────────────────────────────────────────
function ReglamentoContent() {
  const items = [
    {
      n: "1", title: "Uso exclusivo universitario",
      body: "El estacionamiento es de uso exclusivo para alumnos, docentes y personal de la UCC con credencial vigente.",
    },
    {
      n: "2", title: "Registro obligatorio",
      body: "El lugar debe ser registrado en ParkIt antes de dejar el vehículo. Lugares sin registro pueden ser reportados.",
    },
    {
      n: "3", title: "Tiempo máximo de estadía",
      body: "La permanencia máxima es de 8 horas consecutivas en días hábiles. Fines de semana rige el horario habilitado.",
    },
    {
      n: "4", title: "Responsabilidad",
      body: "La universidad no responde por daños, robos o deterioros dentro del predio. No dejar objetos de valor a la vista.",
    },
    {
      n: "5", title: "Reportes",
      body: "Reportar lugares incorrectamente marcados colabora con la comunidad. Los reportes sin fundamento reiterados pueden inhabilitar el acceso.",
    },
    {
      n: "6", title: "Sanciones",
      body: "El incumplimiento puede resultar en la inhabilitación temporal o definitiva del acceso al estacionamiento.",
    },
  ];
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {items.map(item => (
        <View key={item.n} style={cnt.ruleRow}>
          <View style={cnt.ruleNum}><Text style={cnt.ruleNumText}>{item.n}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={cnt.ruleTitle}>{item.title}</Text>
            <Text style={cnt.ruleBody}>{item.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── contenido: zonas ─────────────────────────────────────────────────────
function ZonasContent() {
  const zones = initialParkingData;
  const colors = ["#4f46e5","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899"];
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {zones.map((z, i) => (
        <View key={z.id} style={cnt.zoneRow}>
          <View style={[cnt.zoneBadge, { backgroundColor: colors[i] }]}>
            <Text style={cnt.zoneBadgeText}>{z.id}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={cnt.zoneRowName}>{z.name}</Text>
            <Text style={cnt.zoneRowSub}>{z.spots.length} lugares · {z.spotLayout.rows} filas × {z.spotLayout.cols} columnas</Text>
          </View>
          <Text style={[cnt.zoneRowCap, { color: colors[i] }]}>{z.spots.length}</Text>
        </View>
      ))}
      <View style={cnt.totalRow}>
        <Text style={cnt.totalLabel}>Total campus</Text>
        <Text style={cnt.totalValue}>{zones.reduce((s, z) => s + z.spots.length, 0)} lugares</Text>
      </View>
    </View>
  );
}

// ─── contenido: horarios ──────────────────────────────────────────────────
function HorariosContent() {
  const rows = [
    { day: "Lunes – Viernes",  open: "07:00", close: "22:00", highlight: false },
    { day: "Sábados",          open: "08:00", close: "14:00", highlight: false },
    { day: "Domingos",         open: "—",     close: "—",     highlight: false },
    { day: "Feriados",         open: "—",     close: "—",     highlight: false },
    { day: "Período de exámenes (L–S)", open: "07:00", close: "23:00", highlight: true },
  ];
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      <View style={cnt.scheduleCard}>
        {rows.map((r, i) => (
          <View
            key={r.day}
            style={[
              cnt.scheduleRow,
              i < rows.length - 1 && cnt.scheduleRowBorder,
              r.highlight && cnt.scheduleRowHighlight,
            ]}
          >
            <Text style={[cnt.scheduleDay, r.highlight && { color: "#4f46e5", fontWeight: "700" }]}>
              {r.day}
            </Text>
            <Text style={[cnt.scheduleTime, r.open === "—" && { color: "#d1d5db" }]}>
              {r.open === "—" ? "Cerrado" : `${r.open} – ${r.close}`}
            </Text>
          </View>
        ))}
      </View>
      <Text style={cnt.scheduleNote}>
        * El horario de exámenes se habilita según el calendario académico. Para eventos especiales consultá en administración.
      </Text>
    </View>
  );
}

// ─── contenido: ayuda (FAQ) ───────────────────────────────────────────────
function AyudaContent() {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    {
      q: "¿Cómo registro un lugar?",
      a: "Desde la pantalla de inicio tocá el lugar sugerido o buscalo en el mapa. Confirmá la ocupación en el modal que aparece. El lugar queda registrado en tiempo real.",
    },
    {
      q: "¿Qué pasa si alguien ya ocupa mi lugar?",
      a: "Podés reportarlo tocando el lugar rojo en el mapa. El sistema lo marca como 'reportado' y queda visible para los administradores.",
    },
    {
      q: "¿Puedo reclamar un lugar si no estoy en el campus?",
      a: "No. La app detecta tu ubicación y solo permite reclamar lugares cuando estás dentro del predio de la UCC.",
    },
    {
      q: "¿Cómo libero mi lugar?",
      a: "En la pantalla de inicio aparece tu lugar activo con el botón 'Liberar lugar'. Al hacerlo el lugar vuelve a estar disponible para todos.",
    },
    {
      q: "¿Por qué no veo los spots en el mapa?",
      a: "Los spots individuales se muestran cuando hacés zoom sobre una zona. Desde la vista general solo se ve el color de ocupación de cada zona.",
    },
    {
      q: "¿Los datos son en tiempo real?",
      a: "Sí. Los cambios de estado se sincronizan en tiempo real entre todos los dispositivos mediante Supabase Realtime.",
    },
  ];
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {faqs.map((faq, i) => (
        <TouchableOpacity
          key={i}
          style={[cnt.faqRow, i < faqs.length - 1 && cnt.faqRowBorder]}
          onPress={() => setOpen(open === i ? null : i)}
          activeOpacity={0.7}
        >
          <View style={cnt.faqQ}>
            <Text style={cnt.faqQText}>{faq.q}</Text>
            <ChevronRight
              size={16} color="#9ca3af"
              style={{ transform: [{ rotate: open === i ? "90deg" : "0deg" }] }}
            />
          </View>
          {open === i && <Text style={cnt.faqA}>{faq.a}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── contenido: contacto ──────────────────────────────────────────────────
function ContactoContent() {
  const items = [
    { label: "Email", value: "sistemas@ucc.edu.ar", action: () => Linking.openURL("mailto:sistemas@ucc.edu.ar") },
    { label: "Teléfono", value: "(0351) 493-8000 int. 248", action: () => Linking.openURL("tel:+5403514938000") },
    { label: "Dirección", value: "Ob. Trejo 323, X5000IYG, Córdoba", action: undefined },
    { label: "Atención", value: "Lun–Vie · 09:00 – 17:00 h", action: undefined },
  ];
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      <View style={cnt.scheduleCard}>
        {items.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[cnt.scheduleRow, i < items.length - 1 && cnt.scheduleRowBorder]}
            onPress={item.action}
            activeOpacity={item.action ? 0.65 : 1}
          >
            <Text style={cnt.scheduleDay}>{item.label}</Text>
            <Text style={[cnt.scheduleTime, item.action && { color: "#4f46e5" }]}>{item.value}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={cnt.scheduleNote}>Ante cualquier problema con la app escribí al email indicado incluyendo tu nombre y legajo.</Text>
    </View>
  );
}

// ─── contenido: historial ─────────────────────────────────────────────────
function HistorialContent({ userId }: { userId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("parking_events")
      .select("id, created_at, zone_id, spot_id, action, duration_minutes")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [userId]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#4f46e5" />;
  if (rows.length === 0) return (
    <View style={cnt.empty}>
      <History size={36} color="#e5e7eb" />
      <Text style={cnt.emptyText}>Sin sesiones aún</Text>
      <Text style={cnt.emptyHint}>Tus estacionamientos registrados aparecerán acá</Text>
    </View>
  );

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {rows.map((row) => {
        const isClaim = row.action === "claim";
        return (
          <View key={row.id} style={cnt.histRow}>
            <View style={[cnt.histIcon, { backgroundColor: isClaim ? "#eef2ff" : "#ecfdf5" }]}>
              {isClaim
                ? <Car size={16} color="#4f46e5" />
                : <CheckCircle size={16} color="#10b981" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={cnt.histTitle}>
                {isClaim ? "Ocupó" : "Liberó"} · Zona {row.zone_id} — {row.spot_id}
              </Text>
              <Text style={cnt.histDate}>{formatDate(row.created_at)}</Text>
            </View>
            {row.duration_minutes && (
              <Text style={cnt.histDuration}>{formatMinutes(row.duration_minutes)}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── contenido: reportes ──────────────────────────────────────────────────
function ReportesContent({ userId }: { userId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("spot_reports")
      .select("id, created_at, zone_id, spot_id, type")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [userId]);

  const typeLabel: Record<string, string> = {
    free_but_occupied: "Libre pero aparece ocupado",
    occupied_but_free: "Ocupado pero aparece libre",
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#4f46e5" />;
  if (rows.length === 0) return (
    <View style={cnt.empty}>
      <Flag size={36} color="#e5e7eb" />
      <Text style={cnt.emptyText}>Sin reportes aún</Text>
      <Text style={cnt.emptyHint}>Los lugares que reportaste aparecerán acá</Text>
    </View>
  );

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {rows.map((row) => (
        <View key={row.id} style={cnt.histRow}>
          <View style={[cnt.histIcon, { backgroundColor: "#fff7ed" }]}>
            <Flag size={16} color="#f59e0b" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={cnt.histTitle}>
              Zona {row.zone_id} — {row.spot_id}
            </Text>
            <Text style={cnt.histDate}>{typeLabel[row.type] ?? row.type}</Text>
            <Text style={[cnt.histDate, { marginTop: 1 }]}>{formatDate(row.created_at)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── stat chip ────────────────────────────────────────────────────────────
function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.statChip}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── componente principal ─────────────────────────────────────────────────
export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { stats, loading: statsLoading } = useUserStats(user?.id);
  const [activeSheet, setActiveSheet] = useState<SheetId>(null);

  const open = useCallback((id: SheetId) => setActiveSheet(id), []);
  const close = useCallback(() => setActiveSheet(null), []);

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Seguro que querés salir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => logout() },
    ]);
  };

  const slideX = useRef(new Animated.Value(PANEL_W)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideX, { toValue: 0, damping: 22, stiffness: 260, useNativeDriver: true }),
    ]).start();
  }, []);

  const closePanelAndGoBack = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideX, { toValue: PANEL_W, duration: 180, useNativeDriver: true }),
    ]).start(() => router.back());
  };

  interface MenuItem { icon: React.ReactNode; label: string; sub?: string; iconBg?: string; sheet: SheetId }
  interface Section  { title: string; items: MenuItem[] }

  const sections: Section[] = [
    {
      title: "Mi cuenta",
      items: [
        { icon: <User size={18} color="#4f46e5" />, label: "Editar perfil", sub: "Nombre, foto y datos personales", sheet: "perfil" },
        { icon: <Bell size={18} color="#4f46e5" />, label: "Notificaciones", sub: "Alertas de disponibilidad", sheet: "notificaciones" },
      ],
    },
    {
      title: "Estacionamiento",
      items: [
        {
          icon: <History size={18} color="#10b981" />, iconBg: "#ecfdf5",
          label: "Historial de uso",
          sub: stats
            ? stats.sessions === 0 ? "Sin sesiones aún"
            : `${stats.sessions} sesión${stats.sessions !== 1 ? "es" : ""} registrada${stats.sessions !== 1 ? "s" : ""}`
            : "Tus últimas sesiones",
          sheet: "historial",
        },
        {
          icon: <Flag size={18} color="#10b981" />, iconBg: "#ecfdf5",
          label: "Mis reportes",
          sub: stats
            ? stats.reports === 0 ? "Sin reportes aún"
            : `${stats.reports} reporte${stats.reports !== 1 ? "s" : ""} enviado${stats.reports !== 1 ? "s" : ""}`
            : "Lugares que reportaste",
          sheet: "reportes",
        },
      ],
    },
    {
      title: "Información del campus",
      items: [
        { icon: <BookOpen size={18} color="#f59e0b" />, iconBg: "#fffbeb", label: "Reglamento de uso", sub: "Normas del estacionamiento UCC", sheet: "reglamento" },
        { icon: <MapPin size={18} color="#f59e0b" />,   iconBg: "#fffbeb", label: "Zonas del campus",  sub: "A · B · C · D · E · F · G · capacidades", sheet: "zonas" },
        { icon: <Clock size={18} color="#f59e0b" />,    iconBg: "#fffbeb", label: "Horarios",          sub: "Lun–Vie 7 h – 22 h · Sáb 8 h – 14 h", sheet: "horarios" },
      ],
    },
    {
      title: "Soporte",
      items: [
        { icon: <HelpCircle size={18} color="#6366f1" />,  iconBg: "#eef2ff", label: "Centro de ayuda",     sub: "Preguntas frecuentes", sheet: "ayuda" },
        { icon: <AlertCircle size={18} color="#6366f1" />, iconBg: "#eef2ff", label: "Reportar un problema", sub: "Bugs o errores en la app", sheet: "problema" },
        { icon: <Mail size={18} color="#6366f1" />,        iconBg: "#eef2ff", label: "Contacto",             sub: "sistemas@ucc.edu.ar", sheet: "contacto" },
      ],
    },
  ];

  const sheetTitles: Record<NonNullable<SheetId>, string> = {
    historial: "Historial de uso", reportes: "Mis reportes",
    reglamento: "Reglamento de uso", zonas: "Zonas del campus",
    horarios: "Horarios", ayuda: "Centro de ayuda",
    problema: "Reportar un problema", contacto: "Contacto",
    perfil: "Editar perfil", notificaciones: "Notificaciones",
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Overlay oscuro */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closePanelAndGoBack} activeOpacity={1} />
      </Animated.View>

      {/* Panel lateral */}
      <Animated.View
        style={[
          styles.panel,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 16 },
          { transform: [{ translateX: slideX }] },
        ]}
      >
        {/* Header */}
        <View style={styles.panelHeader}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? "?"}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.userName}>{user?.name ?? "Usuario"}</Text>
            <Text style={styles.userRole}>{user?.email ?? ""}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={closePanelAndGoBack} activeOpacity={0.75}>
            <X size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          {statsLoading ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color="#4f46e5" />
              <Text style={styles.statsLoadingText}>Cargando…</Text>
            </View>
          ) : (
            <View style={styles.statsRow}>
              <StatChip icon={<Car size={15} color="#4f46e5" />} value={String(stats?.sessions ?? 0)} label="Sesiones" />
              <View style={styles.statsDivider} />
              <StatChip icon={<Timer size={15} color="#10b981" />} value={formatMinutes(stats?.totalMinutes ?? 0)} label="Tiempo total" />
              <View style={styles.statsDivider} />
              <StatChip icon={<Star size={15} color="#f59e0b" />} value={stats?.favoriteZone ? `Zona ${stats.favoriteZone}` : "—"} label="Favorita" />
              <View style={styles.statsDivider} />
              <StatChip icon={<Flag size={15} color="#6366f1" />} value={String(stats?.reports ?? 0)} label="Reportes" />
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Secciones */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionCard}>
                {section.items.map((item, i) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.menuItem, i < section.items.length - 1 && styles.menuItemBorder]}
                    onPress={() => open(item.sheet)}
                    activeOpacity={0.65}
                  >
                    <View style={[styles.menuItemIcon, item.iconBg ? { backgroundColor: item.iconBg } : {}]}>
                      {item.icon}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuItemLabel}>{item.label}</Text>
                      {item.sub && <Text style={styles.menuItemSub}>{item.sub}</Text>}
                    </View>
                    <ChevronRight size={16} color="#d1d5db" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
            <LogOut size={16} color="#ef4444" />
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>

          <View style={styles.versionWrap}>
            <Info size={13} color="#9ca3af" />
            <Text style={styles.versionText}>ParkIt UCC · v1.0.0</Text>
          </View>
        </ScrollView>
      </Animated.View>

      {/* ── Sheets de contenido ── */}
      {activeSheet && (
        <DetailSheet title={sheetTitles[activeSheet]} open={!!activeSheet} onClose={close}>
          {activeSheet === "reglamento"     && <ReglamentoContent />}
          {activeSheet === "zonas"          && <ZonasContent />}
          {activeSheet === "horarios"       && <HorariosContent />}
          {activeSheet === "ayuda"          && <AyudaContent />}
          {activeSheet === "contacto"       && <ContactoContent />}
          {activeSheet === "historial"      && user && <HistorialContent userId={user.id} />}
          {activeSheet === "reportes"       && user && <ReportesContent userId={user.id} />}
          {activeSheet === "perfil"         && (
            <View style={cnt.empty}>
              <User size={36} color="#e5e7eb" />
              <Text style={cnt.emptyText}>Próximamente</Text>
              <Text style={cnt.emptyHint}>La edición de perfil estará disponible en la próxima versión</Text>
            </View>
          )}
          {activeSheet === "notificaciones" && (
            <View style={cnt.empty}>
              <Bell size={36} color="#e5e7eb" />
              <Text style={cnt.emptyText}>Próximamente</Text>
              <Text style={cnt.emptyHint}>La configuración de notificaciones estará disponible en la próxima versión</Text>
            </View>
          )}
          {activeSheet === "problema"       && (
            <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
              <Text style={cnt.ruleBody}>
                Para reportar un bug o error en la app, escribinos a{" "}
                <Text
                  style={{ color: "#4f46e5", fontWeight: "600" }}
                  onPress={() => Linking.openURL("mailto:sistemas@ucc.edu.ar?subject=Bug%20ParkIt")}
                >
                  sistemas@ucc.edu.ar
                </Text>{" "}
                con el asunto "Bug ParkIt" e incluí una descripción del problema y, si podés, una captura de pantalla.
              </Text>
              <TouchableOpacity
                style={[styles.logoutBtn, { borderColor: "#c7d2fe", backgroundColor: "#eef2ff", marginTop: 20 }]}
                onPress={() => Linking.openURL("mailto:sistemas@ucc.edu.ar?subject=Bug%20ParkIt")}
              >
                <Mail size={16} color="#4f46e5" />
                <Text style={[styles.logoutText, { color: "#4f46e5" }]}>Enviar email</Text>
              </TouchableOpacity>
            </View>
          )}
        </DetailSheet>
      )}
    </View>
  );
}

// ─── estilos del panel ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  panel: {
    position: "absolute", right: 0, top: 0, bottom: 0, width: PANEL_W,
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 24,
  },
  panelHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 18 },
  avatarWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#4f46e5", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  userName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  userRole: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  statsCard: {
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: "#f8f7ff", borderRadius: 14,
    borderWidth: 1, borderColor: "#ede9fe",
    paddingVertical: 14, paddingHorizontal: 8,
  },
  statsLoading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 6 },
  statsLoadingText: { fontSize: 12, color: "#9ca3af" },
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  statChip: { flex: 1, alignItems: "center", gap: 4 },
  statIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
  statValue: { fontSize: 13, fontWeight: "700", color: "#111827", textAlign: "center" },
  statLabel: { fontSize: 10, color: "#9ca3af", textAlign: "center" },
  statsDivider: { width: 1, height: 36, backgroundColor: "#e5e7eb" },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginHorizontal: 20, marginTop: 12 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#9ca3af", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#f3f4f6", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 12, backgroundColor: "#fff" },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  menuItemIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: "#f5f3ff", alignItems: "center", justifyContent: "center" },
  menuItemLabel: { fontSize: 14, fontWeight: "600", color: "#111827" },
  menuItemSub: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 28, marginHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  logoutText: { fontSize: 14, fontWeight: "600", color: "#ef4444" },
  versionWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 16 },
  versionText: { fontSize: 12, color: "#9ca3af" },
});

// ─── estilos del sheet ────────────────────────────────────────────────────
const sheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  container: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SH * 0.82, paddingTop: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#e5e7eb", alignSelf: "center", marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  title: { fontSize: 17, fontWeight: "700", color: "#111827" },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
});

// ─── estilos de contenido ─────────────────────────────────────────────────
const cnt = StyleSheet.create({
  // reglamento
  ruleRow: { flexDirection: "row", gap: 12, marginBottom: 18 },
  ruleNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center", marginTop: 1 },
  ruleNumText: { fontSize: 13, fontWeight: "800", color: "#4f46e5" },
  ruleTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 3 },
  ruleBody: { fontSize: 13, color: "#6b7280", lineHeight: 19 },
  // zonas
  zoneRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  zoneBadge: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  zoneBadgeText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  zoneRowName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  zoneRowSub: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  zoneRowCap: { fontSize: 18, fontWeight: "800" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  totalLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  totalValue: { fontSize: 16, fontWeight: "800", color: "#111827" },
  // horarios / contacto
  scheduleCard: { backgroundColor: "#f9fafb", borderRadius: 14, borderWidth: 1, borderColor: "#f3f4f6", overflow: "hidden" },
  scheduleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13 },
  scheduleRowBorder: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  scheduleRowHighlight: { backgroundColor: "#eef2ff" },
  scheduleDay: { fontSize: 13, fontWeight: "600", color: "#374151" },
  scheduleTime: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  scheduleNote: { fontSize: 11, color: "#9ca3af", marginTop: 12, lineHeight: 16 },
  // faq
  faqRow: { paddingVertical: 14 },
  faqRowBorder: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  faqQ: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  faqQText: { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1, marginRight: 8 },
  faqA: { fontSize: 13, color: "#6b7280", lineHeight: 19, marginTop: 8 },
  // historial / reportes
  histRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  histIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  histTitle: { fontSize: 13, fontWeight: "600", color: "#111827" },
  histDate: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  histDuration: { fontSize: 12, fontWeight: "600", color: "#4f46e5" },
  // empty state
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyHint: { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 18 },
});
