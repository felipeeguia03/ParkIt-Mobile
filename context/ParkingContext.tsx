import { createContext, useContext, ReactNode } from "react";
import { useParkingState } from "@/hooks/useParkingState";

type ParkingContextType = ReturnType<typeof useParkingState>;

const ParkingContext = createContext<ParkingContextType | null>(null);

export function ParkingProvider({ children }: { children: ReactNode }) {
  const state = useParkingState();
  return (
    <ParkingContext.Provider value={state}>{children}</ParkingContext.Provider>
  );
}

export function useParkingContext() {
  const ctx = useContext(ParkingContext);
  if (!ctx) throw new Error("useParkingContext must be used inside ParkingProvider");
  return ctx;
}
