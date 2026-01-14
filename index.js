require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { executeFlow, flows: defaultFlows, setBaseDir } = require("./engine");
const { syncCronTable } = require('./sync_cron_table');

// --- Obsługa parametrów uruchomienia ---
const baseDir = process.argv[2] ? path.resolve(process.argv[2]) : __dirname;
setBaseDir(baseDir);
const customPort = process.argv[3] ? parseInt(process.argv[3], 10) : null;

const startDate = new Date();
const pad = n => n.toString().padStart(2, '0');
const startTimeStr = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}:${pad(startDate.getSeconds())}`;
console.log(`[SCHEDULER] Start engine.js o ${startTimeStr}`);
// ...istniejące logi i pierwsza deklaracja app...

const app = express();
app.use(bodyParser.json());
// s
// --- Wczytaj konfigurację stron portalu na starcie ---
const PORTAL_CONFIG_PATH = path.join(baseDir, 'pages.json');
let portalPages = {};
try {
  if (fs.existsSync(PORTAL_CONFIG_PATH)) {
    portalPages = JSON.parse(fs.readFileSync(PORTAL_CONFIG_PATH, 'utf8'));
  }
} catch (e) {
  console.error('Błąd wczytywania pages.json:', e);
  portalPages = {};
}

// --- Obsługa GET /portal/* zgodnie z konfiguracją ---
app.get(/^\/portal\/(.*)/, async (req, res) => {
  const pageName = req.params[0];
  const pageConfig = portalPages[pageName];
  if (!pageConfig) {
    return res.status(404).send('<html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:2em;"><h1>404 Not Found</h1><p>Nie znaleziono strony: ' + pageName + '</p></body></html>');
  }
  // Jeśli path wskazuje na plik
  if (pageConfig.path) {
    const filePath = path.join(baseDir, 'pages', pageConfig.path.replace(/^\//, ''));
    if (!filePath.startsWith(path.join(baseDir, 'pages'))) {
      return res.status(403).send('Access denied');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.type('text/html');
      return fs.createReadStream(filePath).pipe(res);
    } else {
      return res.status(404).send('<html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:2em;"><h1>404 Not Found</h1><p>Nie znaleziono pliku: ' + pageConfig.path + '</p></body></html>');
    }
  }
  // Jeśli path jest null, ale jest template
  if (pageConfig.template) {
    const templatePath = path.join(baseDir, 'pages', pageConfig.template.replace(/^\//, ''));
    if (!fs.existsSync(templatePath) || !fs.statSync(templatePath).isFile()) {
      return res.status(404).send('<html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:2em;"><h1>404 Not Found</h1><p>Nie znaleziono szablonu: ' + pageConfig.template + '</p></body></html>');
    }
    let html = fs.readFileSync(templatePath, 'utf8');
    // Podstaw tytuł
    html = html.replace('<PLACEHOLDER_TITLE>', pageConfig.title || '');
    // Podstaw skrypt autoryzacji
    if (pageConfig.auth === true) {
      html = html.replace('<PLACEHOLDER_FOR_AUTH_SCRIPTS>', '<script src="/pages/common-auth.js"></script>');
    } else {
      html = html.replace('<PLACEHOLDER_FOR_AUTH_SCRIPTS>', '');
    }
    // Podstaw dodatkowe skrypty JS
    let additionalScripts = '';
    if (pageConfig.useJS) {
      if (Array.isArray(pageConfig.useJS)) {
        for (const jsPath of pageConfig.useJS) {
          additionalScripts += `<script src="${jsPath}"></script>\n`;
        }
      } else if (typeof pageConfig.useJS === 'string') {
        additionalScripts = `<script src="${pageConfig.useJS}"></script>`;
      }
    }
    html = html.replace('<PLACEHOLDER_FOR_ADDITIONAL_SCRIPTS>', additionalScripts);
    res.type('text/html');
    return res.send(html);
  }
  // Jeśli nie ma path ani template
  return res.status(404).send('<html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:2em;"><h1>404 Not Found</h1><p>Brak konfiguracji path/template dla strony: ' + pageName + '</p></body></html>');
});

// Obsługa serwowania plików z katalogu 'portal' (GET /pages/***)
app.get(/^\/pages\/(.*)/, (req, res) => {
  let relPath = req.params[0] || '';
  if (!relPath.match(/\.(html|js|css)$/)) {
    relPath += '.html';
  }
  const filePath = path.join(baseDir, 'pages', relPath);
  if (!filePath.startsWith(path.join(baseDir, 'pages'))) {
    return res.status(403).send('Access denied');
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return res.status(404).send('<html><head><title>404 Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:2em;"><h1>404 Not Found</h1><p>Nie znaleziono pliku: ' + relPath + '</p></body></html>');
    }
    let type = 'text/html';
    if (relPath.endsWith('.js')) type = 'application/javascript';
    if (relPath.endsWith('.css')) type = 'text/css';
    res.type(type);
    fs.createReadStream(filePath).pipe(res);
  });
});

// --- Endpoint do ręcznego odświeżenia harmonogramu CRON ---
const SCHEDULER_STATE_FILE = path.join(baseDir, 'scheduler_state.json');
let schedulerState = [];
if (fs.existsSync(SCHEDULER_STATE_FILE)) {
  try {
    const raw = fs.readFileSync(SCHEDULER_STATE_FILE, 'utf8');
    schedulerState = JSON.parse(raw);
    if (!Array.isArray(schedulerState)) schedulerState = [];
  } catch (e) {
    schedulerState = [];
  }
}
app.post('/admin/recalculate_cron_table', (req, res) => {
  const result = syncCronTable(flows, schedulerState);
  schedulerState = result.schedulerState;
  try {
    fs.writeFileSync(SCHEDULER_STATE_FILE, JSON.stringify(schedulerState, null, 2), 'utf8');
  } catch (e) {
    return res.status(500).json({ error: 'Błąd zapisu scheduler_state.json', details: e.message });
  }
  res.json({
    message: 'Synchronizacja CRON zakończona',
    added: result.added.length,
    removed: result.removed.length,
    updated: result.updated.length,
    unchanged: result.unchanged.length
  });
});



// ...usunięto powtórzone logi i deklaracje app...

// Endpoint do restartu aplikacji
app.post('/admin/restart', (req, res) => {
  res.json({ message: 'Restarting app...' });
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

// --- Wczytaj flows z katalogu instancji lub domyślnego ---
let flows = defaultFlows;
const FLOWS_PATH = path.join(baseDir, 'flows');
if (fs.existsSync(FLOWS_PATH) && fs.statSync(FLOWS_PATH).isDirectory()) {
  try {
    const flowFiles = fs.readdirSync(FLOWS_PATH).filter(f => f.endsWith('.json'));
    flows = flowFiles.flatMap(f => {
      try {
        const arr = JSON.parse(fs.readFileSync(path.join(FLOWS_PATH, f), 'utf8'));
        return Array.isArray(arr) ? arr : [arr];
      } catch (e) {
        console.error('Błąd wczytywania flow:', f, e);
        return [];
      }
    });
  } catch (e) {
    console.error('Błąd odczytu katalogu flows:', e);
  }
}
for (const flow of flows) {
  if (flow.type === 'CRON') continue; // nie rejestrujemy endpointu HTTP dla CRON
  if (flow.type === 'FLOW') continue; // nie rejestrujemy endpointu HTTP dla FLOW
  if (flow.type && flow.type.toUpperCase() === 'CONST') continue; // nie rejestrujemy endpointu HTTP dla CONST
  const method = flow.type.toLowerCase();
  if (!app[method]) {
    throw new Error(`Unsupported HTTP method: ${flow.type}`);
  }
  app[method](flow.path, async (req, res) => {
    try {
      await executeFlow(flow, req, res, { __traceId: req.headers['x-trace-id'] });
    } catch (e) {
      console.error(`[${flow.name}]`, e);
      res.status(500).json({ error: e.message });
    }
  });
  console.log(
    `Registered flow '${flow.name}' on ${flow.type} ${flow.path}`
  );
}


// Endpoint do logów (surowe logi i statyczne pliki)
const logsRoute = require('./logsRoute');
app.use(logsRoute);
app.use(express.static(__dirname)); // serwuj logs.html i logs.js

const PORT = customPort || process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Flow engine listening on port ${PORT}`);
});

