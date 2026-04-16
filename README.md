# rideau-canal-dashboard

Node.js/Express web dashboard for the Rideau Canal Skateway real-time monitoring system. Reads aggregated sensor data from Azure Cosmos DB and displays live safety status, current readings, and historical charts for three canal locations.

---

## Overview

### Dashboard features

- Three location cards (Dow's Lake, Fifth Avenue, NAC) showing the latest 5-minute aggregation window
- Safety status badge per location: **Safe** / **Caution** / **Unsafe**
- Overall system status banner derived from all three locations
- Historical trend charts (ice thickness and surface temperature — last hour) powered by Chart.js
- Auto-refresh every 30 seconds with a countdown timer

### Technologies used

- **Runtime:** Node.js 20
- **Framework:** Express 5
- **Database SDK:** `@azure/cosmos` v4
- **Frontend:** Vanilla HTML/CSS/JavaScript, Chart.js
- **Hosting:** Azure App Service (Linux, Node 20 LTS)

---

## Prerequisites

- Node.js 20+
- An Azure Cosmos DB account with:
  - Database: `RideauCanalDB`
  - Container: `SensorAggregations` (partition key `/location`)
  - Data already being written by the Stream Analytics job

---

## Installation

```bash
git clone https://github.com/YoussufAlgonquin/rideau-canal-dashboard
cd rideau-canal-dashboard
npm install
```

---

## Configuration

Copy `.env.example` to `.env` and fill in your Cosmos DB credentials:

```bash
cp .env.example .env
```

`.env` format:

```env
PORT=3000
COSMOS_CONNECTION_STRING=AccountEndpoint=https://<account>.documents.azure.com:443/;AccountKey=<key>;
COSMOS_DATABASE=RideauCanalDB
COSMOS_CONTAINER=SensorAggregations
```

Find `COSMOS_CONNECTION_STRING` in Azure Portal → Cosmos DB account → Keys → Primary Connection String.

---

## API Endpoints

### `GET /api/latest`

Returns the most recent aggregation document for each of the three locations.

**Response:** array of up to 3 documents (one per location), or `null` entries for locations with no data yet.

```json
[
  {
    "id": "Dow's Lake-2026-04-15T23:50:00.000000Z",
    "location": "Dow's Lake",
    "windowEnd": "2026-04-15T23:50:00.000000Z",
    "avgIceThickness": 28.87,
    "minIceThickness": 24.6,
    "maxIceThickness": 34.4,
    "avgSurfaceTemperature": -2.71,
    "minSurfaceTemperature": -7.0,
    "maxSurfaceTemperature": 0.2,
    "maxSnowAccumulation": 13.8,
    "avgExternalTemperature": -7.38,
    "readingCount": 10,
    "safetyStatus": "Caution"
  },
  { "location": "Fifth Avenue", "..." : "..." },
  { "location": "NAC", "..." : "..." }
]
```

---

### `GET /api/history/:location`

Returns all aggregation documents for the given location from the past hour, ordered by `windowEnd` ascending.

**URL parameter:** `location` — URL-encoded location name, e.g. `Dow%27s%20Lake`, `Fifth%20Avenue`, `NAC`

**Response:** array of documents (same schema as above), oldest first.

```bash
GET /api/history/NAC
GET /api/history/Dow%27s%20Lake
```

---

### `GET /api/status`

Returns the overall system safety status and per-location statuses.

**Response:**

```json
{
  "overallStatus": "Unsafe",
  "locations": {
    "Dow's Lake": "Caution",
    "Fifth Avenue": "Caution",
    "NAC": "Unsafe"
  },
  "lastUpdated": "2026-04-15T23:58:23.000Z"
}
```

Overall logic: `Safe` if all locations are Safe; `Unsafe` if any location is Unsafe; otherwise `Caution`.

---

## Deployment to Azure App Service

### 1. Create the App Service

In Azure Portal, create a new Web App:

- **Runtime stack:** Node 20 LTS
- **OS:** Linux
- **Plan:** Free F1 (sufficient for this project)

### 2. Set environment variables

In the App Service → **Configuration** → **Application settings**, add:

| Name | Value |
|---|---|
| `COSMOS_CONNECTION_STRING` | Primary connection string from Cosmos DB Keys |
| `COSMOS_DATABASE` | `RideauCanalDB` |
| `COSMOS_CONTAINER` | `SensorAggregations` |

`PORT` is set automatically by App Service — do not override it.

### 3. Deploy via github integration

Go to the app service, deployment center, integrate the github repo and click deploy.


### 4. Verify

Browse to the app service URL. The dashboard should load and auto-refresh within 30 seconds once the sensor simulator and Stream Analytics job are running.

---

## Dashboard Features

### Real-time updates

The frontend calls `GET /api/latest` and `GET /api/status` on page load and every 30 seconds. A countdown timer in the bottom-right corner shows seconds until the next refresh.

### Charts and visualizations

Each location card links to a Chart.js dual-axis line chart that plots average ice thickness (cm, left axis) and average surface temperature (°C, right axis) for all windows in the past hour fetched from `GET /api/history/:location`.

### Safety status indicators

- Card border colour: green (Safe), yellow (Caution), red (Unsafe)
- Badge label in the card header matches the `safetyStatus` field from Cosmos DB
- Top-right banner shows the overall status from `GET /api/status`

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| All cards show no data | Cosmos DB empty or Stream Analytics not running | Start the sensor simulator and confirm the Stream Analytics job is in **Running** state |
| `401 Unauthorized` from Cosmos DB | Wrong connection string | Re-copy the Primary Connection String from Azure Portal → Cosmos DB → Keys |
| App Service returns 500 | Missing application setting | Check all three env vars are set in App Service → Configuration |
| Charts show only one data point | Stream Analytics job started recently | Wait at least 10 minutes for multiple 5-minute windows to accumulate |
| Dashboard not auto-refreshing | JavaScript error in browser console | Open DevTools → Console and check for network or CORS errors |
