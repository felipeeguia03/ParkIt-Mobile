# ParkIt — Análisis de Freezes del Mapa

> Documento técnico para revisión de equipo.
> Stack: React Native 0.76 (New Architecture / Fabric+JSI), Expo Router v3, react-native-maps, Supabase Realtime.

---

## 1. Contexto arquitectónico

```
Supabase DB
    │
    ├─ Realtime (WebSocket) ──► useParkingState.ts ──► ParkingContext.Provider
    │                                │                        │
    └─ REST (carga inicial)           │                  MapScreen (map.tsx)
                                      │                        │
                              zones: ParkingZone[]        CampusMap.tsx
                              (nuevo array en cada              │
                               actualización)             ZoneLayer (memo)
                                                          SpotsLayer (memo + custom comparator)
```

**Punto crítico**: `zones` es recreado en memoria en cada update (inmutabilidad funcional con `map()`).
Cada vez que cambia `zones`, **todos los componentes que lo reciben como prop re-renderizan**, a menos que sus memos los protejan.

**New Architecture (Fabric/JSI)**: el bridge JS↔Native es síncrono. Renderizar N polygons bloquea el hilo JS *y* el hilo de UI al mismo tiempo. No hay buffer. Cada `<Polygon>` nuevo es una operación bloqueante.

---

## 2. La cadena principal del freeze

### 2.1 Trigger: cualquier update de `zones`

`zones` cambia en estos eventos:
- Optimistic update al **reclamar** un lugar (`handleConfirmParking`)
- Optimistic update al **liberar** un lugar (`handleLeaveParking`)
- Optimistic update al **reportar** un lugar (`handleReportConfirm`, `handleReportSpotChange`)
- **Supabase Realtime** al recibir un cambio de otro usuario

Cada uno de estos llama a `setZones(...)` con un nuevo array.

### 2.2 La cadena completa (antes de los fixes)

```
setZones(newArray)
  │
  ▼
useParkingState re-renderiza
  │ → retorna nuevo objeto con nuevas referencias de funciones
  │   (handleSpotSelect, handleReportSpot, etc. son funciones inline)
  ▼
ParkingContext.Provider recibe nuevo value
  │ → React compara por referencia → siempre distinto → notifica a todos los consumers
  ▼
MapScreen (map.tsx) re-renderiza
  │ → baseHandleSpotSelect = nueva función (cada render)
  │ → handleSpotSelect (sin useCallback) = nueva función
  ▼
CampusMap recibe onSpotSelect con nueva referencia
  │
  ▼
handleSpotPress (useCallback con dep [onSpotSelect, onReportSpot])
  │ → deps cambiaron → nueva referencia de handleSpotPress
  ▼
SpotsLayer recibe onSpotPress con nueva referencia
  │ → memo comparator: prev.onSpotPress !== next.onSpotPress → return false
  │ → React DESCARTA el memo y re-renderiza
  ▼
SpotsLayer renderiza zone.spots.slice(0, renderCount)
  │ → renderCount está en su valor máximo (40, 60, etc.)
  │ → todos los <Polygon> + <Marker> se crean en UN SOLO frame síncrono
  ▼
Fabric/JSI: 40-60 operaciones nativas síncronas en el hilo de UI
  │
  ▼
FREEZE (200ms - 1s+)
```

### 2.3 La cadena con Realtime (el caso más frecuente en uso real)

```
Otro usuario reclama un lugar en zona B
  │
  ▼
Supabase WebSocket recibe UPDATE
  │
  ▼
setZones(updateOneSpot(prev, id, status))  ← [FIX 3: defer con InteractionManager]
  │
  ▼
[misma cadena 2.2]
  │
  ▼
FREEZE mientras el usuario está navegando el mapa
```

---

## 3. Escenarios de freeze identificados

### Escenario A: Entrar al mapa después de reclamar un lugar
**Flujo:**
1. Usuario reclama lugar desde HomeScreen
2. `handleConfirmParking` → optimistic `setZones` + `setUserParking`
3. Usuario toca "Ver en mapa" en `MyParkingCard`
4. `router.navigate('/(tabs)/map', { focusZoneId, t: Date.now() })`
5. Animación de navegación de tab
6. `InteractionManager.runAfterInteractions` espera la animación
7. Dispara: `setSpotRenderCount(0)`, `setFocusedZoneId(focusZoneId)`
8. RAF empieza a batchar spots (16 por frame)
9. **Supabase Realtime llega** con la confirmación del claim → `setZones` de nuevo
10. Cadena 2.2 → SpotsLayer memo falla → re-renderiza todos los spots a la vez
11. **FREEZE durante el batching**

