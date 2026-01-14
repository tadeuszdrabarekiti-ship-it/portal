let baseDir = __dirname;
function setBaseDir(dir) {
  baseDir = dir;
}

// Update all file path references to use baseDir
const getSchedulerStateFile = () => path.join(baseDir, 'scheduler_state.json');
const getLogsDir = () => path.join(baseDir, 'logs');

// Patch saveSchedulerState to use baseDir
function saveSchedulerState() {
  try {
    fs.writeFileSync(getSchedulerStateFile(), JSON.stringify(schedulerState, null, 2), 'utf8');
  } catch (e) {
    console.error('[SCHEDULER] Błąd zapisu scheduler_state.json:', e);
  }
}

const path = require("path");
// --- GLOBALNE STAŁE ---
const constants = {};
const fs = require("fs");
const axios = require("axios");
const uid = require('./uid');
const crypto = require("crypto");

// Ładowanie flows z flows.json i flows/*.json
let flows = [];
const flowsDir = path.join(__dirname, "flows");
const flowsJsonPath = path.join(__dirname, "flows.json");
if (fs.existsSync(flowsJsonPath)) {
  try {
    const mainFlows = require(flowsJsonPath);
    if (Array.isArray(mainFlows)) flows = flows.concat(mainFlows);
  } catch (e) {
    console.error("[SCHEDULER] Błąd ładowania flows.json:", e);
  }
}
if (fs.existsSync(flowsDir)) {
  const files = fs.readdirSync(flowsDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const filePath = path.join(flowsDir, file);
      const fileFlows = require(filePath);
      const addFlow = flowObj => {
        // Dodaj do flows
        flows.push(flowObj);
        // Jeśli to CONST, dodaj do globalnych stałych
        if (flowObj.type && typeof flowObj.type === 'string' && flowObj.type.toUpperCase() === 'CONST' && flowObj.const && typeof flowObj.const === 'object') {
          for (const [k, v] of Object.entries(flowObj.const)) {
            constants[k] = v;
          }
        }
      };
      if (Array.isArray(fileFlows)) {
        fileFlows.forEach(addFlow);
      } else if (typeof fileFlows === 'object') {
        addFlow(fileFlows);
      }
    } catch (e) {
      console.error(`[SCHEDULER] Błąd ładowania ${file}:`, e);
    }
  }
  // Loguj zawartość constants po załadowaniu wszystkich flows
  console.log('[CONST-INIT] constants:', JSON.stringify(constants, null, 2));
}

// --- FUNKCJE CRON ---
function parseCronEntry(entry) {
  // Obsługa: "HH:MM:SS", "*:MM:SS", "*N" (co N minut)
  if (/^\d{2}:\d{2}:\d{2}$/.test(entry)) {
    const [h, m, s] = entry.split(":").map(Number);
    return { type: 'exact', h, m, s };
  }
  if (/^\*:(\d{2}):(\d{2})$/.test(entry)) {
    const [, m, s] = entry.split(":").map(Number);
    return { type: 'everyHourAt', m, s };
  }
  if (/^\*\d+$/.test(entry)) {
    const n = Number(entry.slice(1));
    return { type: 'everyNMinutes', n };
  }
  return null;
}

