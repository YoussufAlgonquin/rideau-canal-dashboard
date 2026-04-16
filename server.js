const express = require("express");
const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();
 
const app = express();
const PORT = process.env.PORT || 3000;
 
// ── Cosmos DB setup ──────────────────────────────────────────────────────────
const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER);
 
const LOCATIONS = ["Dow's Lake", "Fifth Avenue", "NAC"];
 
// ── Helper: fetch latest doc for one location ────────────────────────────────
async function fetchLatestForLocation(location) {
  const { resources } = await container.items
    .query({
      query:
        "SELECT TOP 1 * FROM c WHERE c.location = @loc ORDER BY c.windowEnd DESC",
      parameters: [{ name: "@loc", value: location }],
    })
    .fetchAll();
  return resources[0] ?? null;
}
 
// ── Helper: fetch all latest docs (one per location) ────────────────────────
async function fetchAllLatest() {
  const results = await Promise.all(LOCATIONS.map(fetchLatestForLocation));
  return results;
}


// ── API endpoint: get latest data for all locations ─────────────────────────
app.get("/api/latest", async (req, res) => {
  try {
    const latestData = await fetchAllLatest();
    res.json(latestData);
  } catch (error) {
    console.error("Error fetching latest data:", error);
    res.status(500).json({ error: "Failed to fetch latest data" });
  }
});



// ── GET /api/history/:location ───────────────────────────────────────────────
app.get("/api/history/:location", async (req, res) => {
  try {
    const location = decodeURIComponent(req.params.location);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
 
    const { resources } = await container.items
      .query({
        query: `SELECT * FROM c
                WHERE c.location = @loc AND c.windowEnd >= @oneHourAgo
                ORDER BY c.windowEnd ASC`,
        parameters: [
          { name: "@loc", value: location },
          { name: "@oneHourAgo", value: oneHourAgo },
        ],
      })
      .fetchAll();
 
    res.json(resources);
  } catch (err) {
    console.error("/api/history error:", err);
    res.status(500).json({ error: "Failed to fetch history data" });
  }
});
 
// ── GET /api/status ──────────────────────────────────────────────────────────
app.get("/api/status", async (req, res) => {
  try {
    const latest = await fetchAllLatest();
 
    const locationStatuses = {};
    for (const doc of latest) {
      if (doc) locationStatuses[doc.location] = doc.safetyStatus;
    }
 
    const allSafe = Object.values(locationStatuses).every(
      (s) => s === "Safe"
    );
    const anyUnsafe = Object.values(locationStatuses).some(
      (s) => s === "Unsafe"
    );
 
    const overallStatus = allSafe ? "Safe" : anyUnsafe ? "Unsafe" : "Caution";
 
    res.json({
      overallStatus,
      locations: locationStatuses,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error("/api/status error:", err);
    res.status(500).json({ error: "Failed to fetch status" });
  }
});





// ── Static frontend ──────────────────────────────────────────────────────────
app.use(express.static("public"));
 
app.listen(PORT, () =>
  console.log(`Rideau Canal monitor running on http://localhost:${PORT}`)
);