### Escenario B: Cambiar de zona (Zona B → Zona C)
**Flujo:**
1. Usuario tiene Zona B enfocada, todos sus spots renderizados
2. Toca el polígono de Zona C
3. `handleZonePress` → `setSpotRenderCount(0)`, `setFocusedZoneId('C')`
4. RAF empieza a batchar spots de Zona C
5. Durante el batching, llega un update de Realtime (o el optimistic update del claim anterior)
6. Cadena 2.2 → SpotsLayer memo falla (por `onSpotPress`) → renderiza todos los spots de Zona C de golpe
7. **FREEZE**

**Bug específico (ya resuelto):** `spotRenderCount` de Zona B (40) no se reseteaba antes de cambiar `focusedZoneId`. El primer render de Zona C veía `renderCount=40` y renderizaba todos de golpe. Fix: `setSpotRenderCount(0)` y `setFocusedZoneId` en el mismo batch.

### Escenario C: Zoom in → números de spots aparecen
**Flujo:**
1. Usuario hace zoom hasta pasar `NUMBERS_ZOOM_THRESHOLD` (latitudeDelta < 0.0018)
2. `handleRegionChangeComplete` → `setShowNumbers(true)`
3. CampusMap re-renderiza
4. SpotsLayer memo: `prev.showNumbers !== next.showNumbers` → re-renderiza
5. Ahora renderiza N `<Polygon>` + N `<Marker>` (con número) de golpe
6. Los `<Marker>` con texto son más pesados que los `<Polygon>`
7. **FREEZE** (más pronunciado que solo polygons)

### Escenario D: Elegir lugar desde dashboard → volver al mapa
**Flujo:**
1. Usuario elige lugar desde HomeScreen (QuickSelect)
2. `handleConfirmParking` → `setZones` (optimistic) + `setUserParking`
3. Supabase Realtime: llega la confirmación → segundo `setZones`
4. Usuario toca "Ver en mapa"
5. Tab transition + InteractionManager
6. RAF batching empieza
7. Si el segundo Realtime llega durante el RAF → cadena 2.2 → FREEZE
8. Incluso si no llega Realtime, el `setShowNumbers` durante la animación del mapa puede disparar el Escenario C

### Escenario E: El freeze "silencioso" de Realtime en uso normal
**Flujo:**
1. Usuario navega el mapa con Zona X enfocada, todos los spots ya renderizados
2. Cualquier otro usuario en el mundo reclama o libera un lugar
3. Realtime → `setZones` → cadena 2.2 → SpotsLayer re-renderiza todos los spots
4. El usuario siente un "leve freeze" o "jank" sin acción de su parte
5. Si hay muchos usuarios simultáneos, esto puede ocurrir continuamente

---

## 4. Estado actual de los fixes

| Fix | Archivo | Descripción | Resuelve |
|-----|---------|-------------|----------|
| ✅ Fix 1a | `map.tsx` | `handleSpotSelect` en `useCallback` | Reduce frecuencia de cambio de referencia |
| ✅ Fix 1b | `map.tsx` | `geofenceStatusRef` para evitar `geofenceStatus` en deps | Elimina un trigger de nueva referencia |
| ✅ Fix 2 | `CampusMap.tsx` | `useMemo` para stats de zonas en `ZoneLayer` | Reduce cómputo en re-renders de `ZoneLayer` |
| ✅ Fix 3 | `useParkingState.ts` | Realtime defer con `InteractionManager` | Reduce colisión entre RAF y Realtime |
| ✅ Fix 4 | `CampusMap.tsx` | `useMemo` para `focusedZone` | Estabiliza referencia de la zona enfocada |
| ✅ Fix 5 | `CampusMap.tsx` | Refs para `onSpotSelect` y `onReportSpot`, deps vacíos en `handleSpotPress` | **Corta la cadena principal** |

### Por qué Fix 5 es el más importante