function getNextRun(cron, now) {
  // Zwraca lokalny czas jako string (DD-MM-YYYY HH:mm:ss)
  function formatLocalDateTime(d) {
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  let next;
  if (cron.type === 'exact') {
    next = new Date(now);
    next.setHours(cron.h, cron.m, cron.s, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (cron.type === 'everyHourAt') {
    next = new Date(now);
    next.setMinutes(cron.m, cron.s, 0);
    if (next <= now) {
      next.setHours(next.getHours() + 1);
    }
  } else if (cron.type === 'everyNMinutes') {
    next = new Date(now);
    const min = now.getMinutes();
    const add = cron.n - (min % cron.n);
    next.setMinutes(min + add, 0, 0);
    if (next <= now) next.setMinutes(next.getMinutes() + cron.n);
  } else {
    return null;
  }
  return formatLocalDateTime(next);
}


// --- SCHEDULER STATE ---
let schedulerState = [];
const { syncCronTable } = require('./sync_cron_table');

// Inicjalizacja stanu - wywołaj po wczytaniu flows z index.js
function initScheduler(loadedFlows) {
  // Aktualizuj flows w engine.js
  flows = loadedFlows || flows;
  loadSchedulerState();
}

// --- CYKLICZNY TICK SCHEDULERA ---
function parseLocalDateTime(str) {
  // "DD-MM-YYYY HH:mm:ss" => Date
  const [date, time] = str.split(' ');
  const [d, m, y] = date.split('-').map(Number);
  const [h, min, s] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, s);
}

setInterval(() => {
  const now = new Date();
  for (const job of schedulerState) {
    if (job.running) continue;
    if (parseLocalDateTime(job.nextRun) <= now) {
      job.running = true;
      job.traceId = uid('ccccccdd-ddccddcc-ccddccdd-cc');
      // Uruchom flow asynchronicznie
      (async () => {
        try {
          const d = new Date();
          const pad = n => n.toString().padStart(2, '0');
          const godzina = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          console.log(`[SCHEDULER] ${godzina} Uruchamiam: ${job.flowName} (${job.cronEntry}) traceId=${job.traceId}`);
          const flow = (Array.isArray(flows) ? flows : []).find(f => f.name === job.flowName);
          if (!flow) throw new Error('Nie znaleziono flow: ' + job.flowName);
          await executeFlow(flow, { params: {}, query: {}, body: {} }, { status: () => ({ json: () => {} }) }, { __traceId: job.traceId });
        } catch (e) {
          console.error(`[SCHEDULER] Błąd uruchamiania flow ${job.flowName}:`, e);
        } finally {
          // Wylicz nowy nextRun
          const cron = parseCronEntry(job.cronEntry);
          const now2 = new Date();
          const next = cron ? getNextRun(cron, now2) : null;
          job.nextRun = next ? next : null;
          job.running = false;
          saveSchedulerState();
          // Loguj NEXT RUN na końcu, po przeliczeniu nowego nextRun
          const logPath = path.join(getLogsDir(), `${now2.getFullYear()}-${(now2.getMonth()+1).toString().padStart(2,'0')}-${now2.getDate().toString().padStart(2,'0')}.log`);
          const pad = n => n.toString().padStart(2, '0');
          const ts = `${pad(now2.getDate())}-${pad(now2.getMonth()+1)}-${now2.getFullYear()} ${pad(now2.getHours())}:${pad(now2.getMinutes())}:${pad(now2.getSeconds())}.${now2.getMilliseconds().toString().padStart(3,'0')}`;
          fs.appendFileSync(logPath, `[${ts}] [${job.traceId}] NEXT RUN: ${job.flowName} (${job.cronEntry}) nextRun=${job.nextRun}\n`);
        }
      })();
      saveSchedulerState();
    }
  }
}, 10000); // Co 10 sekund

function loadSchedulerState() {
  // 1. Wczytaj scheduler_state.json jeśli istnieje
  if (fs.existsSync(getSchedulerStateFile())) {
    try {
      const raw = fs.readFileSync(getSchedulerStateFile(), 'utf8');
      schedulerState = JSON.parse(raw);
      if (!Array.isArray(schedulerState)) schedulerState = [];
      console.log('[SCHEDULER] Wczytano scheduler_state.json:', schedulerState.length, 'zadan');
    } catch (e) {
      console.error('[SCHEDULER] Błąd odczytu scheduler_state.json:', e);
      schedulerState = [];
    }
  } else {
    console.log('[SCHEDULER] Brak pliku scheduler_state.json, generuję na podstawie flows.json');
    schedulerState = [];
  }
  // 2. Synchronizuj z flows (dodaj nowe, usuń zniknięte, zaktualizuj zmienione)
  const result = syncCronTable(flows, schedulerState);
  schedulerState = result.schedulerState;
  saveSchedulerState();
  console.log('[SCHEDULER] Po synchronizacji CRON:', {
    added: result.added.length,
    removed: result.removed.length,
    updated: result.updated.length,
    unchanged: result.unchanged.length
  });
}

function getRef(path, ctx) {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), ctx);
}

