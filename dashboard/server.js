const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');
const si = require('systeminformation');
const os = require('os');

const PORT = process.env.PORT || 3110;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const DEFAULT_CONFIG_PATH = fs.existsSync(path.join(__dirname, 'defaults', 'default-config.json'))
  ? path.join(__dirname, 'defaults', 'default-config.json')
  : path.join(__dirname, 'data', 'default-config.json');
const PRESETS_PATH = path.join(__dirname, 'preset-apps.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}
}

// Load or initialize config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('[Config] Notice reading config file, falling back:', err.message);
  }

  // If not found, copy default
  try {
    if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
      const defaultData = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8');
      try {
        fs.writeFileSync(CONFIG_PATH, defaultData, 'utf8');
        console.log('[Config] Initialized config.json from default template.');
      } catch (writeErr) {
        console.warn('[Config] Running in-memory default config (volume is read-only or pending permissions):', writeErr.message);
      }
      return JSON.parse(defaultData);
    }
  } catch (err) {
    console.error('[Config] Error initializing default config:', err.message);
  }

  return { settings: {}, categories: [], apps: [] };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Config] Error saving config file:', err.message);
    return false;
  }
}

let config = loadConfig();
let presets = [];
try {
  if (fs.existsSync(PRESETS_PATH)) {
    presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
  }
} catch (err) {
  console.error('[Presets] Error reading presets:', err.message);
}

// App health status cache
const appHealthStatus = new Map();

// Express setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Host system information cache
let cachedHostInfo = null;

async function getHostStaticInfo() {
  if (cachedHostInfo) return cachedHostInfo;

  try {
    const [osInfo, cpu, mem, sys] = await Promise.all([
      si.osInfo(),
      si.cpu(),
      si.mem(),
      si.system()
    ]);

    // Check if running in container with /mnt/host
    let distro = osInfo.distro;
    let release = osInfo.release;
    let kernel = osInfo.kernel;
    let hostname = osInfo.hostname || os.hostname();

    const hostOsRelease = '/mnt/host/etc/os-release';
    if (fs.existsSync(hostOsRelease)) {
      try {
        const releaseContent = fs.readFileSync(hostOsRelease, 'utf8');
        const prettyNameMatch = releaseContent.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
        const nameMatch = releaseContent.match(/^NAME="?([^"\n]+)"?/m);
        if (prettyNameMatch) distro = prettyNameMatch[1];
        else if (nameMatch) distro = nameMatch[1];
      } catch (_) {}
    }

    cachedHostInfo = {
      distro: distro || 'Linux',
      kernel: kernel || os.release(),
      arch: osInfo.arch || os.arch(),
      hostname: hostname,
      model: sys.model && sys.model !== 'None' ? sys.model : (sys.manufacturer || 'Mini PC / Server'),
      cpuBrand: cpu.brand || `${os.cpus()[0]?.model || 'Generic CPU'}`,
      cpuCores: cpu.cores || os.cpus().length,
      cpuPhysicalCores: cpu.physicalCores || Math.ceil((cpu.cores || os.cpus().length) / 2),
      cpuSpeedMax: cpu.speedMax ? `${cpu.speedMax} GHz` : (cpu.speed ? `${cpu.speed} GHz` : ''),
      totalRamBytes: mem.total || os.totalmem(),
      platform: os.platform()
    };
  } catch (err) {
    console.error('[HostInfo] Error fetching static specs:', err.message);
    cachedHostInfo = {
      distro: 'Linux Server',
      kernel: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpuBrand: os.cpus()[0]?.model || 'Host CPU',
      cpuCores: os.cpus().length,
      totalRamBytes: os.totalmem()
    };
  }
  return cachedHostInfo;
}

// Format seconds into human readable duration
function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ') || '< 1m';
}

const { execSync } = require('child_process');