```
// ANTES (cadena abierta):
const handleSpotPress = useCallback((spot) => {
  onSpotSelect(zone, spot);   // onSpotSelect en deps
}, [onSpotSelect, onReportSpot]);   // ← cualquier cambio externo rompe el memo

// DESPUÉS (cadena cortada):
const onSpotSelectRef = useRef(onSpotSelect);
useEffect(() => { onSpotSelectRef.current = onSpotSelect; }, [onSpotSelect]);

const handleSpotPress = useCallback((spot) => {
  onSpotSelectRef.current(zone, spot);  // lee ref actual en el momento del press
}, []);  // ← deps vacíos = referencia permanentemente estable
```

Con deps vacíos, `handleSpotPress` **nunca cambia de referencia** durante el ciclo de vida del componente. El memo de `SpotsLayer` ya no puede fallar por este camino.

---

## 5. Causas raíz que AÚN no están resueltas

### 5.1 `SpotsLayer` re-renderiza todos los spots cuando cambia UN status

Cuando Realtime actualiza el status de un spot (e.g., spot A3 pasa a "occupied"):
```
zones actualiza → focusedZone actualiza (nuevo objeto via useMemo)
→ SpotsLayer memo: prev.zone.spots[2].status !== next.zone.spots[2].status → false
→ SpotsLayer re-renderiza con renderCount = MÁXIMO
→ 40-60 polygons se re-crean en un frame
```

Esto es "correcto" funcionalmente pero es pesado. No hay forma de hacer un "diff parcial" con `react-native-maps`.

**Posible fix:** separar los spots en sub-componentes individuales (`SpotPolygon`) cada uno con su propio memo, de modo que solo el spot que cambió re-renderice.

### 5.2 `ZoneLayer` re-renderiza en cada update de `zones`

`ZoneLayer` usa el memo por defecto (comparación superficial de props). `zones` es siempre un array nuevo → `ZoneLayer` siempre re-renderiza. Renderiza 7 polígonos + 7 markers en cada Realtime update.

**Posible fix:** custom comparator en `ZoneLayer` que compare solo los conteos de disponibilidad por zona, no referencias.

### 5.3 `useParkingState` retorna funciones inestables

Ninguna función en `useParkingState` está en `useCallback`. En cada re-render del hook, todas las funciones son nuevas referencias. Esto incluye `handleConfirmParking`, `handleLeaveParking`, `handleReportConfirm`, etc.

Aunque Fix 5 cortó la cadena hacia `SpotsLayer`, estas funciones inestables todavía causan re-renders innecesarios en `HomeScreen` y otros consumidores del contexto.

### 5.4 `showNumbers` dispara re-render total de spots

El zoom que activa números de spots (Escenario C) todavía renderiza todos los spots + todos los markers de golpe. No hay batching para este caso.

### 5.5 Doble update al reclamar un lugar (optimistic + Realtime)

```
handleConfirmParking:
  1. setZones (optimistic, A3 → "occupied")    ← render 1
  2. supabase.update(...)

Supabase Realtime (100-300ms después):
  3. setZones (A3 → "occupied" de nuevo)        ← render 2 innecesario
```

El render 2 es redundante pero ocurre igual. Con Fix 3 (InteractionManager defer), se posterga pero no se elimina.

---

## 6. Mapa de dependencias del freeze

```
Supabase Realtime / Optimistic Update
          │
          ▼
    setZones(newArray)                    ← ORIGEN
          │
    ┌─────┴──────────────────────────────────────────────┐
    │                                                    │
    ▼                                                    ▼
ZoneLayer re-renderiza                        useParkingState funciones nuevas
(14 polygons/markers)                                    │
[Fix pendiente: custom memo]                             ▼
                                            ParkingContext.Provider nuevo value
                                                         │
                                                         ▼
                                              MapScreen re-renderiza
                                                         │
                                            ┌────────────┴────────────────┐
                                            │                             │
                                            ▼                             ▼
                                   handleSpotSelect               handleReportSpot
                                   (useCallback)                  (useCallback)
                                   [Fix 1a ✅]                    [Fix 1b ✅]
                                            │
                                            ▼
                                   onSpotSelect prop → CampusMap
                                            │
                                            ▼
                                   onSpotSelectRef.current = fn    [Fix 5 ✅]
                                   handleSpotPress: deps=[]
                                            │
                                            ▼
                                   SpotsLayer: onSpotPress ESTABLE ← CADENA CORTADA

    Pero si status de un spot cambia:
    focusedZone (useMemo) → nuevo objeto
          │
          ▼
    SpotsLayer memo: zone.spots[i].status cambió → re-renderiza
          │
          ▼
    renderCount = MAX → todos los spots de golpe    ← FREEZE RESIDUAL
    [Fix pendiente: SpotPolygon individual memo]
```

