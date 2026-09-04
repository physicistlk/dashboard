// Dashboard Homelab Client Application
(function () {
  'use strict';

  // Global State
  const state = {
    apps: [],
    categories: [],
    settings: {
      siteTitle: 'Dashboard',
      theme: 'glass-dark',
      customWallpaper: '',
      blurAmount: 16,
      statsRefreshMs: 2000,
      searchEngine: 'google',
      showCpuWidget: true,
      showGpuWidget: true,
      showRamWidget: true,
      showStorageWidget: true,
      showNetworkWidget: true,
      pingIntervalMs: 20000
    },
    presets: [],
    healthStatus: {},
    activeCategory: 'all',
    searchQuery: '',
    statsHistory: {
      cpu: new Array(30).fill(0),
      gpu: new Array(30).fill(0),
      ram: new Array(30).fill(0)
    },
    editingAppId: null,
    statsVisible: true,
    npmHosts: [],
    selectedNpmHostIds: new Set()
  };

  // Search Engines
  const SEARCH_ENGINES = {
    google: 'https://www.google.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    brave: 'https://search.brave.com/search?q=',
    bing: 'https://www.bing.com/search?q='
  };

  // DOM Elements
  const elements = {
    headerHostname: document.getElementById('headerHostname'),
    hostOsName: document.getElementById('hostOsName'),
    hostUptime: document.getElementById('hostUptime'),
    hostCpuTemp: document.getElementById('hostCpuTemp'),
    appSearchInput: document.getElementById('appSearchInput'),
    searchWebBtn: document.getElementById('searchWebBtn'),
    searchEngineIcon: document.getElementById('searchEngineIcon'),
    toggleStatsBtn: document.getElementById('toggleStatsBtn'),
    statsSection: document.getElementById('statsSection'),
    addAppBtn: document.getElementById('addAppBtn'),
    categoriesBtn: document.getElementById('categoriesBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    categoryTabsContainer: document.getElementById('categoryTabsContainer'),
    appsGridContainer: document.getElementById('appsGridContainer'),
    noAppsNotice: document.getElementById('noAppsNotice'),
    wallpaperOverlay: document.getElementById('wallpaperOverlay'),

    // Widgets
    cpuCard: document.getElementById('cpuCard'),
    gpuCard: document.getElementById('gpuCard'),
    ramCard: document.getElementById('ramCard'),
    storageCard: document.getElementById('storageCard'),
    networkCard: document.getElementById('networkCard'),
    cpuCirclePath: document.getElementById('cpuCirclePath'),
    cpuLoadValue: document.getElementById('cpuLoadValue'),
    cpuModelText: document.getElementById('cpuModelText'),
    cpuCoresBadge: document.getElementById('cpuCoresBadge'),
    cpuTempBadge: document.getElementById('cpuTempBadge'),
    cpuTempText: document.getElementById('cpuTempText'),
    cpuTempDetail: document.getElementById('cpuTempDetail'),
    cpuLoadAvg: document.getElementById('cpuLoadAvg'),
    cpuSparkline: document.getElementById('cpuSparkline'),
    gpuCirclePath: document.getElementById('gpuCirclePath'),
    gpuLoadValue: document.getElementById('gpuLoadValue'),
    gpuModelText: document.getElementById('gpuModelText'),
    gpuVendorBadge: document.getElementById('gpuVendorBadge'),
    gpuTempBadge: document.getElementById('gpuTempBadge'),
    gpuClockText: document.getElementById('gpuClockText'),
    gpuMemoryText: document.getElementById('gpuMemoryText'),
    gpuSparkline: document.getElementById('gpuSparkline'),
    ramCirclePath: document.getElementById('ramCirclePath'),
    ramLoadValue: document.getElementById('ramLoadValue'),
    ramUsageText: document.getElementById('ramUsageText'),
    ramAvailText: document.getElementById('ramAvailText'),
    ramTotalBadge: document.getElementById('ramTotalBadge'),
    ramSparkline: document.getElementById('ramSparkline'),
    diskListContainer: document.getElementById('diskListContainer'),
    disksCountBadge: document.getElementById('disksCountBadge'),
    netRxSpeed: document.getElementById('netRxSpeed'),
    netTxSpeed: document.getElementById('netTxSpeed'),
    netIfaceBadge: document.getElementById('netIfaceBadge'),

    // Modals
    appModal: document.getElementById('appModal'),
    appModalTitle: document.getElementById('appModalTitle'),
    appForm: document.getElementById('appForm'),
    appIdField: document.getElementById('appIdField'),
    presetSelect: document.getElementById('presetSelect'),
    appNameField: document.getElementById('appNameField'),
    appCategoryField: document.getElementById('appCategoryField'),
    appUrlField: document.getElementById('appUrlField'),
    appIconField: document.getElementById('appIconField'),
    appColorField: document.getElementById('appColorField'),
    colorHexLabel: document.getElementById('colorHexLabel'),
    appDescField: document.getElementById('appDescField'),
    appHealthCheckField: document.getElementById('appHealthCheckField'),
    appPinnedField: document.getElementById('appPinnedField'),
    iconPreview: document.getElementById('iconPreview'),
    urlTestResult: document.getElementById('urlTestResult'),

    categoryModal: document.getElementById('categoryModal'),
    newCategoryName: document.getElementById('newCategoryName'),
    categoryManagerList: document.getElementById('categoryManagerList'),

    settingsModal: document.getElementById('settingsModal'),
    settingsForm: document.getElementById('settingsForm'),
    themeSelect: document.getElementById('themeSelect'),
    wallpaperInput: document.getElementById('wallpaperInput'),
    blurSlider: document.getElementById('blurSlider'),
    blurValueLabel: document.getElementById('blurValueLabel'),
    searchEngineSelect: document.getElementById('searchEngineSelect'),
    statsRefreshSelect: document.getElementById('statsRefreshSelect'),
    pingIntervalSelect: document.getElementById('pingIntervalSelect'),
    showCpuWidgetCheck: document.getElementById('showCpuWidgetCheck'),
    showGpuWidgetCheck: document.getElementById('showGpuWidgetCheck'),
    showRamWidgetCheck: document.getElementById('showRamWidgetCheck'),
    showStorageWidgetCheck: document.getElementById('showStorageWidgetCheck'),
    showNetworkWidgetCheck: document.getElementById('showNetworkWidgetCheck'),

    // NPM Sync Modal
    syncNpmBtn: document.getElementById('syncNpmBtn'),
    npmSyncModal: document.getElementById('npmSyncModal'),
    npmConnectForm: document.getElementById('npmConnectForm'),
    npmUrlInput: document.getElementById('npmUrlInput'),
    npmEmailInput: document.getElementById('npmEmailInput'),
    npmPasswordInput: document.getElementById('npmPasswordInput'),
    npmFetchBtn: document.getElementById('npmFetchBtn'),
    npmFetchStatus: document.getElementById('npmFetchStatus'),
    npmDiscoveredSection: document.getElementById('npmDiscoveredSection'),
    npmHostsListContainer: document.getElementById('npmHostsListContainer'),
    npmHostCount: document.getElementById('npmHostCount'),
    npmImportBtn: document.getElementById('npmImportBtn'),
    npmSelectedCount: document.getElementById('npmSelectedCount')
  };

  // Helper formatting functions
  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec === 0) return '0 KB/s';
    if (bytesPerSec < 1024 * 1024) {
      return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
    }
    return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
  }

  // Draw smooth sparkline on canvas
  function drawSparkline(canvas, data, color) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!data || data.length < 2) return;

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const step = width / (data.length - 1);
    data.forEach((val, index) => {
      const x = index * step;
      // map 0-100 to height-2
      const clamped = Math.min(100, Math.max(0, val));
      const y = height - (clamped / 100) * (height - 6) - 3;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Fill gradient below line
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, color.replace(')', ', 0.3)').replace('rgb', 'rgba'));
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Initialize Socket.io Connection
  let socket = null;
  function initSocket() {
    if (typeof io === 'undefined') {
      console.warn('[Socket] Socket.io not loaded yet.');
      return;
    }

    socket = io();

    socket.on('connect', () => {
      console.log('[Socket] Connected to server.');
    });

    socket.on('host_info', (info) => {
      if (!info) return;
      if (elements.headerHostname) elements.headerHostname.textContent = info.hostname || 'Server';
      if (elements.hostOsName) elements.hostOsName.textContent = info.distro || 'Linux';
      if (elements.cpuModelText) elements.cpuModelText.textContent = info.cpuBrand || 'Host CPU';
      if (elements.cpuCoresBadge) elements.cpuCoresBadge.textContent = `${info.cpuCores || 4} Cores`;
      if (elements.ramTotalBadge) elements.ramTotalBadge.textContent = formatBytes(info.totalRamBytes, 1);
    });

    socket.on('metrics', (metrics) => {
      updateMetricsUI(metrics);
    });

    socket.on('initial_health', (healthMap) => {
      state.healthStatus = { ...state.healthStatus, ...healthMap };
      renderAppsGrid();
    });

    socket.on('app_health_update', ({ id, health }) => {
      state.healthStatus[id] = health;
      updateSingleAppHealthUI(id, health);
    });

    socket.on('config_updated', (newConfig) => {
      state.apps = newConfig.apps || [];
      state.categories = newConfig.categories || [];
      state.settings = { ...state.settings, ...(newConfig.settings || {}) };
      applySettings();
      renderCategoryTabs();
      renderAppsGrid();
    });
  }

  // Update dynamic metrics UI
  function updateMetricsUI(metrics) {
    if (!metrics) return;

    // Uptime
    if (elements.hostUptime && metrics.uptimeFormatted) {
      elements.hostUptime.textContent = `Up: ${metrics.uptimeFormatted}`;
    }

    // CPU
    if (metrics.cpu) {
      const load = metrics.cpu.loadPercent || 0;
      if (elements.cpuCirclePath) {
        elements.cpuCirclePath.setAttribute('stroke-dasharray', `${load}, 100`);
      }
      if (elements.cpuLoadValue) elements.cpuLoadValue.textContent = `${load}%`;
      if (elements.cpuLoadAvg && metrics.cpu.loadAvg) {
        elements.cpuLoadAvg.textContent = metrics.cpu.loadAvg.join(', ');
      }

      // CPU Temperature
      if (metrics.cpu.temperature !== null && metrics.cpu.temperature !== undefined) {
        const t = metrics.cpu.temperature;
        const tempStr = `${t}°C`;
        const tempClass = 'badge badge-temp ' + (t > 80 ? 'temp-hot' : (t > 65 ? 'temp-warm' : 'temp-cool'));
        if (elements.cpuTempBadge) {
          elements.cpuTempBadge.textContent = tempStr;
          elements.cpuTempBadge.className = tempClass;
          elements.cpuTempBadge.style.display = 'inline-flex';
        }
        if (elements.cpuTempText) elements.cpuTempText.textContent = tempStr;
        if (elements.hostCpuTemp) {
          elements.hostCpuTemp.textContent = tempStr;
          elements.hostCpuTemp.style.display = 'inline';
        }
        if (elements.cpuTempDetail) elements.cpuTempDetail.style.display = 'inline';
      } else {
        if (elements.cpuTempBadge) elements.cpuTempBadge.style.display = 'none';
        if (elements.hostCpuTemp) elements.hostCpuTemp.style.display = 'none';
        if (elements.cpuTempDetail) elements.cpuTempDetail.style.display = 'none';
      }

      state.statsHistory.cpu.shift();
      state.statsHistory.cpu.push(load);
      drawSparkline(elements.cpuSparkline, state.statsHistory.cpu, 'rgb(56, 189, 248)');
    }

    // GPU
    if (metrics.gpu) {
      const g = metrics.gpu;
      const gpuLoad = g.loadPercent || 0;
      if (elements.gpuCirclePath) {
        elements.gpuCirclePath.setAttribute('stroke-dasharray', `${gpuLoad}, 100`);
      }
      if (elements.gpuLoadValue) elements.gpuLoadValue.textContent = `${gpuLoad}%`;
      if (elements.gpuModelText && g.name) elements.gpuModelText.textContent = g.name;
      if (elements.gpuVendorBadge && g.vendor) elements.gpuVendorBadge.textContent = g.vendor;

      // GPU Temperature
      if (elements.gpuTempBadge) {
        if (g.temperature !== null && g.temperature !== undefined) {
          const gt = g.temperature;
          elements.gpuTempBadge.textContent = `${gt}°C`;
          elements.gpuTempBadge.className = 'badge badge-temp ' + (gt > 80 ? 'temp-hot' : (gt > 65 ? 'temp-warm' : 'temp-cool'));
          elements.gpuTempBadge.style.display = 'inline-flex';
        } else {
          elements.gpuTempBadge.style.display = 'none';
        }
      }

      // GPU Clock
      if (elements.gpuClockText) {
        if (g.clockMhz) {
          elements.gpuClockText.textContent = `${g.clockMhz} MHz`;
        } else {
          elements.gpuClockText.textContent = 'Active';
        }
      }

      // GPU Memory
      if (elements.gpuMemoryText) {
        if (g.memoryTotal && g.memoryTotal > 0) {
          if (g.memoryUsed && g.memoryUsed > 0) {
            elements.gpuMemoryText.textContent = `${formatBytes(g.memoryUsed)} / ${formatBytes(g.memoryTotal)}`;
          } else {
            elements.gpuMemoryText.textContent = formatBytes(g.memoryTotal);
          }
        } else {
          elements.gpuMemoryText.textContent = 'Shared';
        }
      }

      state.statsHistory.gpu.shift();
      state.statsHistory.gpu.push(gpuLoad);
      drawSparkline(elements.gpuSparkline, state.statsHistory.gpu, 'rgb(6, 182, 212)');
    }

    // RAM
    if (metrics.ram) {
      const percent = metrics.ram.usePercent || 0;
      if (elements.ramCirclePath) {
        elements.ramCirclePath.setAttribute('stroke-dasharray', `${percent}, 100`);
      }
      if (elements.ramLoadValue) elements.ramLoadValue.textContent = `${percent}%`;
      if (elements.ramUsageText) {
        elements.ramUsageText.textContent = `${formatBytes(metrics.ram.used)} / ${formatBytes(metrics.ram.total)}`;
      }
      if (elements.ramAvailText) {
        elements.ramAvailText.textContent = formatBytes(metrics.ram.free);
      }

      state.statsHistory.ram.shift();
      state.statsHistory.ram.push(percent);
      drawSparkline(elements.ramSparkline, state.statsHistory.ram, 'rgb(168, 85, 247)');
    }

    // Disks
    if (metrics.disks && elements.diskListContainer) {
      elements.disksCountBadge.textContent = `${metrics.disks.length} Mounted`;
      if (metrics.disks.length === 0) {
        elements.diskListContainer.innerHTML = '<div class="disk-item-placeholder">No mounted disks detected.</div>';
      } else {
        elements.diskListContainer.innerHTML = metrics.disks.map(d => {
          let statusClass = 'normal';
          if (d.usePercent > 85) statusClass = 'danger';
          else if (d.usePercent > 70) statusClass = 'warning';

          return `
            <div class="disk-item">
              <div class="disk-header">
                <span class="disk-mount" title="${d.mount}">${d.mount}</span>
                <span class="disk-stats">${formatBytes(d.used)} / ${formatBytes(d.size)} (${d.usePercent}%)</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill ${statusClass}" style="width: ${d.usePercent}%"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Network
    if (metrics.network) {
      if (elements.netRxSpeed) elements.netRxSpeed.textContent = formatSpeed(metrics.network.rx_sec);
      if (elements.netTxSpeed) elements.netTxSpeed.textContent = formatSpeed(metrics.network.tx_sec);
      if (elements.netIfaceBadge) elements.netIfaceBadge.textContent = metrics.network.iface || 'eth0';
    }
  }

  // Fetch initial data via REST API
  async function loadInitialData() {
    try {
      const [appsRes, catsRes, settingsRes, presetsRes, infoRes] = await Promise.all([
        fetch('/api/apps').then(r => r.json()),
        fetch('/api/categories').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/presets').then(r => r.json()),
        fetch('/api/system/info').then(r => r.json())
      ]);

      state.apps = appsRes || [];
      state.categories = catsRes || [];
      state.settings = { ...state.settings, ...settingsRes };
      state.presets = presetsRes || [];

      // Extract health map
      state.apps.forEach(a => {
        if (a.health) state.healthStatus[a.id] = a.health;
      });

      if (infoRes) {
        if (elements.headerHostname) elements.headerHostname.textContent = infoRes.hostname || 'Server';
        if (elements.hostOsName) elements.hostOsName.textContent = infoRes.distro || 'Linux';
        if (elements.cpuModelText) elements.cpuModelText.textContent = infoRes.cpuBrand || 'Host CPU';
        if (elements.cpuCoresBadge) elements.cpuCoresBadge.textContent = `${infoRes.cpuCores || 4} Cores`;
        if (elements.ramTotalBadge) elements.ramTotalBadge.textContent = formatBytes(infoRes.totalRamBytes, 1);
      }

      applySettings();
      populatePresetDropdown();
      renderCategoryTabs();
      renderAppsGrid();
    } catch (err) {
      console.error('[App] Failed to load initial data:', err);
    }
  }

  // Apply Settings & Themes
  function applySettings() {
    const s = state.settings;
    if (s.theme) {
      document.body.className = `theme-${s.theme}`;
      if (elements.themeSelect) elements.themeSelect.value = s.theme;
    }

    if (elements.wallpaperOverlay) {
      if (s.customWallpaper) {
        elements.wallpaperOverlay.style.backgroundImage = `url('${s.customWallpaper}')`;
        elements.wallpaperOverlay.style.opacity = '0.4';
      } else {
        elements.wallpaperOverlay.style.backgroundImage = 'none';
        elements.wallpaperOverlay.style.opacity = '0';
      }
    }

    if (s.blurAmount !== undefined) {
      document.documentElement.style.setProperty('--blur-amount', `${s.blurAmount}px`);
      if (elements.blurSlider) elements.blurSlider.value = s.blurAmount;
      if (elements.blurValueLabel) elements.blurValueLabel.textContent = `${s.blurAmount}px`;
    }

    if (elements.searchEngineSelect && s.searchEngine) {
      elements.searchEngineSelect.value = s.searchEngine;
    }

    // Toggle widgets
    if (elements.cpuCard) elements.cpuCard.style.display = s.showCpuWidget !== false ? 'flex' : 'none';
    if (elements.gpuCard) elements.gpuCard.style.display = s.showGpuWidget !== false ? 'flex' : 'none';
    if (elements.ramCard) elements.ramCard.style.display = s.showRamWidget !== false ? 'flex' : 'none';
    if (elements.storageCard) elements.storageCard.style.display = s.showStorageWidget !== false ? 'flex' : 'none';
    if (elements.networkCard) elements.networkCard.style.display = s.showNetworkWidget !== false ? 'flex' : 'none';
  }

  // Category Tabs Rendering
  function renderCategoryTabs() {
    if (!elements.categoryTabsContainer) return;

    const allCount = state.apps.length;
    let html = `
      <button class="category-tab-btn ${state.activeCategory === 'all' ? 'active' : ''}" onclick="window.dashboard.selectCategory('all')">
        ${getIconSvg('grid', 'currentColor', 16)}
        <span>All</span>
        <span class="cat-count">${allCount}</span>
      </button>
    `;

    state.categories.forEach(cat => {
      if (cat.id === 'all') return;
      const count = state.apps.filter(a => a.category?.toLowerCase() === cat.id.toLowerCase()).length;
      const iconSvg = getIconSvg(cat.icon || 'folder', 'currentColor', 16);
      html += `
        <button class="category-tab-btn ${state.activeCategory === cat.id ? 'active' : ''}" onclick="window.dashboard.selectCategory('${cat.id}')">
          ${iconSvg}
          <span>${cat.name}</span>
          <span class="cat-count">${count}</span>
        </button>
      `;
    });

    elements.categoryTabsContainer.innerHTML = html;
  }

  // Select Category
  window.dashboard = window.dashboard || {};
  window.dashboard.selectCategory = function (catId) {
    state.activeCategory = catId;
    renderCategoryTabs();
    renderAppsGrid();
  };

  // Render Apps Grid
  function renderAppsGrid() {
    if (!elements.appsGridContainer) return;

    let filtered = state.apps.slice();

    // Category Filter
    if (state.activeCategory !== 'all') {
      filtered = filtered.filter(a => a.category?.toLowerCase() === state.activeCategory.toLowerCase());
    }

    // Search Query Filter
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(a =>
        a.name?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q) ||
        a.url?.toLowerCase().includes(q)
      );
    }

    // Sort: Pinned first, then alphabetically
    filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    if (filtered.length === 0) {
      elements.appsGridContainer.innerHTML = '';
      if (elements.noAppsNotice) elements.noAppsNotice.style.display = 'flex';
      return;
    }

    if (elements.noAppsNotice) elements.noAppsNotice.style.display = 'none';

    elements.appsGridContainer.innerHTML = filtered.map(app => {
      const health = state.healthStatus[app.id] || { status: 'unknown' };
      const statusHtml = getHealthBadgeHtml(health);
      const iconHtml = renderAppIcon(app);
      const appColor = app.color || '#38bdf8';

      return `
        <div class="app-card" style="--app-color: ${appColor};" onclick="window.dashboard.openApp('${encodeURIComponent(app.url)}')">
          <div class="app-accent-bar"></div>
          
          <div class="app-card-top">
            <div class="app-icon-wrapper">
              ${iconHtml}
            </div>
            <div id="healthBadge_${app.id}" class="app-status-badge" title="${getHealthTitle(health)}">
              ${statusHtml}
            </div>
          </div>

          <div class="app-card-content">
            <div class="app-title-row">
              <span class="app-title">${escapeHtml(app.name)}</span>
              ${app.pinned ? `<span class="pin-icon" title="Pinned">${ICONS.pin}</span>` : ''}
            </div>
            <span class="app-desc">${escapeHtml(app.description || '')}</span>
          </div>

          <div class="app-card-actions">
            <span class="app-url-preview">${formatUrlPreview(app.url)}</span>
            <div class="card-action-btns" onclick="event.stopPropagation()">
              <button class="mini-action-btn" title="Ping Service" onclick="window.dashboard.pingApp('${app.id}')">
                ${ICONS['refresh-cw']}
              </button>
              <button class="mini-action-btn" title="Edit App" onclick="window.dashboard.openEditAppModal('${app.id}')">
                ${ICONS.edit}
              </button>
              <button class="mini-action-btn delete-btn" title="Delete App" onclick="window.dashboard.deleteApp('${app.id}', '${escapeHtml(app.name)}')">
                ${ICONS.trash}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Health Badge Generator
  function getHealthBadgeHtml(health) {
    if (!health || health.status === 'unknown') {
      return `<span class="status-dot unknown"></span><span>Checking</span>`;
    }
    if (health.status === 'online') {
      const ms = health.latencyMs ? `${health.latencyMs}ms` : 'Online';
      return `<span class="status-dot online"></span><span>${ms}</span>`;
    }
    return `<span class="status-dot offline"></span><span>Offline</span>`;
  }

  function getHealthTitle(health) {
    if (!health) return 'Status unknown';
    if (health.status === 'online') {
      return `Online (HTTP ${health.statusCode || 200}, ${health.latencyMs}ms)`;
    }
    if (health.status === 'offline') {
      return `Offline (${health.error || 'Connection Failed'})`;
    }
    return 'Checking status...';
  }

  function updateSingleAppHealthUI(id, health) {
    const el = document.getElementById(`healthBadge_${id}`);
    if (el) {
      el.innerHTML = getHealthBadgeHtml(health);
      el.setAttribute('title', getHealthTitle(health));
    }
  }

  // App Icon Renderer
  function renderAppIcon(app) {
    const icon = app.icon || 'globe';
    if (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:image')) {
      return `<img src="${icon}" alt="${escapeHtml(app.name)}" class="app-icon-img" onerror="this.src=''; this.parentElement.innerHTML=getIconSvg('globe', '${app.color || '#38bdf8'}', 24)">`;
    }
    return getIconSvg(icon, app.color || '#38bdf8', 24);
  }

  function formatUrlPreview(urlStr) {
    try {
      const u = new URL(urlStr);
      return u.host + (u.pathname !== '/' ? u.pathname : '');
    } catch (_) {
      return urlStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Open App in New Tab
  window.dashboard.openApp = function (encodedUrl) {
    const url = decodeURIComponent(encodedUrl);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Ping single app
  window.dashboard.pingApp = async function (appId) {
    const badge = document.getElementById(`healthBadge_${appId}`);
    if (badge) {
      badge.innerHTML = `<span class="status-dot unknown"></span><span>Pinging</span>`;
    }
    try {
      const res = await fetch(`/api/ping/${appId}`, { method: 'POST' }).then(r => r.json());
      state.healthStatus[appId] = res;
      updateSingleAppHealthUI(appId, res);
    } catch (err) {
      console.error('Ping failed:', err);
    }
  };

  // Delete App
  window.dashboard.deleteApp = async function (appId, appName) {
    if (!confirm(`Are you sure you want to remove "${appName}"?`)) return;
    try {
      await fetch(`/api/apps/${appId}`, { method: 'DELETE' });
      state.apps = state.apps.filter(a => a.id !== appId);
      delete state.healthStatus[appId];
      renderCategoryTabs();
      renderAppsGrid();
    } catch (err) {
      alert('Failed to delete app: ' + err.message);
    }
  };

  // Presets dropdown population
  function populatePresetDropdown() {
    if (!elements.presetSelect) return;
    let html = '<option value="">-- Custom Application (or choose preset) --</option>';
    state.presets.forEach(p => {
      html += `<option value="${p.id}">${escapeHtml(p.name)} (${p.category})</option>`;
    });
    elements.presetSelect.innerHTML = html;
  }

  // Handle Preset Select Autocomplete
  window.handlePresetSelect = function (presetId) {
    if (!presetId) return;
    const preset = state.presets.find(p => p.id === presetId);
    if (!preset) return;

    elements.appNameField.value = preset.name;
    elements.appCategoryField.value = preset.category.toLowerCase().replace(/[^a-z0-9]/g, '-');
    elements.appDescField.value = preset.description || '';
    elements.appColorField.value = preset.color || '#38bdf8';
    elements.colorHexLabel.textContent = preset.color || '#38bdf8';
    elements.appIconField.value = preset.icon || 'globe';

    // Default URL with server hostname/IP
    const host = window.location.hostname || 'localhost';
    elements.appUrlField.value = `http://${host}:${preset.defaultPort}`;

    updateIconPreview();
  };

  // Update Icon Preview in Modal
  function updateIconPreview() {
    if (!elements.iconPreview) return;
    const val = elements.appIconField.value.trim() || 'globe';
    const color = elements.appColorField.value || '#38bdf8';
    if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image')) {
      elements.iconPreview.innerHTML = `<img src="${val}" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
      elements.iconPreview.innerHTML = getIconSvg(val, color, 24);
    }
  }

  if (elements.appIconField) {
    elements.appIconField.addEventListener('input', updateIconPreview);
  }
  if (elements.appColorField) {
    elements.appColorField.addEventListener('input', (e) => {
      elements.colorHexLabel.textContent = e.target.value;
      updateIconPreview();
    });
  }

  // Populate category select in app form
  function populateCategorySelect() {
    if (!elements.appCategoryField) return;
    let html = '';
    state.categories.forEach(c => {
      html += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
    });
    elements.appCategoryField.innerHTML = html;
  }

  // Open Add App Modal
  window.openAddAppModal = function () {
    state.editingAppId = null;
    elements.appModalTitle.textContent = 'Add Application';
    elements.appForm.reset();
    elements.appIdField.value = '';
    elements.presetSelect.value = '';
    elements.appColorField.value = '#38bdf8';
    elements.colorHexLabel.textContent = '#38bdf8';
    elements.urlTestResult.textContent = '';
    populateCategorySelect();
    updateIconPreview();
    elements.appModal.style.display = 'flex';
    elements.appNameField.focus();
  };

  // Open Edit App Modal
  window.dashboard.openEditAppModal = function (appId) {
    const app = state.apps.find(a => a.id === appId);
    if (!app) return;

    state.editingAppId = appId;
    elements.appModalTitle.textContent = `Edit ${app.name}`;
    elements.appIdField.value = app.id;
    elements.presetSelect.value = '';
    populateCategorySelect();

    elements.appNameField.value = app.name || '';
    elements.appCategoryField.value = app.category || 'all';
    elements.appUrlField.value = app.url || '';
    elements.appDescField.value = app.description || '';
    elements.appIconField.value = app.icon || 'globe';
    elements.appColorField.value = app.color || '#38bdf8';
    elements.colorHexLabel.textContent = app.color || '#38bdf8';
    elements.appHealthCheckField.checked = app.healthCheck !== false;
    elements.appPinnedField.checked = Boolean(app.pinned);
    elements.urlTestResult.textContent = '';

    updateIconPreview();
    elements.appModal.style.display = 'flex';
  };

  window.closeAppModal = function () {
    elements.appModal.style.display = 'none';
  };

  // Test Ping from Modal
  window.testAppUrlPing = async function () {
    const url = elements.appUrlField.value.trim();
    if (!url) {
      elements.urlTestResult.textContent = 'Please enter a URL first.';
      elements.urlTestResult.style.color = 'var(--accent-red)';
      return;
    }

    elements.urlTestResult.textContent = 'Testing connectivity...';
    elements.urlTestResult.style.color = 'var(--accent-cyan)';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const startTime = Date.now();

      await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
      clearTimeout(timeout);
      const latency = Date.now() - startTime;
      elements.urlTestResult.textContent = `✓ Server responded (${latency}ms)`;
      elements.urlTestResult.style.color = 'var(--accent-green)';
    } catch (_) {
      elements.urlTestResult.textContent = 'Notice: Browser CORS may restrict direct browser ping. The container backend will test via server-side ping.';
      elements.urlTestResult.style.color = 'var(--text-muted)';
    }
  };

  // Save Application
  window.handleSaveApp = async function (e) {
    e.preventDefault();
    const appData = {
      name: elements.appNameField.value.trim(),
      category: elements.appCategoryField.value,
      url: elements.appUrlField.value.trim(),
      description: elements.appDescField.value.trim(),
      icon: elements.appIconField.value.trim() || 'globe',
      color: elements.appColorField.value || '#38bdf8',
      healthCheck: elements.appHealthCheckField.checked,
      pinned: elements.appPinnedField.checked
    };

    const submitBtn = document.getElementById('saveAppSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      if (state.editingAppId) {
        // PUT update
        const updated = await fetch(`/api/apps/${state.editingAppId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appData)
        }).then(r => r.json());

        const idx = state.apps.findIndex(a => a.id === state.editingAppId);
        if (idx !== -1) state.apps[idx] = updated;
      } else {
        // POST create
        const created = await fetch('/api/apps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appData)
        }).then(r => r.json());

        state.apps.push(created);
      }

      closeAppModal();
      renderCategoryTabs();
      renderAppsGrid();
    } catch (err) {
      alert('Error saving app: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Application';
    }
  };

  // Category Manager Modal
  window.openCategoryModal = function () {
    renderCategoryManagerList();
    elements.categoryModal.style.display = 'flex';
    elements.newCategoryName.focus();
  };

  window.closeCategoryModal = function () {
    elements.categoryModal.style.display = 'none';
  };

  function renderCategoryManagerList() {
    if (!elements.categoryManagerList) return;
    elements.categoryManagerList.innerHTML = state.categories.map(c => `
      <div class="category-item-row">
        <span>${escapeHtml(c.name)} (${c.id})</span>
        ${c.id !== 'all' ? `
          <button class="mini-action-btn delete-btn" title="Delete Category" onclick="window.dashboard.deleteCategory('${c.id}')">
            ${ICONS.trash}
          </button>
        ` : '<span style="font-size:0.75rem; color:var(--text-subtle);">Default</span>'}
      </div>
    `).join('');
  }

  window.handleAddCategory = async function () {
    const name = elements.newCategoryName.value.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (state.categories.some(c => c.id === id)) {
      alert('Category already exists.');
      return;
    }

    state.categories.push({ id, name, icon: 'folder' });
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: state.categories })
      });
      elements.newCategoryName.value = '';
      renderCategoryManagerList();
      renderCategoryTabs();
    } catch (err) {
      alert('Failed to add category: ' + err.message);
    }
  };

  window.dashboard.deleteCategory = async function (catId) {
    if (catId === 'all') return;
    state.categories = state.categories.filter(c => c.id !== catId);
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: state.categories })
      });
      if (state.activeCategory === catId) state.activeCategory = 'all';
      renderCategoryManagerList();
      renderCategoryTabs();
      renderAppsGrid();
    } catch (err) {
      alert('Failed to delete category: ' + err.message);
    }
  };

  // Settings Modal
  window.openSettingsModal = function () {
    elements.themeSelect.value = state.settings.theme || 'glass-dark';
    elements.wallpaperInput.value = state.settings.customWallpaper || '';
    elements.blurSlider.value = state.settings.blurAmount !== undefined ? state.settings.blurAmount : 16;
    elements.blurValueLabel.textContent = `${elements.blurSlider.value}px`;
    elements.searchEngineSelect.value = state.settings.searchEngine || 'google';
    elements.statsRefreshSelect.value = state.settings.statsRefreshMs || 2000;
    elements.pingIntervalSelect.value = state.settings.pingIntervalMs || 20000;

    elements.showCpuWidgetCheck.checked = state.settings.showCpuWidget !== false;
    if (elements.showGpuWidgetCheck) elements.showGpuWidgetCheck.checked = state.settings.showGpuWidget !== false;
    elements.showRamWidgetCheck.checked = state.settings.showRamWidget !== false;
    elements.showStorageWidgetCheck.checked = state.settings.showStorageWidget !== false;
    elements.showNetworkWidgetCheck.checked = state.settings.showNetworkWidget !== false;

    elements.settingsModal.style.display = 'flex';
  };

  window.closeSettingsModal = function () {
    elements.settingsModal.style.display = 'none';
  };

  window.handleThemeChange = function (newTheme) {
    document.body.className = `theme-${newTheme}`;
  };

  window.handleBlurChange = function (val) {
    elements.blurValueLabel.textContent = `${val}px`;
    document.documentElement.style.setProperty('--blur-amount', `${val}px`);
  };

  window.handleSaveSettings = async function (e) {
    e.preventDefault();
    const updatedSettings = {
      theme: elements.themeSelect.value,
      customWallpaper: elements.wallpaperInput.value.trim(),
      blurAmount: parseInt(elements.blurSlider.value, 10),
      searchEngine: elements.searchEngineSelect.value,
      statsRefreshMs: parseInt(elements.statsRefreshSelect.value, 10),
      pingIntervalMs: parseInt(elements.pingIntervalSelect.value, 10),
      showCpuWidget: elements.showCpuWidgetCheck.checked,
      showGpuWidget: elements.showGpuWidgetCheck ? elements.showGpuWidgetCheck.checked : true,
      showRamWidget: elements.showRamWidgetCheck.checked,
      showStorageWidget: elements.showStorageWidgetCheck.checked,
      showNetworkWidget: elements.showNetworkWidgetCheck.checked
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      }).then(r => r.json());

      state.settings = { ...state.settings, ...res };
      applySettings();
      closeSettingsModal();
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    }
  };

  // Download Backup JSON
  window.downloadBackup = function () {
    window.location.href = '/api/export';
  };

  // Restore Backup JSON
  window.handleImportBackup = async function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        }).then(r => r.json());

        if (res.success) {
          alert('Configuration imported successfully! Reloading...');
          window.location.reload();
        } else {
          alert('Import failed: ' + (res.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // --- Nginx Proxy Manager Sync Handlers ---
  window.openNpmSyncModal = async function () {
    if (!elements.npmSyncModal) return;
    elements.npmSyncModal.style.display = 'flex';
    if (elements.npmFetchStatus) elements.npmFetchStatus.style.display = 'none';

    // Fetch defaults from server if available
    try {
      const res = await fetch('/api/npm/config').then(r => r.json());
      if (res.url && elements.npmUrlInput && !elements.npmUrlInput.value) {
        elements.npmUrlInput.value = res.url;
      }
      if (res.email && elements.npmEmailInput && !elements.npmEmailInput.value) {
        elements.npmEmailInput.value = res.email;
      }
    } catch (_) {}
  };

  window.closeNpmSyncModal = function () {
    if (elements.npmSyncModal) elements.npmSyncModal.style.display = 'none';
  };

  window.handleFetchNpmHosts = async function (e) {
    if (e) e.preventDefault();
    const url = elements.npmUrlInput.value.trim();
    const email = elements.npmEmailInput.value.trim();
    const password = elements.npmPasswordInput.value;

    if (!url || !email || !password) {
      showNpmStatus('Please fill in NPM URL, Email, and Password.', 'error');
      return;
    }

    elements.npmFetchBtn.disabled = true;
    elements.npmFetchBtn.innerHTML = `<span>Connecting...</span>`;
    showNpmStatus(`Connecting to ${url} on the proxy network...`, 'info');

    try {
      const res = await fetch('/api/npm/hosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email, password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch hosts');
      }

      state.npmHosts = data.hosts || [];
      state.selectedNpmHostIds.clear();

      // Automatically select newly found hosts
      state.npmHosts.forEach(h => {
        if (!h.alreadyAdded) {
          state.selectedNpmHostIds.add(h.npmId);
        }
      });

      showNpmStatus(`Successfully connected! Found ${state.npmHosts.length} proxy host(s).`, 'success');
      renderNpmHostsList();
    } catch (err) {
      showNpmStatus(err.message, 'error');
      if (elements.npmDiscoveredSection) elements.npmDiscoveredSection.style.display = 'none';
      if (elements.npmImportBtn) elements.npmImportBtn.style.display = 'none';
    } finally {
      elements.npmFetchBtn.disabled = false;
      elements.npmFetchBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Fetch Hosts</span>
      `;
    }
  };

  function showNpmStatus(message, type) {
    if (!elements.npmFetchStatus) return;
    elements.npmFetchStatus.textContent = message;
    elements.npmFetchStatus.className = `npm-status-banner ${type}`;
    elements.npmFetchStatus.style.display = 'block';
  }

  function renderNpmHostsList() {
    if (!state.npmHosts || state.npmHosts.length === 0) {
      if (elements.npmDiscoveredSection) elements.npmDiscoveredSection.style.display = 'none';
      if (elements.npmImportBtn) elements.npmImportBtn.style.display = 'none';
      return;
    }

    if (elements.npmHostCount) elements.npmHostCount.textContent = state.npmHosts.length;
    if (elements.npmDiscoveredSection) elements.npmDiscoveredSection.style.display = 'block';
    updateNpmSelectedCount();

    elements.npmHostsListContainer.innerHTML = state.npmHosts.map(host => {
      const isSelected = state.selectedNpmHostIds.has(host.npmId);
      const iconSvg = getIconSvg(host.icon || 'globe', '#ffffff', 20);
      return `
        <div class="discovered-host-card ${host.alreadyAdded ? 'already-added' : ''}" onclick="window.handleCardClick(event, ${host.npmId})">
          <input type="checkbox" class="discovered-host-checkbox" 
            id="npm_check_${host.npmId}" 
            ${isSelected ? 'checked' : ''} 
            onchange="window.handleToggleNpmHost(${host.npmId}, this.checked)">
          
          <div class="discovered-host-icon" style="background: ${host.color || '#3B82F6'};">
            ${iconSvg}
          </div>

          <div class="discovered-host-info">
            <div class="discovered-host-name-row">
              <span class="discovered-host-name">${escapeHtml(host.name)}</span>
              <div class="discovered-host-badges">
                ${host.alreadyAdded 
                  ? '<span class="badge-added">Already in Dashboard</span>' 
                  : '<span class="badge-new">New</span>'}
              </div>
            </div>
            <a href="${escapeHtml(host.url)}" target="_blank" class="discovered-host-url" onclick="event.stopPropagation()">
              ${escapeHtml(host.url)}
            </a>
            <div class="discovered-host-meta">
              Target: ${escapeHtml(host.forwardHost)}:${escapeHtml(String(host.forwardPort))} • Category: ${escapeHtml(host.category)}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.handleCardClick = function (e, npmId) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'A') return;
    const isChecked = state.selectedNpmHostIds.has(npmId);
    window.handleToggleNpmHost(npmId, !isChecked);
    const cb = document.getElementById(`npm_check_${npmId}`);
    if (cb) cb.checked = !isChecked;
  };

  window.handleToggleNpmHost = function (npmId, checked) {
    if (checked) {
      state.selectedNpmHostIds.add(npmId);
    } else {
      state.selectedNpmHostIds.delete(npmId);
    }
    updateNpmSelectedCount();
  };

  window.handleSelectAllNpm = function (newOnly) {
    state.selectedNpmHostIds.clear();
    state.npmHosts.forEach(h => {
      if (!newOnly || !h.alreadyAdded) {
        state.selectedNpmHostIds.add(h.npmId);
      }
    });
    state.npmHosts.forEach(h => {
      const cb = document.getElementById(`npm_check_${h.npmId}`);
      if (cb) cb.checked = state.selectedNpmHostIds.has(h.npmId);
    });
    updateNpmSelectedCount();
  };

  function updateNpmSelectedCount() {
    const count = state.selectedNpmHostIds.size;
    if (elements.npmSelectedCount) elements.npmSelectedCount.textContent = count;
    if (elements.npmImportBtn) elements.npmImportBtn.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  window.handleImportSelectedNpm = async function () {
    const selectedHosts = state.npmHosts.filter(h => state.selectedNpmHostIds.has(h.npmId));
    if (selectedHosts.length === 0) return;

    elements.npmImportBtn.disabled = true;
    elements.npmImportBtn.textContent = 'Importing...';

    const url = elements.npmUrlInput.value.trim();
    const email = elements.npmEmailInput.value.trim();

    try {
      const res = await fetch('/api/npm/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          email,
          hosts: selectedHosts
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to import selected hosts');
      }

      showNpmStatus(`Successfully imported ${data.addedCount} apps to your dashboard!`, 'success');
      setTimeout(() => {
        closeNpmSyncModal();
      }, 900);
    } catch (err) {
      showNpmStatus('Import failed: ' + err.message, 'error');
    } finally {
      elements.npmImportBtn.disabled = false;
      updateNpmSelectedCount();
    }
  };

  // Web Search & Filter Handler
  function executeWebSearch(query) {
    if (!query) return;
    const engine = state.settings.searchEngine || 'google';
    const baseUrl = SEARCH_ENGINES[engine] || SEARCH_ENGINES.google;
    window.open(baseUrl + encodeURIComponent(query), '_blank');
  }

  // Event Listeners
  function bindEvents() {
    // Add App button
    if (elements.addAppBtn) elements.addAppBtn.addEventListener('click', window.openAddAppModal);

    // Sync Proxy button
    if (elements.syncNpmBtn) elements.syncNpmBtn.addEventListener('click', window.openNpmSyncModal);

    // Categories button
    if (elements.categoriesBtn) elements.categoriesBtn.addEventListener('click', window.openCategoryModal);

    // Settings button
    if (elements.settingsBtn) elements.settingsBtn.addEventListener('click', window.openSettingsModal);

    // Toggle stats section
    if (elements.toggleStatsBtn) {
      elements.toggleStatsBtn.addEventListener('click', () => {
        state.statsVisible = !state.statsVisible;
        if (elements.statsSection) {
          elements.statsSection.classList.toggle('collapsed', !state.statsVisible);
        }
      });
    }

    // Live search input
    if (elements.appSearchInput) {
      elements.appSearchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        renderAppsGrid();
      });

      elements.appSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const q = elements.appSearchInput.value.trim();
          if (q) executeWebSearch(q);
        }
      });
    }

    // Search Web button
    if (elements.searchWebBtn) {
      elements.searchWebBtn.addEventListener('click', () => {
        const q = elements.appSearchInput.value.trim();
        if (q) executeWebSearch(q);
        else elements.appSearchInput.focus();
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // If pressing '/' while not in an input, focus search
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        elements.appSearchInput.focus();
        elements.appSearchInput.select();
      }
      // Escape closes modals
      if (e.key === 'Escape') {
        if (elements.appModal && elements.appModal.style.display === 'flex') closeAppModal();
        if (elements.categoryModal && elements.categoryModal.style.display === 'flex') closeCategoryModal();
        if (elements.settingsModal && elements.settingsModal.style.display === 'flex') closeSettingsModal();
        if (elements.npmSyncModal && elements.npmSyncModal.style.display === 'flex') closeNpmSyncModal();
      }
    });
  }

  // Bootstrap Application
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadInitialData();
    initSocket();
  });
})();