// CPU Temperature reader with sysfs / host fallback
async function getCpuTemperature() {
  try {
    const t = await si.cpuTemperature();
    if (t.main && t.main > 0) return Math.round(t.main);
    if (t.max && t.max > 0) return Math.round(t.max);
    if (t.cores && t.cores.length > 0) {
      const valid = t.cores.filter(c => c > 0);
      if (valid.length > 0) return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
    }
  } catch (_) {}

  // Fallback to thermal sysfs (works with host mount /mnt/host/sys/class/thermal)
  const thermalDirs = ['/sys/class/thermal', '/mnt/host/sys/class/thermal'];
  for (const dir of thermalDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const zones = fs.readdirSync(dir).filter(f => f.startsWith('thermal_zone'));
      for (const z of zones) {
        try {
          const type = fs.readFileSync(path.join(dir, z, 'type'), 'utf8').trim().toLowerCase();
          const tempRaw = parseInt(fs.readFileSync(path.join(dir, z, 'temp'), 'utf8').trim(), 10);
          if (!isNaN(tempRaw) && tempRaw > 0) {
            const tempC = tempRaw > 1000 ? Math.round(tempRaw / 1000) : tempRaw;
            if (type.includes('pkg') || type.includes('cpu') || type.includes('core') || type.includes('tcpu')) {
              return tempC;
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }
  return null;
}

// GPU detection and dynamic telemetry (NVIDIA, AMD, Intel iGPU/Arc)
let cachedGpuStatic = null;

async function getGpuMetrics() {
  let gpu = {
    name: 'Integrated Graphics',
    vendor: 'Generic',
    loadPercent: 0,
    temperature: null,
    memoryTotal: 0,
    memoryUsed: 0,
    clockMhz: null,
    maxClockMhz: null,
    active: false
  };

  // 1. Check NVIDIA via nvidia-smi
  try {
    const nvOut = execSync('nvidia-smi --query-gpu=name,utilization.gpu,memory.total,memory.used,temperature.gpu,clocks.current.graphics --format=csv,noheader,nounits', { timeout: 800 }).toString().trim();
    if (nvOut) {
      const parts = nvOut.split(',').map(s => s.trim());
      gpu.name = parts[0];
      gpu.vendor = 'NVIDIA';
      gpu.loadPercent = parseFloat(parts[1]) || 0;
      gpu.memoryTotal = (parseFloat(parts[2]) || 0) * 1024 * 1024;
      gpu.memoryUsed = (parseFloat(parts[3]) || 0) * 1024 * 1024;
      gpu.temperature = parseFloat(parts[4]) || null;
      gpu.clockMhz = parseFloat(parts[5]) || null;
      gpu.active = true;
      return gpu;
    }
  } catch (_) {}

  // 2. Try si.graphics() for static controller details
  if (!cachedGpuStatic) {
    try {
      const graphics = await si.graphics();
      if (graphics.controllers && graphics.controllers.length > 0) {
        cachedGpuStatic = graphics.controllers[0];
      }
    } catch (_) {}

    // Fallback: query lspci (standard on Linux/mini-PCs and containers with pciutils)
    if (!cachedGpuStatic) {
      try {
        const lspciOut = execSync("lspci | grep -iE 'vga|3d|display'", { timeout: 800 }).toString().trim();
        if (lspciOut) {
          const line = lspciOut.split('\n')[0];
          const match = line.match(/(?:controller|compatible controller):\s*(.+)$/i);
          if (match) {
            cachedGpuStatic = {
              model: match[1].replace(/\(rev\s+[0-9a-fA-F]+\)/, '').trim(),
              vendor: match[1].toLowerCase().includes('intel') ? 'Intel' : (match[1].toLowerCase().includes('nvidia') ? 'NVIDIA' : (match[1].toLowerCase().includes('amd') || match[1].toLowerCase().includes('radeon') ? 'AMD' : 'GPU'))
            };
          }
        }
      } catch (_) {}
    }
  }

  if (cachedGpuStatic) {
    gpu.name = cachedGpuStatic.model || cachedGpuStatic.vendor || 'Host Graphics';
    gpu.vendor = cachedGpuStatic.vendor || 'GPU';
    if (cachedGpuStatic.vram) gpu.memoryTotal = cachedGpuStatic.vram * 1024 * 1024;
    gpu.active = true;
  }

  // 3. Check sysfs for AMD / Intel GPU metrics
  const drmDirs = ['/sys/class/drm', '/mnt/host/sys/class/drm'];
  for (const drmPath of drmDirs) {
    if (!fs.existsSync(drmPath)) continue;
    try {
      const entries = fs.readdirSync(drmPath);
      for (const entry of entries) {
        // AMD gpu_busy_percent
        const amdBusy = path.join(drmPath, entry, 'device', 'gpu_busy_percent');
        if (fs.existsSync(amdBusy)) {
          const load = parseInt(fs.readFileSync(amdBusy, 'utf8').trim(), 10);
          if (!isNaN(load)) {
            gpu.loadPercent = load;
            gpu.vendor = 'AMD';
            gpu.active = true;
            break;
          }
        }

        // Intel gt_act_freq_mhz / gt_max_freq_mhz
        const intelSearchPaths = [
          path.join(drmPath, entry, 'device', 'drm', entry, 'gt_act_freq_mhz'),
          path.join(drmPath, entry, 'device', 'gt_act_freq_mhz'),
          path.join(drmPath, entry, 'gt_act_freq_mhz')
        ];
        for (const actPath of intelSearchPaths) {
          if (fs.existsSync(actPath)) {
            const maxPath = actPath.replace('act', 'max');
            const act = parseInt(fs.readFileSync(actPath, 'utf8').trim(), 10);
            const max = fs.existsSync(maxPath) ? parseInt(fs.readFileSync(maxPath, 'utf8').trim(), 10) : 1000;
            if (!isNaN(act) && !isNaN(max) && max > 0) {
              gpu.clockMhz = act;
              gpu.maxClockMhz = max;
              gpu.loadPercent = Math.min(100, Math.round((act / max) * 100));
              gpu.active = true;
              break;
            }
          }
        }
      }
    } catch (_) {}
  }

  // If Intel iGPU without separate temp sensor, correlate with package temperature
  if (gpu.active && gpu.temperature === null && gpu.vendor && gpu.vendor.toLowerCase().includes('intel')) {
    const cpuT = await getCpuTemperature();
    if (cpuT) gpu.temperature = cpuT;
  }

  return gpu;
}

// Collect dynamic metrics (Dashdot style)
async function getDynamicMetrics() {
  try {
    const [currentLoad, mem, fsSize, networkStats, timeInfo, cpuTemp, gpuStats] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.time(),
      getCpuTemperature(),
      getGpuMetrics()
    ]);

    // Disks: filter out tiny mounts, squashfs, loop devices
    const filteredDisks = fsSize
      .filter(d => {
        if (!d.size || d.size < 100 * 1024 * 1024) return false;
        if (d.fs && (d.fs.includes('loop') || d.fs.includes('tmpfs') || d.fs.includes('overlay'))) {
          if (d.mount !== '/' && d.mount !== '/mnt/host') return false;
        }
        return true;
      })
      .map(d => ({
        mount: d.mount === '/mnt/host' ? '/ (Host Root)' : d.mount,
        type: d.type || 'ext4',
        size: d.size,
        used: d.used,
        available: d.available,
        usePercent: Math.round(d.use || (d.used / d.size) * 100)
      }));

    // Network stats calculation
    let rx_sec = 0;
    let tx_sec = 0;
    let activeIface = 'net';

    if (Array.isArray(networkStats) && networkStats.length > 0) {
      for (const iface of networkStats) {
        if (iface.iface && !iface.iface.startsWith('lo') && !iface.iface.startsWith('veth')) {
          if (typeof iface.rx_sec === 'number' && iface.rx_sec >= 0) rx_sec += iface.rx_sec;
          if (typeof iface.tx_sec === 'number' && iface.tx_sec >= 0) tx_sec += iface.tx_sec;
          activeIface = iface.iface;
        }
      }
    }

    // Uptime calculation
    let uptimeSec = timeInfo.uptime || os.uptime();
    if (fs.existsSync('/mnt/host/proc/uptime')) {
      try {
        const upStr = fs.readFileSync('/mnt/host/proc/uptime', 'utf8');
        const hostUp = parseFloat(upStr.split(' ')[0]);
        if (!isNaN(hostUp)) uptimeSec = hostUp;
      } catch (_) {}
    }

    return {
      uptimeSeconds: uptimeSec,
      uptimeFormatted: formatUptime(uptimeSec),
      cpu: {
        loadPercent: Math.min(100, Math.max(0, Math.round(currentLoad.currentLoad * 10) / 10)),
        coresLoad: currentLoad.cpus ? currentLoad.cpus.map(c => Math.round(c.load)) : [],
        loadAvg: os.loadavg().map(l => Math.round(l * 100) / 100),
        temperature: cpuTemp
      },
      gpu: gpuStats,
      ram: {
        total: mem.total,
        used: mem.active || mem.used,
        free: mem.available || mem.free,
        usePercent: Math.min(100, Math.max(0, Math.round(((mem.active || mem.used) / mem.total) * 100)))
      },
      disks: filteredDisks,
      network: {
        rx_sec: Math.max(0, Math.round(rx_sec)),
        tx_sec: Math.max(0, Math.round(tx_sec)),
        iface: activeIface
      },
      timestamp: Date.now()
    };
  } catch (err) {
    console.error('[Metrics] Error getting dynamic metrics:', err.message);
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    return {
      uptimeSeconds: os.uptime(),
      uptimeFormatted: formatUptime(os.uptime()),
      cpu: {
        loadPercent: 0,
        coresLoad: [],
        loadAvg: os.loadavg()
      },
      ram: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usePercent: Math.round((usedMem / totalMem) * 100)
      },
      disks: [],
      network: { rx_sec: 0, tx_sec: 0, iface: 'eth0' },
      timestamp: Date.now()
    };
  }
}

// App health check helper
async function checkAppHealth(appItem) {
  if (!appItem || !appItem.url || appItem.healthCheck === false) {
    return { status: 'unknown', latencyMs: null, statusCode: null };
  }

  const startTime = Date.now();
  try {
    const parsed = new URL(appItem.url);
    // Use native fetch with 3.5s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(appItem.url, {
      method: 'GET',
      headers: { 'User-Agent': 'Dashboard-HealthCheck/1.0' },
      signal: controller.signal
    }).catch(async () => {
      // Fallback: try HEAD
      return await fetch(appItem.url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Dashboard-HealthCheck/1.0' },
        signal: controller.signal
      });
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    // HTTP codes 200-399 or even 401/403 (unauthorized/login page) indicate service is alive
    const isAlive = (response.status >= 200 && response.status < 500);

    const result = {
      status: isAlive ? 'online' : 'offline',
      statusCode: response.status,
      latencyMs: latencyMs,
      lastChecked: new Date().toISOString()
    };

    appHealthStatus.set(appItem.id, result);
    return result;
  } catch (err) {
    const result = {
      status: 'offline',
      statusCode: null,
      latencyMs: null,
      error: err.name === 'AbortError' ? 'Timeout' : (err.code || 'Unreachable'),
      lastChecked: new Date().toISOString()
    };
    appHealthStatus.set(appItem.id, result);
    return result;
  }
}

