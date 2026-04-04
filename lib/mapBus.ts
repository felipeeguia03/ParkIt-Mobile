/**
 * Bus de un solo disparo para pedirle al mapa que enfoque una zona.
 * Usa una variable de módulo en vez de estado React para evitar
 * re-renders del contexto y timing impredecible en useFocusEffect.
 */
import { ParkingZone } from "@/lib/parking-data";

export interface MapFocusRequest {
  zone: ParkingZone;
}

let pending: MapFocusRequest | null = null;

/** Llamar antes de navegar al tab del mapa */
export function requestMapFocus(zone: ParkingZone) {
  pending = { zone };
}

/** Llamar dentro de useFocusEffect — consume y limpia el pedido */
export function consumeMapFocus(): MapFocusRequest | null {
  const req = pending;
  pending = null;
  return req;
}
