#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run-all-tests.sh  ·  ParkIt UCC
#
# Corre la suite completa:
#   lib + hooks + components  →  siempre
#   integration               →  solo si Supabase local está disponible
#
# Uso:
#   bash scripts/run-all-tests.sh           # intenta levantar Supabase
#   bash scripts/run-all-tests.sh --skip-db # omite integración (solo Jest unit)
#   bash scripts/run-all-tests.sh --no-open # no abre el reporte en el browser
#
# Salida:
#   test-results.json  — datos crudos de Jest
#   test-report.html   — reporte visual
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKIP_DB=false
OPEN_REPORT=true
SUPABASE_STARTED_BY_US=false

# ── Parse flags ───────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --skip-db)   SKIP_DB=true   ;;
    --no-open)   OPEN_REPORT=false ;;
  esac
done

# ── Colores ───────────────────────────────────────────────────────────────────
bold="\033[1m"
green="\033[0;32m"
yellow="\033[0;33m"
red="\033[0;31m"
cyan="\033[0;36m"
reset="\033[0m"

log()  { echo -e "${cyan}▸${reset} $*"; }
ok()   { echo -e "${green}✓${reset} $*"; }
warn() { echo -e "${yellow}⚠${reset}  $*"; }
err()  { echo -e "${red}✗${reset} $*"; }
hr()   { echo -e "${bold}────────────────────────────────────────${reset}"; }

hr
echo -e "${bold}ParkIt · Suite completa de tests${reset}"
hr

# ── 1. Verificar herramientas básicas ─────────────────────────────────────────
if ! command -v node &>/dev/null; then
  err "node no encontrado. Instalá Node.js primero."
  exit 1
fi
if ! command -v npx &>/dev/null; then
  err "npx no encontrado."
  exit 1
fi

# ── 2. Supabase local ─────────────────────────────────────────────────────────
RUN_INTEGRATION=false

if [ "$SKIP_DB" = true ]; then
  warn "Modo --skip-db: omitiendo tests de integración."
else
  # Verificar que supabase CLI esté instalado
  if ! command -v supabase &>/dev/null; then
    warn "supabase CLI no encontrado (brew install supabase/tap/supabase)."
    warn "Omitiendo tests de integración."
  # Verificar que el proyecto esté inicializado
  elif [ ! -f "$ROOT/supabase/config.toml" ]; then
    warn "supabase no inicializado en este proyecto."
    warn "Corré: supabase init && supabase db push --local"
    warn "Omitiendo tests de integración."
  else
    # Verificar si ya está corriendo
    if supabase status --workdir "$ROOT" 2>/dev/null | grep -q "API URL"; then
      ok "Supabase ya está corriendo."
      RUN_INTEGRATION=true
    else
      log "Levantando Supabase local..."
      if supabase start --workdir "$ROOT" 2>&1; then
        ok "Supabase iniciado."
        SUPABASE_STARTED_BY_US=true
        RUN_INTEGRATION=true
      else
        warn "No se pudo iniciar Supabase. Omitiendo tests de integración."
      fi
    fi
  fi
fi

# ── 3. Correr Jest ────────────────────────────────────────────────────────────
hr
if [ "$RUN_INTEGRATION" = true ]; then
  log "Corriendo: lib + hooks + components + integration..."
  JEST_PROJECTS="--selectProjects lib hooks components integration"
  REPORT_FLAG="--integration"
else
  log "Corriendo: lib + hooks + components..."
  JEST_PROJECTS="--selectProjects lib hooks components"
  REPORT_FLAG=""
fi

# Jest devuelve exit code != 0 si hay failures — capturamos pero no abortamos
JEST_EXIT=0
npx jest $JEST_PROJECTS \
  --no-coverage \
  --json \
  --outputFile="$ROOT/test-results.json" \
  2>&1 || JEST_EXIT=$?

# ── 4. Generar reporte HTML ───────────────────────────────────────────────────
hr
log "Generando test-report.html..."
set +e
node "$ROOT/scripts/generate-test-report.js" $REPORT_FLAG --skip-jest --no-open 2>&1
REPORT_EXIT=$?
set -e

if [ $REPORT_EXIT -eq 0 ]; then
  ok "Reporte generado: $ROOT/test-report.html"
else
  err "Error generando el reporte."
fi

# ── 5. Detener Supabase si lo levantamos nosotros ────────────────────────────
if [ "$SUPABASE_STARTED_BY_US" = true ]; then
  log "Deteniendo Supabase (fue levantado por este script)..."
  supabase stop --workdir "$ROOT" 2>/dev/null || true
  ok "Supabase detenido."
fi

# ── 6. Abrir reporte ──────────────────────────────────────────────────────────
if [ "$OPEN_REPORT" = true ] && [ -f "$ROOT/test-report.html" ]; then
  if command -v open &>/dev/null; then
    open "$ROOT/test-report.html"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$ROOT/test-report.html"
  fi
fi

# ── 7. Resumen final ──────────────────────────────────────────────────────────
hr
if [ $JEST_EXIT -eq 0 ]; then
  ok "${bold}Todos los tests pasaron.${reset}"
else
  err "${bold}Hay tests fallidos. Revisá test-report.html.${reset}"
fi
hr

exit $JEST_EXIT
