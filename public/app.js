// ── Config ───────────────────────────────────────────────────────────────────
const LOCATIONS = ["Dow's Lake", "Fifth Avenue", "NAC"];
const REFRESH_INTERVAL = 30; // seconds

const CHART_IDS = {
  "Dow's Lake":   "chart-dows-lake",
  "Fifth Avenue": "chart-fifth-avenue",
  "NAC":          "chart-nac",
};

// Chart.js instances keyed by location
const charts = {};

// ── Helpers ──────────────────────────────────────────────────────────────────
function statusClass(status = "") {
  return status.toLowerCase(); // "safe" | "caution" | "unsafe"
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", { hour12: false });
}

// ── Render: Status Banner ─────────────────────────────────────────────────────
function renderStatus(statusData) {
  const banner = document.getElementById("status-banner");
  const label  = document.getElementById("status-label");
  const cls    = statusClass(statusData.overallStatus);

  banner.className = `status-banner status-${cls}`;
  label.textContent = `Overall: ${statusData.overallStatus}`;
}

// ── Render: Location Cards ────────────────────────────────────────────────────
function renderCards(latestDocs) {
  const grid = document.getElementById("cards-grid");
  grid.innerHTML = "";

  for (const doc of latestDocs) {
    if (!doc) continue;
    const cls = statusClass(doc.safetyStatus);

    const card = document.createElement("div");
    card.className = `location-card ${cls}`;
    card.dataset.location = doc.location;

    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-location">${doc.location}</div>
          <div class="card-window">${formatTimestamp(doc.windowEnd)} window</div>
        </div>
        <span class="safety-badge badge-${cls}">${doc.safetyStatus}</span>
      </div>
      <div class="card-metrics">
        <div class="metric">
          <span class="metric-label">Ice Thickness</span>
          <span class="metric-value highlight-ice">${doc.avgIceThickness?.toFixed(1) ?? "—"} cm</span>
        </div>
        <div class="metric">
          <span class="metric-label">Surface Temp</span>
          <span class="metric-value highlight-temp">${doc.avgSurfaceTemperature?.toFixed(1) ?? "—"} °C</span>
        </div>
        <div class="metric">
          <span class="metric-label">Snow Accum.</span>
          <span class="metric-value">${doc.maxSnowAccumulation?.toFixed(1) ?? "—"} cm</span>
        </div>
        <div class="metric">
          <span class="metric-label">External Temp</span>
          <span class="metric-value">${doc.avgExternalTemperature?.toFixed(1) ?? "—"} °C</span>
        </div>
      </div>
      <div class="card-footer">${doc.readingCount ?? 0} readings · window ended ${formatDate(doc.windowEnd)}</div>
    `;

    grid.appendChild(card);
  }
}

// ── Render: Charts ────────────────────────────────────────────────────────────
function buildChart(canvasId) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Ice Thickness (cm)",
          data: [],
          borderColor: "#4fc3f7",
          backgroundColor: "rgba(79,195,247,0.08)",
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          yAxisID: "yIce",
        },
        {
          label: "Surface Temp (°C)",
          data: [],
          borderColor: "#ff8a65",
          backgroundColor: "rgba(255,138,101,0.08)",
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          yAxisID: "yTemp",
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: "#5a7a9a", font: { family: "Share Tech Mono", size: 11 } },
        },
      },
      scales: {
        x: {
          ticks: { color: "#5a7a9a", font: { family: "Share Tech Mono", size: 10 }, maxTicksLimit: 6 },
          grid:  { color: "#1e3050" },
        },
        yIce: {
          position: "left",
          ticks: { color: "#4fc3f7", font: { family: "Share Tech Mono", size: 10 } },
          grid:  { color: "#1e3050" },
          title: { display: true, text: "cm", color: "#4fc3f7", font: { size: 10 } },
        },
        yTemp: {
          position: "right",
          ticks: { color: "#ff8a65", font: { family: "Share Tech Mono", size: 10 } },
          grid:  { drawOnChartArea: false },
          title: { display: true, text: "°C", color: "#ff8a65", font: { size: 10 } },
        },
      },
    },
  });
}

function updateChart(chart, historyDocs) {
  const labels   = historyDocs.map(d => formatTimestamp(d.windowEnd));
  const iceData  = historyDocs.map(d => d.avgIceThickness);
  const tempData = historyDocs.map(d => d.avgSurfaceTemperature);

  chart.data.labels              = labels;
  chart.data.datasets[0].data   = iceData;
  chart.data.datasets[1].data   = tempData;
  chart.update("active");
}

// ── Data Fetching ─────────────────────────────────────────────────────────────
async function fetchLatest() {
  const res = await fetch("/api/latest");
  if (!res.ok) throw new Error("Failed to fetch /api/latest");
  return res.json();
}

async function fetchStatus() {
  const res = await fetch("/api/status");
  if (!res.ok) throw new Error("Failed to fetch /api/status");
  return res.json();
}

async function fetchHistory(location) {
  const res = await fetch(`/api/history/${encodeURIComponent(location)}`);
  if (!res.ok) throw new Error(`Failed to fetch history for ${location}`);
  return res.json();
}

// ── Full Refresh ──────────────────────────────────────────────────────────────
async function refresh() {
  try {
    const [latest, status] = await Promise.all([fetchLatest(), fetchStatus()]);
    renderStatus(status);
    renderCards(latest);

    await Promise.all(
      LOCATIONS.map(async (loc) => {
        const history = await fetchHistory(loc);
        if (!charts[loc]) {
          charts[loc] = buildChart(CHART_IDS[loc]);
        }
        updateChart(charts[loc], history);
      })
    );

    document.getElementById("last-refresh").textContent = new Date().toLocaleTimeString("en-CA", { hour12: false });
  } catch (err) {
    console.error("Refresh error:", err);
  }
}

// ── Countdown Timer ───────────────────────────────────────────────────────────
let secondsLeft = REFRESH_INTERVAL;

function tickCountdown() {
  document.getElementById("countdown").textContent = secondsLeft;
  if (secondsLeft === 0) {
    secondsLeft = REFRESH_INTERVAL;
    refresh();
  } else {
    secondsLeft--;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
refresh();
setInterval(tickCountdown, 1000);