# 🚀 Dashboard — Combined Dash. (Dashdot) & Heimdall Container

> [!CAUTION]
> This project is made using agy2. Caution is advised for use and app stability.

A modern, unified homelab web portal and server dashboard built for mini PCs and homelab servers. It fuses the real-time hardware telemetry and glassmorphic aesthetic of **dash.** (Dashdot) with the customizable application launcher, category management, and service health checks of **Heimdall**.

---

## 🌟 Key Features

### 1. 📊 Dash. (Dashdot) Real-Time Telemetry
- **Processor (CPU)**: Real-time CPU load percentage gauge, cores breakdown, load averages (`1m`, `5m`, `15m`), and live 60 FPS scrolling Canvas sparkline history.
- **CPU Temperature**: Real-time thermal sensor readings (e.g., `58°C`) with color-coded alerts (`<65°C` normal, `65°C-80°C` warm, `>80°C` high load), displayed on the CPU card and header specs pill.
- **Graphics (GPU)**: Real-time GPU utilization % donut gauge, active clock speed (MHz), VRAM allocation, GPU temperature, and live sparkline graph. Supports:
  - **Intel iGPUs & Arc**: Frequency-based & load telemetry via `/dev/dri` (ideal for Intel N100, N95, Core i3/i5/i7/Ultra Mini PCs).
  - **AMD Radeon APUs & GPUs**: Load & thermal readings via `/sys/class/drm/` and `gpu_busy_percent`.
  - **NVIDIA GPUs**: Native `nvidia-smi` queries for utilization, VRAM, clock, and temperature.
- **Memory (RAM)**: Real-time RAM utilization gauge, used / total capacity, available/free memory, and sparkline chart.
- **Drive Capacity (Mounted Partitions)**: Automatic detection and consolidation of mounted disk partitions with dynamic usage progress bars, partition deduplication, mount points, and color-coded threshold warnings (`normal`, `warning > 70%`, `danger > 85%`).
- **Network Traffic**: Live RX (download) and TX (upload) bandwidth throughput meters (`KB/s` / `MB/s`) and active interface badge.
- **Host Specs & Uptime**: Distro name, Linux kernel version, hardware model, hostname, and live uptime counter.

### 2. 🗂️ Heimdall Application Launcher
- **App Grid & Tiles**: Sleek cards with brand color accent bars, application title, subtitle/description, URL preview, and quick actions.
- **50+ Preloaded Presets**: Autocomplete preset definitions for popular homelab services (Portainer, Pi-hole, AdGuard Home, Home Assistant, Plex, Jellyfin, Nextcloud, Nginx Proxy Manager, Uptime Kuma, qBittorrent, Grafana, Proxmox, TrueNAS, Tailscale, etc.).
- **Categories & Filtering**: Categorize apps into *Infrastructure*, *Networking*, *Media*, *Smart Home*, *Storage*, *Tools*, or create your own custom categories.
- **Real-Time Health Ping Checks**: Periodic non-blocking background probes test service availability and display live status pills with latency (e.g., `🟢 14ms` or `🔴 Offline`).
- **Pin to Top**: Pin your most frequently used services to the top of the dashboard.

### 3. 🔍 Unified Search & Web Launcher
- Instant keystroke filtering of applications by name, description, category, or URL.
- Press `/` anywhere on the dashboard to immediately focus the search bar.
- Hit `Enter` or click **Search** to execute a web search using your preferred search engine (Google, DuckDuckGo, Brave, or Bing).

### 4. 🎨 Glassmorphism & Themes
- **Built-in Themes**: Dash Glass Dark (default), Glass Light, OLED Pitch Black, Cyberpunk Neon, and Nord Frost.
- **Custom Wallpaper**: Set any custom wallpaper URL with configurable frosted glass blur (`0px` - `30px`).
- **Toggleable Widgets**: Show or hide individual hardware monitoring widgets.

### 5. 💾 Zero-Lock-In Persistence & Backups
- Persistent configuration stored in `/app/data/config.json`.
- **1-Click Backup**: Download your entire layout, categories, and apps as a portable `dashboard-backup.json`.
- **1-Click Restore**: Upload an existing backup JSON file to restore your configuration instantly.

---

## 📁 Project Structure