// Ping all apps in background
async function pingAllApps() {
  if (!config.apps || config.apps.length === 0) return;
  const promises = config.apps
    .filter(a => a.healthCheck !== false)
    .map(async (a) => {
      const res = await checkAppHealth(a);
      io.emit('app_health_update', { id: a.id, health: res });
    });
  await Promise.allSettled(promises);
}

// Start periodic tasks
let metricsInterval = null;
let healthCheckInterval = null;

function startPeriodicTasks() {
  const refreshMs = config.settings?.statsRefreshMs || 2000;
  const pingMs = config.settings?.pingIntervalMs || 20000;

  if (metricsInterval) clearInterval(metricsInterval);
  metricsInterval = setInterval(async () => {
    // Only query and broadcast if there are connected clients
    if (io.engine.clientsCount > 0) {
      const metrics = await getDynamicMetrics();
      io.emit('metrics', metrics);
    }
  }, refreshMs);

  if (healthCheckInterval) clearInterval(healthCheckInterval);
  healthCheckInterval = setInterval(pingAllApps, pingMs);

  // Initial prime
  setTimeout(pingAllApps, 1500);
}

startPeriodicTasks();

// Socket.io connection handling
io.on('connection', async (socket) => {
  // Send static specs immediately on connect
  const hostInfo = await getHostStaticInfo();
  socket.emit('host_info', hostInfo);

  // Send current dynamic snapshot
  const initialMetrics = await getDynamicMetrics();
  socket.emit('metrics', initialMetrics);

  // Send current cached health statuses
  const healthList = {};
  for (const [id, val] of appHealthStatus.entries()) {
    healthList[id] = val;
  }
  socket.emit('initial_health', healthList);
});

