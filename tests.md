# ParkIt — Plan de Tests

Stack sugerido:
- **Unit / componentes**: Jest + React Native Testing Library (`@testing-library/react-native`)
- **E2E**: Maestro (YAML, más simple que Detox para Expo)
- **Profiling de renders**: `why-did-you-render` en dev + React DevTools Profiler

---

## Orden de implementación

```
Fase A — Lógica pura (sin RN, sin mapa)       ← empezar acá, más rápido
Fase B — Hooks                                 ← requiere mocks de Supabase y Auth
Fase C — Componentes de mapa (memo/render)     ← requiere mocks de react-native-maps
Fase D — E2E con Maestro                       ← requiere device o simulador
```

---

## Fase A — Lógica pura

### A1. `updateOneSpot` y `applyStatusMap`

```
archivo: __tests__/lib/parking-data.test.ts
```

| Test | Qué verifica |
|------|-------------|
| `updateOneSpot` cambia solo el spot correcto | Inmutabilidad: los demás spots no cambian referencia |
| `updateOneSpot` con spotId inexistente | No lanza, devuelve array idéntico |
| `applyStatusMap` con Map vacío | Devuelve zones idénticas |
| `applyStatusMap` actualiza múltiples spots en múltiples zonas | Aplicación correcta del Map |
| Los objetos no modificados conservan la misma referencia | Garantía de inmutabilidad parcial para memos |

**Por qué primero**: estas funciones son la base de todo. Un bug acá rompe silenciosamente el estado entero.

---

### A2. Comparadores de memo (puras funciones)

```
archivo: __tests__/components/memo-comparators.test.ts
```

Extraer los comparadores a funciones nombradas y exportarlas para poder testearlas directamente sin montar componentes.

#### ZoneLayer comparator

| Test | Qué verifica |
|------|-------------|
| Mismo array de zones → `true` (no re-renderizar) | Caso base |
| Un spot cambia de "occupied" a "reported" → `true` | No cambia conteo de disponibles → skip |
| Un spot cambia de "available" a "occupied" → `false` | Sí cambia conteo → re-renderizar |
| `focusedZoneId` cambia → `false` | Cambio de zona enfocada → re-renderizar |
| Largo de zones cambia → `false` | Caso extremo |

#### SpotsLayer comparator

| Test | Qué verifica |
|------|-------------|
| Mismo zone, mismo renderCount, mismo showNumbers → `true` | No re-renderizar |
| `renderCount` sube → `false` | RAF batch siguiente → re-renderizar |
| `showNumbers` cambia → `false` | Zoom → re-renderizar |
| `zone.id` cambia → `false` | Cambio de zona → re-renderizar |
| Un spot.status cambia → `false` | Actualización de Realtime → pasar props a SpotPolygon |
| Todos los statuses iguales, nueva referencia de zone → `true` | El caso crítico del freeze original |

#### SpotPolygon comparator

| Test | Qué verifica |
|------|-------------|
| Mismo status, mismo showNumbers → `true` | No re-renderizar |
| Status cambia → `false` | Solo este spot re-renderiza |
| showNumbers cambia → `false` | Zoom |
| Status igual pero nueva referencia de `spot` → `true` | Ignora cambio de referencia |

**Por qué en Fase A**: los comparadores son funciones puras. Se testean sin React, sin mocks, en milisegundos. Son la garantía más directa de que los memos funcionan.

---

### A3. Deduplicación optimistic + Realtime

```
archivo: __tests__/hooks/deduplication.test.ts
```

Testear la lógica del `pendingOptimistic` Map aislada:

| Test | Qué verifica |
|------|-------------|
| Realtime llega con mismo status que optimistic → update ignorado | Fix 2b: no doble render |
| Realtime llega con status distinto → update aplicado | El servidor corrigió → respetar |
| Dos spots en vuelo simultáneo → cada uno deduplica independientemente | No colisión entre spots |
| Realtime llega sin optimistic pendiente → update aplicado normalmente | Caso de otro usuario |

---

## Fase B — Hooks

### B1. `useParkingState` — estabilidad de handlers

```
archivo: __tests__/hooks/useParkingState.test.tsx
```

Mocks necesarios: `supabase` (jest mock), `useAuth` (devuelve `{ user: { id: 'u1' } }`).

| Test | Qué verifica |
|------|-------------|
| `handleSpotSelect` mantiene la misma referencia tras un `setZones` | Fase 2a: deps vacíos |
| `handleReportSpot` mantiene la misma referencia tras un `setZones` | Idem |
| `handleConfirmParking` mantiene referencia cuando zones cambia | Solo cambia si `user` cambia |
| `handleLeaveParking` mantiene referencia cuando zones cambia | Idem |
| `handleSpotSelect` con `userParking` activo → muestra Alert, no abre modal | Lógica de negocio |
| `handleSpotSelect` con spot "occupied" → no abre modal | Guard correcto |
| `handleConfirmParking` registra en `pendingOptimistic` antes del `setZones` | Orden correcto |
| `handleLeaveParking` limpia `userParking` y registra en `pendingOptimistic` | Idem |

