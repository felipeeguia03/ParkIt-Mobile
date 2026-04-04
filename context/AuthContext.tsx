import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function mapUser(supabaseUser: SupabaseUser): User {
  const email = supabaseUser.email!;
  const namePart = email.split("@")[0];
  const fallbackName = namePart
    .split(".")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  return {
    id: supabaseUser.id,
    email,
    name: (supabaseUser.user_metadata?.name as string | undefined) ?? fallbackName,
    role: (supabaseUser.user_metadata?.role as "user" | "admin" | undefined) ?? "user",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carga la sesión persistida (AsyncStorage via Supabase)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ? mapUser(session.user) : null);
      setLoading(false);
    });

    // Escucha cambios de auth (login, logout, refresh de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ? mapUser(session.user) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const trimmed = email.trim().toLowerCase();

    if (!trimmed.endsWith("@ucc.edu.ar")) {
      return { success: false, error: "Usá tu mail institucional (@ucc.edu.ar)" };
    }
    if (password.length < 1) {
      return { success: false, error: "Ingresá tu contraseña" };
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
    setLoading(false);

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        return { success: false, error: "Email o contraseña incorrectos" };
      }
      return { success: false, error: "Error al conectar con el servidor" };
    }

    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