// REST APIs
// Static specs
app.get('/api/system/info', async (req, res) => {
  const info = await getHostStaticInfo();
  res.json(info);
});

// Dynamic metrics one-shot
app.get('/api/system/stats', async (req, res) => {
  const stats = await getDynamicMetrics();
  res.json(stats);
});

// Preset services library
app.get('/api/presets', (req, res) => {
  res.json(presets);
});

// App CRUD
app.get('/api/apps', (req, res) => {
  const appsWithStatus = (config.apps || []).map(a => ({
    ...a,
    health: appHealthStatus.get(a.id) || { status: 'unknown' }
  }));
  res.json(appsWithStatus);
});

app.post('/api/apps', (req, res) => {
  const newApp = req.body;
  if (!newApp.name || !newApp.url) {
    return res.status(400).json({ error: 'App name and URL are required' });
  }

  newApp.id = newApp.id || 'app_' + Date.now();
  newApp.category = newApp.category || 'all';
  newApp.color = newApp.color || '#3B82F6';
  newApp.icon = newApp.icon || 'globe';
  newApp.pinned = Boolean(newApp.pinned);
  newApp.healthCheck = newApp.healthCheck !== false;

  config.apps = config.apps || [];
  config.apps.push(newApp);
  saveConfig(config);

  // Trigger initial health check in background
  checkAppHealth(newApp).then(health => {
    io.emit('app_health_update', { id: newApp.id, health });
  });

  io.emit('config_updated', config);
  res.status(201).json(newApp);
});