---

## 7. Fixes pendientes recomendados (en orden de impacto)

### Fix A — `SpotPolygon` individual con memo (mayor impacto)

En vez de que `SpotsLayer` renderice todos los spots cuando uno cambia, extraer cada spot a su propio componente memoizado:

```tsx
const SpotPolygon = memo(function SpotPolygon({ spot, zone, idx, showNumbers, onPress }) {
  // Solo re-renderiza cuando el status de ESTE spot cambia
}, (prev, next) => prev.spot.status === next.spot.status && prev.showNumbers === next.showNumbers);
```

`SpotsLayer` iteraría sobre `zone.spots.slice(0, renderCount)` y renderizaría `<SpotPolygon>` por cada uno. Cuando Realtime actualiza el status del spot A3, solo el `<SpotPolygon key="A3">` re-renderiza — los otros 39 mantienen su memo.

### Fix B — Custom comparator en `ZoneLayer` (impacto medio)

```tsx
const ZoneLayer = memo(ZoneLayerFn, (prev, next) => {
  if (prev.focusedZoneId !== next.focusedZoneId) return false;
  if (prev.zones.length  !== next.zones.length)  return false;
  // Solo re-renderizar si el conteo de disponibles cambió en alguna zona
  return prev.zones.every((z, i) => {
    const nz = next.zones[i];
    return z.spots.filter(s => s.status === "available").length ===
           nz.spots.filter(s => s.status === "available").length;
  });
});
```

Esto evita que `ZoneLayer` re-renderice cuando el status de un spot cambia pero el conteo de disponibles de la zona se mantiene (e.g., reported → occupied, misma zona).

### Fix C — `useCallback` en `useParkingState` para handlers principales

Aplicar `useCallback` a `handleSpotSelect`, `handleReportSpot`, `handleConfirmParking`, `handleLeaveParking`. Esto estabiliza el value del contexto y reduce renders innecesarios en todos los consumers.

### Fix D — Batching de `showNumbers` (impacto menor)

Cuando `showNumbers` cambia a `true`, hacer el mismo batching incremental que para `focusedZoneId`:

```tsx
useEffect(() => {
  if (!showNumbers || !focusedZone) return;
  // RAF batch para agregar markers de números progresivamente
}, [showNumbers]);
```

### Fix E — Deduplicar Realtime vs optimistic update

Guardar el `spot_id` del último optimistic update y skipear el primer Realtime que llega con el mismo valor:

```tsx
const pendingOptimistic = useRef<Set<string>>(new Set());

// Al hacer optimistic update:
pendingOptimistic.current.add(spotId);

// En el handler de Realtime:
if (pendingOptimistic.current.has(id)) {
  pendingOptimistic.current.delete(id);
  return; // skip: ya aplicamos este update
}
setZones(...);
```

---

## 8. Resumen ejecutivo para el equipo

| Problema | Causa | Estado |
|----------|-------|--------|
| Freeze al entrar al mapa después de elegir lugar | `onSpotPress` inestable → memo de SpotsLayer falla → 40-60 polygons en un frame | ✅ Cortado con ref trick (Fix 5) |
| Freeze al cambiar de zona | `spotRenderCount` no se reseteaba antes de cambiar zona | ✅ Resuelto |
| Freeze al hacer zoom | `showNumbers=true` → todos los spots + markers de golpe | ⚠️ Pendiente Fix D |
| Freeze por Realtime en uso normal | Un status cambia → SpotsLayer re-renderiza todos los spots | ⚠️ Pendiente Fix A |
| Re-renders innecesarios de ZoneLayer | `zones` siempre es array nuevo | ⚠️ Pendiente Fix B |
| Double render optimistic + Realtime | Mismo update aplicado dos veces | ⚠️ Pendiente Fix E |

**La arquitectura correcta a largo plazo** es Fix A (SpotPolygon individual). Es la que elimina el freeze residual de forma estructural: en vez de re-renderizar N spots cuando 1 cambia, re-renderiza exactamente 1.