**Cómo medir referencia estable**:
```tsx
const { result, rerender } = renderHook(() => useParkingState());
const ref1 = result.current.handleSpotSelect;
// forzar re-render con nuevo zones
act(() => result.current.setZones([...newZones]));
const ref2 = result.current.handleSpotSelect;
expect(ref1).toBe(ref2); // misma referencia
```

---

### B2. `useParkingState` — flujo de estacionamiento

```
archivo: __tests__/hooks/useParkingState-flow.test.tsx
```

| Test | Qué verifica |
|------|-------------|
| `handleConfirmParking` → `userParking` se setea correctamente | Estado post-claim |
| `handleConfirmParking` → spot pasa a "occupied" en `zones` | Optimistic update |
| `handleConfirmParking` → llama a `supabase.update` con parámetros correctos | Side effect |
| `handleLeaveParking` → `userParking` vuelve a null | Liberar |
| `handleLeaveParking` → spot vuelve a "available" | Optimistic update inverso |
| `handleLeaveParking` → calcula `duration_minutes` correctamente | Aritmética de tiempo |
| Realtime con status ya aplicado por optimistic → `zones` no cambia | Fix 2b en integración |

---

### B3. `useParkingState` — Realtime

```
archivo: __tests__/hooks/useParkingState-realtime.test.tsx
```

| Test | Qué verifica |
|------|-------------|
| Simular payload de Realtime → `zones` actualiza correctamente | Happy path |
| Realtime durante optimistic pendiente con mismo status → `zones` no cambia | Deduplicación |
| Realtime durante optimistic pendiente con distinto status → `zones` sí cambia | Corrección del servidor |
| Dos Realtimes seguidos → ambos aplicados en orden | Sin pérdida de eventos |

---

## Fase C — Componentes de mapa

Mock necesario: `react-native-maps` (jest mock que renderiza `View` en lugar de componentes nativos).

### C1. `SpotPolygon` — re-renders

```
archivo: __tests__/components/SpotPolygon.test.tsx
```

| Test | Qué verifica |
|------|-------------|
| Render inicial con status "available" → color verde | Render correcto |
| Re-render con mismo status → no re-renderiza (spy en render) | Memo funciona |
| Re-render con status "occupied" → re-renderiza con color rojo | Memo falla correctamente |
| `showNumbers=true` → renderiza `<Marker>` con número | Lógica condicional |
| `showNumbers=false` → no renderiza `<Marker>` | Idem |
| `showNumbers` cambia → re-renderiza | Memo falla correctamente |

**Cómo contar renders**:
```tsx
let renderCount = 0;
jest.mock('../SpotPolygon', () => {
  return memo(function SpotPolygon(props) {
    renderCount++;
    return <View />;
  });
});
```

O usar `why-did-you-render` en modo test.

---

### C2. `SpotsLayer` — granularidad de re-renders

```
archivo: __tests__/components/SpotsLayer.test.tsx
```

| Test | Qué verifica |
|------|-------------|
| Un spot cambia status → solo ese `SpotPolygon` re-renderiza | El fix más importante: 1 vs N |
| `renderCount` sube de 0 a 16 → 16 `SpotPolygon` nuevos montados | RAF batch |
| `zone.id` cambia → todos los `SpotPolygon` se desmontan y remontan | Cambio de zona |
| Misma zona, mismos statuses, nueva referencia de `zone` → 0 re-renders | El caso del freeze original |

---

### C3. `ZoneLayer` — re-renders por disponibilidad

```
archivo: __tests__/components/ZoneLayer.test.tsx
```

| Test | Qué verifica |
|------|-------------|
| Spot pasa de "occupied" a "reported" → `ZoneLayer` no re-renderiza | Conteo no cambia |
| Spot pasa de "available" a "occupied" → `ZoneLayer` re-renderiza | Conteo cambia |
| `focusedZoneId` cambia → `ZoneLayer` re-renderiza | Color de zona enfocada |
| Estabilidad de `onZonePress` (useCallback vacío) | No causa re-renders |

---

### C4. `CampusMap` — flujo completo de foco

```
archivo: __tests__/components/CampusMap.test.tsx
```

| Test | Qué verifica |
|------|-------------|
| `focusZoneId` + `focusTimestamp` → `setFocusedZoneId` se llama después de InteractionManager | Timing correcto |
| Mismo `focusTimestamp` dos veces → lógica de foco se ejecuta solo una vez | `processedTimestamp` ref |
| `handleZonePress` → `spotRenderCount` se resetea a 0 | Sin herencia del count anterior |
| `handleRecenter` → `focusedZoneId` vuelve a null | Estado limpio |
| `handleSpotPress` llama a `onSpotSelect` para spot "available" | Delegación correcta |
| `handleSpotPress` llama a `onReportSpot` para spot "occupied" | Idem |
| `handleSpotPress` con `focusedZone` null → no hace nada | Guard |