app.put('/api/apps/:id', (req, res) => {
  const id = req.params.id;
  const index = (config.apps || []).findIndex(a => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'App not found' });
  }

  config.apps[index] = { ...config.apps[index], ...req.body, id };
  saveConfig(config);

  // Re-check health
  checkAppHealth(config.apps[index]).then(health => {
    io.emit('app_health_update', { id, health });
  });

  io.emit('config_updated', config);
  res.json(config.apps[index]);
});

app.delete('/api/apps/:id', (req, res) => {
  const id = req.params.id;
  config.apps = (config.apps || []).filter(a => a.id !== id);
  appHealthStatus.delete(id);
  saveConfig(config);
  io.emit('config_updated', config);
  res.json({ success: true, id });
});

app.post('/api/apps/reorder', (req, res) => {
  const { appIds } = req.body;
  if (!Array.isArray(appIds)) {
    return res.status(400).json({ error: 'appIds array required' });
  }

  const appMap = new Map((config.apps || []).map(a => [a.id, a]));
  const reordered = [];
  for (const id of appIds) {
    if (appMap.has(id)) {
      reordered.push(appMap.get(id));
      appMap.delete(id);
    }
  }
  // Append any remainder
  for (const a of appMap.values()) {
    reordered.push(a);
  }

  config.apps = reordered;
  saveConfig(config);
  io.emit('config_updated', config);
  res.json({ success: true, apps: config.apps });
});

// Single app manual ping
app.post('/api/ping/:id', async (req, res) => {
  const appItem = (config.apps || []).find(a => a.id === req.params.id);
  if (!appItem) return res.status(404).json({ error: 'App not found' });
  const health = await checkAppHealth(appItem);
  io.emit('app_health_update', { id: appItem.id, health });
  res.json(health);
});

// Categories CRUD
app.get('/api/categories', (req, res) => {
  res.json(config.categories || []);
});

app.post('/api/categories', (req, res) => {
  const { categories } = req.body;
  if (!Array.isArray(categories)) {
    return res.status(400).json({ error: 'Categories must be an array' });
  }
  config.categories = categories;
  saveConfig(config);
  io.emit('config_updated', config);
  res.json(config.categories);
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json(config.settings || {});
});

app.put('/api/settings', (req, res) => {
  config.settings = { ...config.settings, ...req.body };
  saveConfig(config);
  startPeriodicTasks();
  io.emit('config_updated', config);
  res.json(config.settings);
});

