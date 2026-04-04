#!/usr/bin/env node
/**
 * Corre los tests con --json, luego genera test-report.html.
 *
 * Uso:
 *   node scripts/generate-test-report.js              # lib + hooks + components
 *   node scripts/generate-test-report.js --integration # lib + hooks + components + integration (requiere: supabase start)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const JSON_OUT = path.join(ROOT, "test-results.json");
const HTML_OUT = path.join(ROOT, "test-report.html");

const E2E_FLOWS = [
  { name: "login.yaml",      description: "Login con credenciales @ucc.edu.ar · verifica pantalla principal con zonas" },
  { name: "claim-spot.yaml", description: "Seleccionar lugar del carrusel → confirmar → verificar card activa → liberar" },
  { name: "report-spot.yaml",description: "Ir a pestaña Reportar → seleccionar spot → elegir tipo → confirmar envío" },
];

const LOAD_SCRIPTS = [
  { name: "concurrent-reads.js", description: "50 VUs leyendo parking_spots · rampa 30s → sostenido 1m · threshold: p95 < 800ms, errors < 1%" },
  { name: "claim-release.js",    description: "20 VUs claim + release concurrente en zona B · threshold: errors < 2% por tipo, p95 < 1200ms" },
];

const runIntegration = process.argv.includes("--integration");
const noOpen         = process.argv.includes("--no-open");
// --skip-jest: el orquestador ya corrió Jest y escribió test-results.json
const skipJest       = process.argv.includes("--skip-jest");
const projects = runIntegration
  ? "--selectProjects lib hooks components integration"
  : "--selectProjects lib hooks components";

// ── 1. Correr jest (salvo que el orquestador ya lo hizo) ───────────────────
if (skipJest) {
  console.log("⏭  Usando test-results.json existente.\n");
} else {
  console.log(`⏳  Corriendo tests (${runIntegration ? "lib + hooks + components + integration" : "lib + hooks + components"})...\n`);
  if (runIntegration) {
    console.log("⚠️   Integration tests requieren: supabase start\n");
  }
  try {
    execSync(`npx jest ${projects} --json --outputFile="${JSON_OUT}"`, {
      cwd: ROOT,
      stdio: ["ignore", "inherit", "inherit"],
    });
  } catch {
    // Jest devuelve exit code != 0 si hay failures; queremos generar el reporte igual.
  }
}

// ── 2. Leer resultados ────────────────────────────────────────────────────
if (!fs.existsSync(JSON_OUT)) {
  console.error("❌  No se generó test-results.json");
  process.exit(1);
}
const results = JSON.parse(fs.readFileSync(JSON_OUT, "utf8"));

// ── 3. Generar HTML ───────────────────────────────────────────────────────
const html = buildHTML(results, runIntegration);
fs.writeFileSync(HTML_OUT, html, "utf8");
console.log(`\n✅  Reporte generado: ${HTML_OUT}`);

// Abrir en el navegador (macOS) — salvo que se pase --no-open
if (!noOpen) {
  try { execSync(`open "${HTML_OUT}"`); } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────

function buildHTML(data, integrationRan) {
  const passed   = data.numPassedTests;
  const failed   = data.numFailedTests;
  const total    = data.numTotalTests;
  const success  = data.success;
  const pct      = total > 0 ? Math.round((passed / total) * 100) : 0;
  const date     = new Date(data.startTime).toLocaleString("es-AR");
  const duration = data.testResults.reduce((acc, s) => acc + (s.endTime - s.startTime), 0);
  const durationStr = duration >= 1000
    ? `${(duration / 1000).toFixed(2)} s`
    : `${duration} ms`;

  const suites = data.testResults.map((suite) => {
    const filePath = suite.name || suite.testFilePath || "";
    const relPath  = filePath.replace(ROOT, "").replace(/^[/\\]/, "");
    const project  = relPath.includes("__tests__/integration")
      ? "integration"
      : relPath.includes("__tests__/components")
        ? "components"
        : relPath.includes("__tests__/lib")
          ? "lib"
          : "hooks";
    const suiteName   = path.basename(filePath, path.extname(filePath));
    const suitePassed = suite.assertionResults.filter((t) => t.status === "passed").length;
    const suiteFailed = suite.assertionResults.filter((t) => t.status === "failed").length;
    return { relPath, project, suiteName, suitePassed, suiteFailed, tests: suite.assertionResults };
  });

  // Orden: lib → hooks → components → integration
  const projectOrder = { lib: 0, hooks: 1, components: 2, integration: 3 };
  suites.sort((a, b) => {
    const po = projectOrder[a.project] - projectOrder[b.project];
    return po !== 0 ? po : a.suiteName.localeCompare(b.suiteName);
  });

  const suitesHTML = suites.map((suite) => buildSuiteHTML(suite)).join("\n");

  const integrationNote = !integrationRan
    ? `<div class="info-banner">
        <span>ℹ️</span>
        <span>Tests de integración no corrieron en este reporte.
          Ejecutá <code>node scripts/generate-test-report.js --integration</code>
          (requiere <code>supabase start</code>).</span>
      </div>`
    : "";

  // Secciones estáticas — E2E y Load no pasan por Jest
  const e2eHTML   = buildStaticSection("e2e",  "E2E · Maestro",   E2E_FLOWS);
  const loadHTML  = buildStaticSection("load", "Load · k6",       LOAD_SCRIPTS);

  return /* html */`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ParkIt · Test Report</title>
<style>
  :root {
    --green:       #22c55e;
    --red:         #ef4444;
    --yellow:      #f59e0b;
    --blue:        #3b82f6;
    --slate:       #64748b;
    --bg:          #0f172a;
    --card:        #1e293b;
    --border:      #334155;
    --text:        #f1f5f9;
    --muted:       #94a3b8;
    --lib:         #818cf8;
    --hooks:       #34d399;
    --components:  #fb923c;
    --integration: #f97316;
    --e2e:         #a78bfa;
    --load:        #38bdf8;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: var(--bg); color: var(--text);
    padding: 2rem 1.5rem; min-height: 100vh;
  }
  h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.5px; }
  .subtitle { color: var(--muted); font-size: 0.875rem; margin-top: 0.25rem; }

  /* Info banner */
  .info-banner {
    display: flex; align-items: flex-start; gap: 0.6rem;
    background: #3b82f615; border: 1px solid #3b82f640;
    border-radius: 10px; padding: 0.75rem 1rem;
    font-size: 0.82rem; color: var(--muted);
    margin-bottom: 1.5rem;
  }
  .info-banner code {
    font-family: monospace; background: #ffffff10;
    padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.78rem;
    color: var(--text);
  }

  /* Summary bar */
  .summary {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem; margin: 2rem 0;
  }
  .stat-card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; padding: 1.25rem 1rem; text-align: center;
  }
  .stat-card .value { font-size: 2rem; font-weight: 800; line-height: 1; }
  .stat-card .label { font-size: 0.75rem; color: var(--muted); margin-top: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-card.pass  .value { color: var(--green); }
  .stat-card.fail  .value { color: var(--red); }
  .stat-card.total .value { color: var(--blue); }
  .stat-card.time  .value { font-size: 1.4rem; color: var(--yellow); }

  /* Progress bar */
  .progress-wrap { margin-bottom: 2rem; }
  .progress-label { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--muted); margin-bottom: 0.5rem; }
  .progress-bar { height: 8px; border-radius: 4px; background: var(--border); overflow: hidden; }
  .progress-fill {
    height: 100%; border-radius: 4px;
    background: ${success ? "var(--green)" : "var(--red)"};
    width: ${pct}%; transition: width 0.6s ease;
  }

  /* Section dividers */
  .section-label {
    font-size: 0.7rem; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.1em;
    margin: 2rem 0 0.75rem; padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }

  /* Project badges */
  .projects { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
  .proj-badge {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.3rem 0.75rem; border-radius: 999px; font-size: 0.75rem;
    font-weight: 600; border: 1px solid;
    cursor: default; transition: opacity 0.15s;
  }
  .proj-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .proj-badge.lib         { color: var(--lib);         border-color: var(--lib);         background: #818cf820; }
  .proj-badge.hooks       { color: var(--hooks);       border-color: var(--hooks);       background: #34d39920; }
  .proj-badge.components  { color: var(--components);  border-color: var(--components);  background: #fb923c20; }
  .proj-badge.integration { color: var(--integration); border-color: var(--integration); background: #f9731620; }
  .proj-badge.e2e         { color: var(--e2e);         border-color: var(--e2e);         background: #a78bfa20; }
  .proj-badge.load        { color: var(--load);        border-color: var(--load);        background: #38bdf820; }

  /* Suite cards */
  .suite {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; margin-bottom: 1rem; overflow: hidden;
  }
  .suite-header {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.9rem 1.25rem; cursor: pointer; user-select: none;
  }
  .suite-header:hover { background: #ffffff08; }
  .suite-icon   { font-size: 1rem; flex-shrink: 0; }
  .suite-name   { font-weight: 600; font-size: 0.95rem; flex: 1; }
  .suite-path   { font-size: 0.7rem; color: var(--muted); }
  .suite-counts { display: flex; gap: 0.5rem; font-size: 0.78rem; flex-shrink: 0; }
  .count-pass   { color: var(--green); font-weight: 600; }
  .count-fail   { color: var(--red);   font-weight: 600; }
  .chevron { color: var(--muted); transition: transform 0.2s; flex-shrink: 0; }
  .suite.open .chevron { transform: rotate(180deg); }
  .suite-proj {
    font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem;
    border-radius: 999px; flex-shrink: 0;
  }
  .suite-proj.lib         { color: var(--lib);         background: #818cf820; }
  .suite-proj.hooks       { color: var(--hooks);       background: #34d39920; }
  .suite-proj.components  { color: var(--components);  background: #fb923c20; }
  .suite-proj.integration { color: var(--integration); background: #f9731620; }
  .suite-proj.e2e         { color: var(--e2e);         background: #a78bfa20; }
  .suite-proj.load        { color: var(--load);        background: #38bdf820; }

  /* Test list */
  .suite-body { display: none; border-top: 1px solid var(--border); }
  .suite.open .suite-body { display: block; }
  .describe-group { padding: 0.5rem 0; }
  .describe-title {
    font-size: 0.72rem; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.06em;
    padding: 0.5rem 1.25rem 0.25rem;
  }
  .test-row {
    display: flex; align-items: flex-start; gap: 0.75rem;
    padding: 0.5rem 1.25rem; font-size: 0.84rem;
    border-bottom: 1px solid #ffffff06;
  }
  .test-row:last-child { border-bottom: none; }
  .test-dot {
    width: 8px; height: 8px; border-radius: 50%;
    flex-shrink: 0; margin-top: 0.35rem;
  }
  .test-dot.passed  { background: var(--green);  box-shadow: 0 0 6px #22c55e60; }
  .test-dot.failed  { background: var(--red);    box-shadow: 0 0 6px #ef444460; }
  .test-dot.pending { background: var(--yellow); }
  .test-dot.manual  { background: var(--slate);  }
  .test-title    { flex: 1; line-height: 1.4; }
  .test-duration { font-size: 0.72rem; color: var(--muted); flex-shrink: 0; margin-top: 0.15rem; }
  .test-meta     { font-size: 0.72rem; color: var(--muted); flex-shrink: 0; margin-top: 0.15rem; font-style: italic; }
  .test-error {
    margin-top: 0.4rem; padding: 0.6rem 0.8rem;
    background: #ef444415; border-left: 3px solid var(--red);
    border-radius: 4px; font-family: monospace; font-size: 0.75rem;
    color: #fca5a5; white-space: pre-wrap; word-break: break-word;
  }

  /* Manual badge inside test row */
  .badge-manual {
    font-size: 0.62rem; font-weight: 700; padding: 0.1rem 0.4rem;
    border-radius: 4px; background: #64748b30; color: var(--muted);
    flex-shrink: 0; margin-top: 0.15rem; align-self: flex-start;
  }

  /* Footer */
  footer { margin-top: 3rem; text-align: center; color: var(--muted); font-size: 0.75rem; }
</style>
</head>
<body>

<h1>ParkIt · Test Report</h1>
<p class="subtitle">Generado el ${date}</p>

<div class="summary">
  <div class="stat-card total">
    <div class="value">${total}</div>
    <div class="label">Tests Jest</div>
  </div>
  <div class="stat-card pass">
    <div class="value">${passed}</div>
    <div class="label">Pasaron</div>
  </div>
  <div class="stat-card fail">
    <div class="value">${failed}</div>
    <div class="label">Fallaron</div>
  </div>
  <div class="stat-card time">
    <div class="value">${durationStr}</div>
    <div class="label">Duración</div>
  </div>
</div>

<div class="progress-wrap">
  <div class="progress-label">
    <span>${success ? "Todos los tests pasaron ✓" : `${failed} test${failed !== 1 ? "s" : ""} fallaron`}</span>
    <span>${pct}%</span>
  </div>
  <div class="progress-bar"><div class="progress-fill"></div></div>
</div>

${integrationNote}

<div class="projects">
  <div class="proj-badge lib"><span class="dot"></span> lib — lógica pura</div>
  <div class="proj-badge hooks"><span class="dot"></span> hooks — React Native</div>
  <div class="proj-badge components"><span class="dot"></span> components — UI</div>
  <div class="proj-badge integration"><span class="dot"></span> integration — Supabase local</div>
  <div class="proj-badge e2e"><span class="dot"></span> E2E — Maestro</div>
  <div class="proj-badge load"><span class="dot"></span> Load — k6</div>
</div>

<div class="section-label">Unit &amp; Integration — Jest</div>
${suitesHTML}

<div class="section-label">End-to-End — Maestro <span style="font-weight:400;color:var(--muted)">(ejecución manual)</span></div>
${e2eHTML}

<div class="section-label">Load Tests — k6 <span style="font-weight:400;color:var(--muted)">(ejecución manual)</span></div>
${loadHTML}

<footer>ParkIt UCC · Jest ${data.numTotalTestSuites} suites · ${total} tests · 3 flujos E2E · 2 scripts de carga</footer>

<script>
  document.querySelectorAll('.suite-header').forEach(header => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('open');
    });
  });
  document.querySelectorAll('.suite').forEach(suite => {
    if (suite.querySelector('.test-dot.failed')) {
      suite.classList.add('open');
    }
  });
</script>
</body>
</html>`;
}