```
/home/lk2/container/
├── Dockerfile                  # Production container definition (Node 22 Alpine)
├── docker-compose.yml          # Ready-to-use Docker Compose configuration
├── package.json                # Express, Socket.IO, SystemInformation dependencies
├── server.js                   # Unified backend API & WebSocket telemetry engine
├── preset-apps.json            # 50+ preset homelab application definitions
├── defaults/
│   └── default-config.json     # Default starter homelab dashboard template
├── data/
│   └── config.json             # Persistent user configuration volume
├── public/
│   ├── index.html              # Frontend dashboard markup
│   ├── styles.css              # Glassmorphic responsive styling & themes
│   ├── app.js                  # Telemetry streams, charts & UI controller
│   └── icons.js                # Embedded offline SVG icon library
└── README.md                   # Documentation & deployment guide
```

---

## 🚀 Running on Your Mini PC Server

### Option A: Pull Pre-built Image with Docker Compose (Fastest & Recommended)

Since GitHub Actions builds and publishes multi-arch images (`linux/amd64` & `linux/arm64` for Raspberry Pi 5), you don't need to compile anything on your Pi:

1. Clone or copy your repository:
   ```bash
   git clone https://github.com/physicistlk/dashboard.git
   cd dashboard
   ```
2. Pull the pre-built image & launch:
   ```bash
   docker compose pull
   docker compose up -d
   ```
3. Open your browser and navigate to:
   ```
   http://<SERVER_OR_PI_IP>:3110
   ```

---

### Option B: Docker CLI (One-Line Run)

Run the pre-built image directly without cloning:

```bash
docker run -d \
  --name dashboard \
  --restart unless-stopped \
  -p 3110:3110 \
  -v $(pwd)/data:/app/data \
  -v /:/mnt/host:ro \
  -v /sys:/mnt/host/sys:ro \
  --device /dev/dri:/dev/dri \
  --privileged \
  ghcr.io/physicistlk/dashboard:latest
```

---

### Option C: Podman (Rootless or SELinux Enabled)

```bash
# 1. Build the image
podman build -t dashboard:latest .

# 2. Run the container (use :Z for SELinux permissions)
podman run -d \
  --name dashboard \
  --restart unless-stopped \
  -p 3110:3110 \
  -v $(pwd)/data:/app/data:Z \
  -v /:/mnt/host:ro \
  -v /sys:/mnt/host/sys:ro \
  --device /dev/dri:/dev/dri \
  --privileged \
  dashboard:latest
```

---

## ⚙️ Configuration & Volume Mounts

| Volume / Mount | Purpose |
| :--- | :--- |
| `./data:/app/data` | Persists your apps, categories, and settings across container updates. |
| `/:/mnt/host:ro` | Read-only host filesystem mount allowing Dash. telemetry to read true mini PC CPU, RAM, disk, and OS stats. |
| `/sys:/mnt/host/sys:ro` | Read-only host `/sys` filesystem mount for CPU thermal sensors and GPU metrics. |
| `/dev/dri:/dev/dri` | Pass-through for Intel & AMD GPU hardware acceleration and DRM metrics. |
| `--privileged` | Enables reading hardware thermal sensors and low-level Linux metrics. |

### Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3110` | Port the web server listens on inside the container. |
| `DATA_DIR` | `/app/data` | Directory where `config.json` is stored. |
| `NODE_ENV` | `production` | Node.js production environment mode. |
| `NPM_URL` | `http://nginx-proxy-manager:81` | Nginx Proxy Manager API endpoint URL on the `proxy` Docker network. |
| `NPM_EMAIL` | *(optional)* | Default NPM administrator email for auto-discovery. |
| `NPM_PASSWORD` | *(optional)* | Default NPM administrator password for auto-discovery. |

---

## 🌐 Nginx Proxy Manager (ngx) Auto-Discovery

The dashboard can directly discover and import your proxy hosts from your **Nginx Proxy Manager** (`nginx-proxy-manager`) container over the shared Docker network:

1. **Ensure the Docker Network is connected**:
   Make sure both the `nginx-proxy-manager` container and the `dashboard` container are attached to the `proxy` Docker network:
   ```yaml
   networks:
     - proxy

   networks:
     proxy:
       name: proxy
       external: true
   ```
2. **Importing Applications**:
   - Click the **"Sync Proxy"** button in the dashboard top navigation bar.
   - Enter your NPM URL (defaults to `http://nginx-proxy-manager:81`), Email, and Password.
   - Click **Fetch Hosts**: The dashboard queries `/api/nginx/proxy-hosts`, extracts all domain names and targets, automatically matches them against 50+ homelab icon and brand color presets, and flags existing duplicates.
   - Select the apps you want and click **Import Selected**.
   - Your newly imported services appear on the dashboard grid with live background health checks!

---

## 🛠️ Testing Locally Before Deploying

You can run the web server directly with Node.js on any machine:

```bash
cd ~/container
npm install
npm start
```
Then open `http://localhost:3110`.