// --- Nginx Proxy Manager (NPM) Integration ---
const NPM_DEFAULT_URL = process.env.NPM_URL || 'http://nginx-proxy-manager:81';
const NPM_DEFAULT_EMAIL = process.env.NPM_EMAIL || '';
const NPM_DEFAULT_PASSWORD = process.env.NPM_PASSWORD || '';

function matchPresetForService(serviceName, forwardHost) {
  const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidateNorm = normalize(serviceName);
  const hostNorm = normalize(forwardHost);

  // Check exact/normalized matches against presets
  for (const p of presets) {
    const pNorm = normalize(p.name);
    const pId = normalize(p.id);
    if (
      candidateNorm === pNorm ||
      candidateNorm === pId ||
      hostNorm === pNorm ||
      hostNorm === pId ||
      (candidateNorm.length >= 3 && pNorm.includes(candidateNorm)) ||
      (pNorm.length >= 3 && candidateNorm.includes(pNorm))
    ) {
      const categoryId = (p.category || 'all').toLowerCase().replace(/\s+/g, '-');
      return {
        name: p.name,
        icon: p.icon || 'globe',
        color: p.color || '#3B82F6',
        category: categoryId,
        description: p.description || ''
      };
    }
  }

  // Format candidate name nicely (e.g. "my-custom-service" -> "My Custom Service")
  const words = (serviceName || forwardHost || 'Service')
    .replace(/[-_.]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const friendlyName = words.join(' ');

  return {
    name: friendlyName,
    icon: 'globe',
    color: '#3B82F6',
    category: 'infrastructure',
    description: forwardHost ? `NPM Proxy to ${forwardHost}` : 'Reverse proxy service'
  };
}

async function getNpmAuthToken(baseUrl, email, password) {
  const tokenUrl = `${baseUrl.replace(/\/+$/, '')}/api/tokens`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, secret: password })
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson.error?.message) errorDetail = errJson.error.message;
    } catch (_) {}
    throw new Error(`NPM Authentication failed (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  if (!data.token) {
    throw new Error('NPM did not return a valid authentication token');
  }
  return data.token;
}

async function fetchNpmHostsList(baseUrl, email, password) {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const token = await getNpmAuthToken(cleanUrl, email, password);

  const hostsUrl = `${cleanUrl}/api/nginx/proxy-hosts`;
  const response = await fetch(hostsUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch proxy hosts from NPM (${response.status}): ${response.statusText}`);
  }

  const hosts = await response.json();
  if (!Array.isArray(hosts)) {
    throw new Error('Unexpected response format from NPM proxy hosts API');
  }

  const currentApps = config.apps || [];

  return hosts
    .filter(h => Array.isArray(h.domain_names) && h.domain_names.length > 0)
    .map(h => {
      const primaryDomain = h.domain_names[0];
      const domainParts = primaryDomain.split('.');
      const candidateName = domainParts.length > 1 ? domainParts[0] : primaryDomain;
      const matched = matchPresetForService(candidateName, h.forward_host);

      const isSsl = Boolean(h.ssl_forced || (h.certificate_id && h.certificate_id > 0));
      const url = `${isSsl ? 'https' : 'http'}://${primaryDomain}`;

      const alreadyAdded = currentApps.some(a => {
        if (!a.url) return false;
        try {
          const aHost = new URL(a.url).hostname.toLowerCase();
          return aHost === primaryDomain.toLowerCase() || a.url.toLowerCase() === url.toLowerCase();
        } catch (_) {
          return a.url.toLowerCase().includes(primaryDomain.toLowerCase());
        }
      });

      return {
        npmId: h.id,
        domain: primaryDomain,
        domainNames: h.domain_names,
        forwardHost: h.forward_host,
        forwardPort: h.forward_port,
        forwardScheme: h.forward_scheme || 'http',
        ssl: isSsl,
        url: url,
        name: matched.name,
        icon: matched.icon,
        color: matched.color,
        category: matched.category,
        description: matched.description,
        enabled: h.enabled === 1,
        alreadyAdded
      };
    });
}