// ── Suite card (Jest) ─────────────────────────────────────────────────────

function buildSuiteHTML(suite) {
  const { suiteName, relPath, project, suitePassed, suiteFailed, tests } = suite;
  const icon      = suiteFailed > 0 ? "✗" : "✓";
  const iconStyle = suiteFailed > 0 ? "color:var(--red)" : "color:var(--green)";

  const groups = new Map();
  for (const t of tests) {
    const group = t.ancestorTitles[0] ?? "(sin describe)";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(t);
  }

  const groupsHTML = [...groups.entries()].map(([groupName, groupTests]) => {
    const testsHTML = groupTests.map((t) => {
      const dotClass   = t.status === "passed" ? "passed" : t.status === "failed" ? "failed" : "pending";
      const dur        = t.duration != null ? `${t.duration}ms` : "";
      const errorHTML  = t.failureMessages && t.failureMessages.length
        ? `<div class="test-error">${escapeHTML(t.failureMessages[0].slice(0, 600))}</div>`
        : "";
      return `
        <div class="test-row">
          <span class="test-dot ${dotClass}"></span>
          <span class="test-title">${escapeHTML(t.title)}${errorHTML}</span>
          <span class="test-duration">${dur}</span>
        </div>`;
    }).join("");

    return `
      <div class="describe-group">
        <div class="describe-title">${escapeHTML(groupName)}</div>
        ${testsHTML}
      </div>`;
  }).join("");

  return `
    <div class="suite">
      <div class="suite-header">
        <span class="suite-icon" style="${iconStyle}">${icon}</span>
        <span class="suite-proj ${project}">${project}</span>
        <span class="suite-name">${escapeHTML(suiteName)}<br/><span class="suite-path">${escapeHTML(relPath)}</span></span>
        <span class="suite-counts">
          <span class="count-pass">${suitePassed} ✓</span>
          ${suiteFailed > 0 ? `<span class="count-fail">${suiteFailed} ✗</span>` : ""}
        </span>
        <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="suite-body">${groupsHTML}</div>
    </div>`;
}

// ── Static section (E2E / Load) ───────────────────────────────────────────

function buildStaticSection(project, label, items) {
  const rowsHTML = items.map((item) => `
    <div class="test-row">
      <span class="test-dot manual"></span>
      <span class="test-title">
        ${escapeHTML(item.name)}
        <br/><span style="font-size:0.72rem;color:var(--muted)">${escapeHTML(item.description)}</span>
      </span>
      <span class="badge-manual">manual</span>
    </div>`).join("");

  return `
    <div class="suite open">
      <div class="suite-header">
        <span class="suite-icon" style="color:var(--slate)">○</span>
        <span class="suite-proj ${project}">${project}</span>
        <span class="suite-name">${escapeHTML(label)}<br/><span class="suite-path">${project === "e2e" ? "flows/" : "load-tests/"}</span></span>
        <span class="suite-counts">
          <span style="color:var(--slate);font-size:0.78rem">${items.length} scripts</span>
        </span>
        <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="suite-body" style="display:block">
        <div class="describe-group">
          ${rowsHTML}
        </div>
      </div>
    </div>`;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