function evalExpr(expr, ctx) {
  if (typeof expr === "string" && expr.startsWith("$")) {
    return resolveValue(expr, ctx);
  }
  if (typeof expr !== "object" || expr === null) return expr;

  // --- Funkcje logiczne, porównania, konwersje, operacje matematyczne, stringi, tablice ---
  if (expr["!parseInt"]) {
    return parseInt(resolveValue(expr["!parseInt"], ctx), 10);
  }
  if (expr["!parseFloat"]) {
    return parseFloat(resolveValue(expr["!parseFloat"], ctx));
  }
  if (expr["!parseBool"]) {
    const v = resolveValue(expr["!parseBool"], ctx);
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return ["true", "1", "yes"].includes(v.toLowerCase());
    return Boolean(v);
  }
  if (expr["!parseString"]) {
    return String(resolveValue(expr["!parseString"], ctx));
  }
  if (expr["!length"]) {
    const v = evalExpr(expr["!length"], ctx);
    return v != null && typeof v.length === 'number' ? v.length : 0;
  }
  if (expr["!not"]) {
    return !evalExpr(expr["!not"], ctx);
  }
  if (expr["!and"]) {
    return expr["!and"].map(e => evalExpr(e, ctx)).every(Boolean);
  }
  if (expr["!or"]) {
    return expr["!or"].map(e => evalExpr(e, ctx)).some(Boolean);
  }
  if (expr["!add"]) {
    return expr["!add"].map(e => evalExpr(e, ctx)).reduce((a, b) => a + b, 0);
  }
  if (expr["!sub"]) {
    const vals = expr["!sub"].map(e => evalExpr(e, ctx));
    return vals.slice(1).reduce((a, b) => a - b, vals[0]);
  }
  if (expr["!mul"]) {
    return expr["!mul"].map(e => evalExpr(e, ctx)).reduce((a, b) => a * b, 1);
  }
  if (expr["!div"]) {
    const vals = expr["!div"].map(e => evalExpr(e, ctx));
    return vals.slice(1).reduce((a, b) => a / b, vals[0]);
  }
  if (expr["!abs"]) {
    return Math.abs(evalExpr(expr["!abs"], ctx));
  }
  if (expr["!min"]) {
    return Math.min(...expr["!min"].map(e => evalExpr(e, ctx)));
  }
  if (expr["!max"]) {
    return Math.max(...expr["!max"].map(e => evalExpr(e, ctx)));
  }
  if (expr["!eq"]) {
    const args = expr["!eq"].map(e => evalExpr(e, ctx));
    return args[0] === args[1];
  }
  if (expr["!neq"]) {
    const args = expr["!neq"].map(e => evalExpr(e, ctx));
    return args[0] !== args[1];
  }
  if (expr["!lt"]) {
    const args = expr["!lt"].map(e => evalExpr(e, ctx));
   // console.log('[EVAL][!lt] args:', JSON.stringify(args));
    return args[0] < args[1];
  }
  if (expr["!lte"]) {
    const args = expr["!lte"].map(e => evalExpr(e, ctx));
    return args[0] <= args[1];
  }
  if (expr["!gt"]) {
    const args = expr["!gt"].map(e => evalExpr(e, ctx));
    return args[0] > args[1];
  }
  if (expr["!gte"]) {
    const args = expr["!gte"].map(e => evalExpr(e, ctx));
    return args[0] >= args[1];
  }
  if (expr["!between"]) {
    const args = expr["!between"].map(e => evalExpr(e, ctx));
    return args[0] >= args[1] && args[0] <= args[2];
  }
  if (expr["!cases"]) {
    for (const c of expr["!cases"]) {
      if (c.when && evalExpr(c.when, ctx) === true) {
        return c.set;
      }
      if (c.default !== undefined) {
        return c.default;
      }
    }
  }
  if (expr["!if"]) {
    const args = expr["!if"].map(e => evalExpr(e, ctx));
    const [cond, t, f] = args;
    //console.log('[EVAL][!if] cond:', cond, 'true:', t, 'false:', f);
    return cond ? t : f;
  }
  if (expr["!concat"]) {
    return expr["!concat"].map(e => evalExpr(e, ctx)).join("");
  }
  if (expr["!includes"]) {
    const [arr, val] = expr["!includes"];
    const a = evalExpr(arr, ctx);
    const v = evalExpr(val, ctx);
    return Array.isArray(a) ? a.includes(v) : (typeof a === 'string' ? a.includes(v) : false);
  }
  if (expr["!match"]) {
    const [str, regex] = expr["!match"];
    const s = evalExpr(str, ctx);
    return new RegExp(regex).test(s);
  }
  if (expr["!dateNow"]) {
    return new Date().toISOString();
  }
  if (expr["!toUpperCase"]) {
    const v = evalExpr(expr["!toUpperCase"], ctx);
    return typeof v === 'string' ? v.toUpperCase() : v;
  }
  if (expr["!toLowerCase"]) {
    const v = evalExpr(expr["!toLowerCase"], ctx);
    return typeof v === 'string' ? v.toLowerCase() : v;
  }
  if (expr["!uid"]) {
    const v = evalExpr(expr["!uid"], ctx);
    return typeof v === 'string' ? uid(v) : v;
  }
  if (expr["!crypto"]) {
    const v = evalExpr(expr["!crypto"], ctx);
    return typeof v === 'string' ? crypto.createHash("sha256").update(v).digest("hex") : v;
  }
  if (expr["!slice"]) {
    const [arr, start, end] = expr["!slice"];
    const a = evalExpr(arr, ctx);
    return Array.isArray(a) || typeof a === 'string' ? a.slice(start, end) : a;
  }
  if (expr["!startsWith"]) {
    const [str, search] = expr["!startsWith"];
    const s = evalExpr(str, ctx);
    const sub = evalExpr(search, ctx);
    return typeof s === 'string' ? s.startsWith(sub) : false;
  }
  if (expr["!endsWith"]) {
    const [str, search] = expr["!endsWith"];
    const s = evalExpr(str, ctx);
    const sub = evalExpr(search, ctx);
    return typeof s === 'string' ? s.endsWith(sub) : false;
  }
  if (expr["!trim"]) {
    const v = evalExpr(expr["!trim"], ctx);
    return typeof v === 'string' ? v.trim() : v;
  }
  if (expr["!replace"]) {
    const [str, search, replace] = expr["!replace"];
    const s = evalExpr(str, ctx);
    const searchVal = evalExpr(search, ctx);
    const replaceVal = evalExpr(replace, ctx);
    return typeof s === 'string' ? s.replace(searchVal, replaceVal) : s;
  }
  if (expr["!split"]) {
    const [str, sep] = expr["!split"];
    const s = evalExpr(str, ctx);
    const sepVal = evalExpr(sep, ctx);
    return typeof s === 'string' ? s.split(sepVal) : s;
  }
  if (expr["!join"]) {
    const [arr, sep] = expr["!join"];
    const a = evalExpr(arr, ctx);
    const sepVal = evalExpr(sep, ctx);
    return Array.isArray(a) ? a.join(sepVal) : a;
  }
  if (expr["!typeof"]) {
    return typeof evalExpr(expr["!typeof"], ctx);
  }
  if (expr["!random"]) {
    // Rozwiąż argumenty rekurencyjnie
    const args = expr["!random"];
    let min = resolveValue(args[0], ctx);
    let max = resolveValue(args[1], ctx);
    min = typeof min === 'string' ? parseInt(min, 10) : min;
    max = typeof max === 'string' ? parseInt(max, 10) : max;
    if (isNaN(min)) min = 0;
    if (isNaN(max)) max = 0;
    if (max < min) [min, max] = [max, min];
    // Losowa liczba całkowita z zakresu <min, max>
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  return expr;
}


function resolveValue(v, ctx) {
  if (typeof v === "string") {
    // Jeśli string jest dokładnie referencją do stałej lub zmiennej, rozwiąż ją
    if (v.startsWith("@") && v.match(/^@[a-zA-Z0-9_\.]+$/)) {
      const ref = constants[v.slice(1)];
      //console.log(`[CONST-RESOLVE] @${v.slice(1)} =>`, ref);
      return typeof ref === 'undefined' ? v : ref;
    }
    if (v.startsWith("$") && v.match(/^\$[a-zA-Z0-9_\.]+$/)) {
      const ref = getRef(v.slice(1), ctx);
      return typeof ref === 'undefined' ? v : ref;
    }
    // W przeciwnym razie podmień wszystkie wystąpienia @... i $... w stringu
    let replaced = v;
    let prev;
    // Głęboka podmiana aż do skutku (np. jeśli stała zawiera inną stałą)
    do {
      prev = replaced;
      replaced = replaced
        .replace(/@([a-zA-Z0-9_\.]+)/g, (match, p1) => {
          const ref = constants[p1];
          //console.log(`[CONST-RESOLVE] @${p1} =>`, ref);
          return typeof ref === 'undefined' ? match : ref;
        })
        .replace(/\$([a-zA-Z0-9_\.]+)/g, (match, p1) => {
          const ref = getRef(p1, ctx);
          return typeof ref === 'undefined' ? match : ref;
        });
    } while (replaced !== prev);
    return replaced;
  }
  if (Array.isArray(v)) {
    return v.map(item => resolveValue(item, ctx));
  }
  if (v && typeof v === "object") {
    // Jeśli to wyrażenie funkcyjne (!if, !cases itd.), deleguj do evalExpr
    if (Object.keys(v).some(k => k.startsWith("!"))) {
      return evalExpr(v, ctx);
    }
    // W przeciwnym razie rekurencyjnie rozwiąż wszystkie pola
    const out = {};
    for (const k in v) {
      out[k] = resolveValue(v[k], ctx);
    }
    return out;
  }
  return v;
}


async function callFlow(flowName, input, parentCtx = {}) {
  const flow = flows.find(f => f.name === flowName);
  if (!flow) throw new Error(`Flow not found: ${flowName}`);
  // Tworzymy nowy kontekst, dziedzicząc z parentCtx
  const req = { params: {}, query: {}, body: input };
  let result;
  await executeFlow(flow, req, {
    status: s => ({ json: b => { result = { status: s, body: b }; } })
  }, parentCtx);
  return result;
}


const validate = require('./validate');

async function executeFlow(flow, req, res, parentCtx, startStep=null) {

  const ctx = parentCtx || {};
  ctx.input = {
    params: req.params,
    query: req.query,
    body: req.body
  };

  // --- Obsługa typu FLOW CONST ---
  // (już obsłużone globalnie, nie dodajemy do ctx)

  // --- WALIDACJA INPUT ---
  if (flow.validation_schema) {
    const validationErrors = validate(req, flow.validation_schema);
    if (validationErrors.length > 0) {
      ctx.validation_errors = validationErrors;
      if (flow.validation_error_step && flow.steps[flow.validation_error_step]) {
        // Przeskocz do zdefiniowanego stepu obsługi błędu walidacji
        let current = flow.validation_error_step;
        while (current) {
          const step = flow.steps[current];
          if (!step) throw new Error(`Unknown step ${current}`);
          if (step.operation === "return") {
            // Wymuś return z błędami walidacji
            const status = step.status || 400;
            const body = step.body || { errors: ctx.validation_errors };
            return res.status(status).json(body);
          }
          // Obsłuż inne typy stepów jeśli potrzeba (opcjonalnie)
          // ...
          // Domyślnie zakończ na return lub break
          break;
        }
        return;
      } else {
        // Domyślnie: zwróć błąd 400
        if (res && typeof res.status === 'function') {
          return res.status(400).json({ errors: validationErrors });
        } else {
          throw new Error('Validation failed: ' + validationErrors.join('; '));
        }
      }
    }
  }

  // --- LOGOWANIE ---

  if (!ctx.__traceId) {
    // Generowanie traceId na start flow za pomocą uid.js
    
    ctx.__traceId = uid('ccccccdd-ddccddcc-ccddccdd-cc');
  }
  // Inicjalizuj logowanie jeśli brakuje timestamp lub pliku logów
  if (!ctx.__logTimestamp || !ctx.__logFile) {
    function logTimestamp() {
      const d = new Date();
      const pad = n => n.toString().padStart(2, '0');
      const ms = d.getMilliseconds().toString().padStart(3, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`;
    }
    ctx.__logTimestamp = logTimestamp;
    // Plik dzienny
    const d = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const dayFile = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.log`;
    const logsDir = getLogsDir();
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    ctx.__logFile = path.join(logsDir, dayFile);
    fs.appendFileSync(ctx.__logFile, `[${ctx.__logTimestamp()}] [${ctx.__traceId}] START FLOW: ${flow.name}\n`);
    fs.appendFileSync(ctx.__logFile, `[${ctx.__logTimestamp()}] [${ctx.__traceId}] INPUT: ${JSON.stringify(ctx.input)}\n`);
  }

  function logStep(msg, data) {
    const ts = ctx.__logTimestamp ? ctx.__logTimestamp() : new Date().toLocaleString('pl-PL', { hour12: false });
    const flowName = flow && flow.name ? flow.name : 'unknown_flow';
    fs.appendFileSync(ctx.__logFile, `[${ts}] [${ctx.__traceId}] [${flowName}][${ctx.current_step}] ${msg}${data ? ': ' + JSON.stringify(data) : ''}\n`);
  }


  let current = startStep ||flow.start;
  let previous = null;

  while (current) {
    ctx.previous_step = previous;
    ctx.current_step = current;
    previous = current;

    const step = flow.steps[current];
    if (!step) throw new Error(`Unknown step ${current}`);

    // --- LOG INIT ---
    if (step.operation === "http") {
      const reqParams = step.params ? resolveValue(step.params, ctx) : {};
      const reqQuery = step.query ? resolveValue(step.query, ctx) : {};
      const reqBody = step.body ? resolveValue(step.body, ctx) : {};
      let url = step.url;
      if (reqParams && typeof reqParams === 'object') {
        for (const [k, v] of Object.entries(reqParams)) {
          url = url.replace(new RegExp(`:${k}\\b`, 'g'), encodeURIComponent(v));
        }
      }
      const headers = Object.assign({}, step.headers || {}, { 'X-Trace-Id': ctx.__traceId });
      logStep(`init: [http]`, {
        url: step.url,
        params: reqParams,
        query: reqQuery,
        body: reqBody,
        headers
      });
      let response, error;
      try {
        response = await axios({
          method: step.method,
          url: url,
          params: reqQuery,
          data: reqBody,
          headers
        });
      } catch (e) {
        error = e;
        response = e.response || {};
      }
      ctx[current] = {
        response: response.data,
        httpstatus: response.status
      };
      logStep(`finalize: [http]`, {
        response: response.data,
        httpstatus: response.status,
        next: step.next,
        error: error ? error.toString() : undefined
      });
      current = evalExpr(step.next, ctx);
      continue;
    }

    if (step.operation === "call_flow") {
      const flowName = step.flow;
      const input = step.input ? resolveValue(step.input, ctx) : {};
      logStep(`init: [call_flow]`, {
        flow: flowName,
        input
      });
      const result = await callFlow(flowName, input, ctx);
      ctx[current] = { result };
      logStep(`finalize: [call_flow]`, {
        result,
        next: step.next
      });
      current = resolveValue(step.next, ctx);
      continue;
    }

    if (step.operation === "wait") {
      let ms = resolveValue(step.wait, ctx);
      logStep(`init: [wait]`, { wait: ms });
      ms = typeof ms === 'string' ? parseInt(ms, 10) : ms;
      if (isNaN(ms) || ms < 0) ms = 0;
      ctx[current] = { wait: ms };
      await new Promise(r => setTimeout(r, ms));
      logStep(`finalize: [wait]`, { wait: ms, next: step.next });
      current = resolveValue(step.next, ctx);
      continue;
    }

    if (step.operation === "transform") {
      logStep(`init: [transform]`, { object: step.object });
      const obj = {};
      for (const k in step.object) {
        obj[k] = resolveValue(step.object[k], ctx);
      }
      ctx[current] = { object: obj };
      logStep(`finalize: [transform]`, { object: obj, next: step.next });
      current = resolveValue(step.next, ctx);
      continue;
    }

    if (step.operation === "loop") {
      const arr = resolveValue(step.array, ctx) || [];
      logStep(`init: [loop]`, { array: arr });
      const results = [];
      let lastResult = undefined;
      let brokeEarly = false;
      if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; i++) {
          let subInput = step.input ? JSON.parse(JSON.stringify(step.input)) : {};
          function substituteItem(obj) {
            if (typeof obj === 'string') {
              return obj === "$item" ? arr[i] : obj;
            }
            if (Array.isArray(obj)) {
              return obj.map(substituteItem);
            }
            if (obj && typeof obj === 'object') {
              const out = {};
              for (const k in obj) out[k] = substituteItem(obj[k]);
              return out;
            }
            return obj;
          }
          subInput = substituteItem(subInput);
          // Rozwiąż wszystkie zmienne w subInput
          subInput = resolveValue(subInput, ctx);
          logStep(`init: [loop call_flow]`, {
            flow: step.flow,
            input: subInput
          });
          const result = await callFlow(step.flow, subInput, ctx);
          lastResult = result && result.body;
          results.push(lastResult);
          // Expose current result in context for this step
          ctx[current] = { result: results, current: lastResult };
          logStep(`finalize: [loop call_flow]`, {
            result
          });
          // Check for 'until' condition after each iteration
          if (step.until) {
            let untilMet = false;
            try {
              untilMet = evalExpr(step.until, ctx);
            } catch (e) {
              logStep(`loop until evaluation error`, { error: e.toString() });
            }
            if (untilMet) {
              brokeEarly = true;
              break;
            }
          }
        }
      }
      ctx[current] = { result: results, current: lastResult, brokeEarly };
      logStep(`finalize: [foreach]`, { array: arr, results, brokeEarly, next: step.next });
      current = resolveValue(step.next, ctx);
      continue;
    }



    if (step.operation === "return") {
      logStep(`init: [return]`, { body: step.body, status: step.status, response_type: step.response_type, next: step.next });
      const status = resolveValue(step.status, ctx) || 200;
      const responseType = step.response_type ? resolveValue(step.response_type, ctx) : 'json';
      const filesBase = path.resolve(__dirname, 'files');
      function deepResolve(obj) {
        if (typeof obj === 'string') {
          return resolveValue(obj, ctx);
        }
        if (Array.isArray(obj)) {
          return obj.map(deepResolve);
        }
        if (obj && typeof obj === 'object') {
          // Obsługa !file
          if (Object.keys(obj).length === 1 && obj['!file']) {
            // Rozwiąż ścieżkę względem ./files
            let relPath = resolveValue(obj['!file'], ctx);
            if (typeof relPath !== 'string') throw new Error('!file: ścieżka musi być stringiem');
            const absPath = path.resolve(filesBase, relPath);
            if (!absPath.startsWith(filesBase)) throw new Error('!file: dostęp tylko do ./files i podkatalogów');
            if (!fs.existsSync(absPath)) throw new Error('!file: plik nie istnieje');
            return fs.readFileSync(absPath, 'utf8');
          }
          let result = obj;
          let prev = null;
          let iter = 0;
          while (
            result && typeof result === 'object' && Object.keys(result).some(k => k.startsWith('!')) && iter < 10
          ) {
            prev = JSON.stringify(result);
            result = evalExpr(result, ctx);
            if (JSON.stringify(result) === prev) break;
            iter++;
          }
          if (typeof result === 'object' && result !== null) {
            const out = {};
            for (const k in result) {
              out[k] = deepResolve(result[k]);
            }
            return out;
          }
          return result;
        }
        return obj;
      }
      const body = deepResolve(step.body);
      logStep(`finalize: [return]`, {
        body,
        httpstatus: status,
        response_type: responseType,
        next: step.next
      });
      if (step.next) {
        setImmediate(() => {
          executeFlow(flow, req, null, ctx, step.next);
        });
      } else {
        logStep('END FLOW', {});
      }
      if (!res) return;
      if (responseType === 'json') {
        return res.status(status).json(body);
      } else if (responseType === 'html') {
        return res.status(status).type('html').send(body);
      } else if (responseType === 'text') {
        return res.status(status).type('text').send(body);
      } else if (responseType === 'file') {
        let fileContent = body;
        if (typeof body === 'string') {
          return res.status(status).send(fileContent);
        } else {
          return res.status(500).send('Nieprawidłowy body dla response_type=file');
        }
      } else {
        return res.status(status).type('text').send('Nieobsługiwany response_type: ' + responseType);
      }
    }

    throw new Error(`Unsupported operation ${step.operation}`);
  }
}


module.exports = { executeFlow, callFlow, flows, setBaseDir, initScheduler };