// NPM Config info endpoint
app.get('/api/npm/config', (req, res) => {
  res.json({
    url: config.settings?.npmUrl || NPM_DEFAULT_URL,
    email: config.settings?.npmEmail || NPM_DEFAULT_EMAIL,
    hasEnvPassword: Boolean(NPM_DEFAULT_PASSWORD)
  });
});

// NPM Discover / Preview hosts
app.post('/api/npm/hosts', async (req, res) => {
  try {
    const url = req.body.url || config.settings?.npmUrl || NPM_DEFAULT_URL;
    const email = req.body.email || config.settings?.npmEmail || NPM_DEFAULT_EMAIL;
    const password = req.body.password || NPM_DEFAULT_PASSWORD;

    if (!url || !email || !password) {
      return res.status(400).json({ error: 'NPM URL, Email, and Password are required.' });
    }

    const hosts = await fetchNpmHostsList(url, email, password);
    res.json({ success: true, count: hosts.length, hosts });
  } catch (err) {
    console.error('[NPM Sync Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// NPM Sync / Import selected hosts
app.post('/api/npm/sync', async (req, res) => {
  try {
    const { url, email, hosts } = req.body;
    if (!Array.isArray(hosts) || hosts.length === 0) {
      return res.status(400).json({ error: 'No hosts selected for import.' });
    }

    config.apps = config.apps || [];
    let addedCount = 0;
    const newAppsList = [];

    for (const item of hosts) {
      if (!item.url || !item.name) continue;

      const existingIndex = config.apps.findIndex(a => {
        if (!a.url) return false;
        try {
          return new URL(a.url).hostname.toLowerCase() === new URL(item.url).hostname.toLowerCase();
        } catch (_) {
          return a.url === item.url;
        }
      });

      const newApp = {
        id: existingIndex >= 0 ? config.apps[existingIndex].id : 'app_npm_' + (item.npmId || Date.now()) + '_' + Math.random().toString(36).substring(2, 7),
        name: item.name,
        category: item.category || 'infrastructure',
        description: item.description || `Forwarded to ${item.forwardHost || ''}:${item.forwardPort || ''}`,
        url: item.url,
        icon: item.icon || 'globe',
        color: item.color || '#3B82F6',
        pinned: false,
        healthCheck: true
      };

      if (existingIndex >= 0) {
        config.apps[existingIndex] = { ...config.apps[existingIndex], ...newApp };
      } else {
        config.apps.push(newApp);
        addedCount++;
      }
      newAppsList.push(newApp);
    }

    // Save NPM connection settings
    config.settings = config.settings || {};
    if (url) config.settings.npmUrl = url;
    if (email) config.settings.npmEmail = email;

    saveConfig(config);

    // Run health check for newly imported apps
    newAppsList.forEach(appItem => {
      checkAppHealth(appItem).then(health => {
        io.emit('app_health_update', { id: appItem.id, health });
      });
    });

    io.emit('config_updated', config);

    res.json({
      success: true,
      addedCount,
      totalApps: config.apps.length,
      apps: config.apps
    });
  } catch (err) {
    console.error('[NPM Import Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Export full backup
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="dashboard-backup.json"');
  res.send(JSON.stringify(config, null, 2));
});

// Import backup
app.post('/api/import', (req, res) => {
  try {
    const imported = req.body;
    if (!imported || typeof imported !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON configuration' });
    }
    config = {
      settings: imported.settings || {},
      categories: imported.categories || [],
      apps: imported.apps || []
    };
    saveConfig(config);
    startPeriodicTasks();
    io.emit('config_updated', config);
    res.json({ success: true, message: 'Configuration restored successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to import configuration: ' + err.message });
  }
});

// Container healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

// Fallback to SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 Dashboard (Dashdot + Heimdall) running on port ${PORT}`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`📁 Data Path: ${DATA_DIR}`);
  console.log(`=======================================================`);
});

// Graceful container shutdown
function gracefulShutdown(signal) {
  console.log(`[Server] Received ${signal}, shutting down gracefully...`);
  if (metricsInterval) clearInterval(metricsInterval);
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  server.close(() => {
    console.log('[Server] HTTP and WebSocket server closed.');
    process.exit(0);
  });
  // Force exit after 3 seconds if not closed
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