---

## Fase D — E2E con Maestro

```
directorio: .maestro/
```

Maestro usa YAML y corre en simulador o device real. Más fácil de mantener que Detox para Expo.

### D1. Flujo de claim y liberación

```yaml
# .maestro/claim-and-release.yaml
```

| Paso | Verifica |
|------|---------|
| Login con credenciales de test | Auth funciona |
| Navegar al mapa → tocar zona A | ZoneLayer responde |
| Tocar spot disponible → confirmar | Claim flow completo |
| Verificar que el spot cambia a rojo | Optimistic update visible |
| Verificar que "Estás estacionado en" aparece en Home | Estado sincronizado |
| Tocar "Liberar lugar" | Release flow |
| Verificar que el spot vuelve a verde | Optimistic update inverso |
| **No debe haber freeze** (medir con `takeScreenshot` cada 500ms) | KPI principal |

---

### D2. "Ver en mapa" desde MyParkingCard

```yaml
# .maestro/ver-en-mapa.yaml
```

| Paso | Verifica |
|------|---------|
| Claim un spot desde Home | Estado inicial |
| Tocar "Ver en mapa" | Navegación con params |
| Esperar animación (1.5s) | InteractionManager completó |
| Verificar zona enfocada visible | `focusedZoneId` aplicado |
| Verificar que spots se cargan progresivamente | RAF batching visible |
| Volver a Home → tocar "Ver en mapa" de nuevo | Segunda navegación sin freeze |
| Repetir 3 veces con zonas distintas | Stress test de cambio de zona |

---

### D3. Realtime bajo carga simulada

```yaml
# .maestro/realtime-stress.yaml
```

Requiere un script Node que envíe 10 updates de Realtime vía Supabase en 5 segundos mientras el usuario navega el mapa.

| Paso | Verifica |
|------|---------|
| Abrir mapa, seleccionar zona | Estado inicial |
| Lanzar script de stress en paralelo | 10 updates/5s |
| Navegar entre zonas durante el stress | Sin freeze durante Realtime |
| Verificar que los colores de los spots actualizan | Updates llegan |
| Medir que ningún frame supera 32ms | KPI: 2 frames a 60fps |

---

### D4. Zoom y números de spots

```yaml
# .maestro/zoom-numbers.yaml
```

| Paso | Verifica |
|------|---------|
| Abrir mapa → seleccionar zona | Estado inicial |
| Hacer pinch-zoom hasta ver números | `showNumbers = true` |
| Verificar que los números aparecen progresivamente o de golpe sin freeze | Fase 3b pendiente |
| Hacer zoom out | `showNumbers = false` |
| Verificar que los números desaparecen | Estado limpio |

---

## Métricas de éxito por test

| Nivel | Métrica objetivo |
|-------|-----------------|
| Unit memo comparator | 100% de casos cubiertos, 0 falsos negativos |
| Handler estabilidad | Referencia idéntica tras 10 re-renders consecutivos |
| SpotPolygon granularidad | 1 re-render nativo al cambiar 1 spot de 40 |
| E2E claim flow | Completado en < 3s sin frame > 32ms |
| E2E Realtime stress | 10 updates aplicados, 0 freezes detectados |

---

## Setup mínimo para empezar

```bash
# Instalar dependencias de test
npx expo install jest-expo @testing-library/react-native @testing-library/jest-native

# Instalar Maestro (E2E)
curl -Ls "https://get.maestro.mobile.dev" | bash
```

`jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterFramework: ['@testing-library/jest-native/extend-expect'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    'react-native-maps': '<rootDir>/__mocks__/react-native-maps.tsx',
  },
};
```

Mock de `react-native-maps`:
```tsx
// __mocks__/react-native-maps.tsx
import { View } from 'react-native';
export default { ...jest.requireActual('react-native'), MapView: View };
export const Polygon  = (props: any) => null;
export const Marker   = (props: any) => null;
export const Polyline = (props: any) => null;
```

---

## Orden final recomendado

```
1. A2 — Comparadores de memo           (1-2h, impacto inmediato, sin setup)
2. A1 — updateOneSpot / applyStatusMap (1h)
3. A3 — Deduplicación                  (1h)
4. B1 — Estabilidad de handlers        (2-3h, requiere mock de Supabase)
5. B2 — Flujo de estacionamiento       (2h)
6. C2 — SpotsLayer granularidad        (2-3h, requiere mock de maps)
7. C1 — SpotPolygon renders            (1h)
8. C3 — ZoneLayer renders              (1h)
9. B3 — Realtime                       (2h)
10. C4 — CampusMap integración         (3h)
11. D1 — E2E claim/release             (2h, requiere Maestro instalado)
12. D2 — E2E "Ver en mapa"             (1h)
13. D3 — E2E Realtime stress           (3h, requiere script de stress)
14. D4 — E2E zoom                      (1h)
```

Total estimado: ~25-30h de trabajo de QA/dev.
Prioridad mínima viable (Fases A + B1 + C2): ~8h.
