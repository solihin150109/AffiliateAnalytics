/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory persistence for shortlinks and config
let shortlinks: any[] = [];
let globalUsdRate = 16300; // Default sensible conversion rate

// Try to load any previously saved shortlinks or configuration from working disk if present
const DATA_FILE = path.join(process.cwd(), "dashboard_data.json");
if (fs.existsSync(DATA_FILE)) {
  try {
    const rawData = fs.readFileSync(DATA_FILE, "utf-8");
    const data = JSON.parse(rawData);
    if (Array.isArray(data.shortlinks)) {
      shortlinks = data.shortlinks;
    }
    if (typeof data.globalUsdRate === "number") {
      globalUsdRate = data.globalUsdRate;
    }
  } catch (err) {
    console.error("Could not parse existing database file:", err);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ shortlinks, globalUsdRate }, null, 2), "utf-8");
  } catch (err) {
    console.log("Could not save persistent database:", err);
  }
}

// Simple Token-based session management
const SESSION_TOKEN = "session-auth-token-web-consolidator-123";

// Determine admin credentials with reliable fallback
const getAdminCredentials = () => {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "password123";
  return { username, password };
};

// Log warning to server console on boot for developer awareness
const creds = getAdminCredentials();
console.log(`[AUTH-INFO] Operational Credentials. User: "${creds.username}" | Pass: "${"*".repeat(creds.password.length)}"`);

// Auth middleware helper
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${SESSION_TOKEN}`) {
    res.status(401).json({ error: "Unauthorized session access." });
    return;
  }
  next();
};

// API Endpoint - Login
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const target = getAdminCredentials();

  if (username === target.username && password === target.password) {
    res.json({ success: true, token: SESSION_TOKEN });
  } else {
    res.status(401).json({ error: "Invalid username or password credentials." });
  }
});

// API Endpoint - Auth Status Check
app.get("/api/auth/status", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${SESSION_TOKEN}`) {
    res.json({ authenticated: true, username: getAdminCredentials().username });
  } else {
    res.json({ authenticated: false });
  }
});

// API Endpoint - Fetch Shortlinks
app.get("/api/shortlinks", requireAuth, (req, res) => {
  res.json(shortlinks);
});

// API Endpoint - Create Shortlink
app.post("/api/shortlinks", requireAuth, (req, res) => {
  const { originalUrl, zoneId, platform, market, shortlink } = req.body;

  if (!originalUrl || !shortlink) {
    res.status(400).json({ error: "Missing required shortlink elements." });
    return;
  }

  const payload = {
    id: `sl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    originalUrl,
    zoneId: zoneId || "Global",
    platform: platform || "Direct",
    market: market || "Universal",
    shortlink,
    createdAt: new Date().toISOString(),
  };

  shortlinks.unshift(payload);
  saveData();
  res.status(201).json(payload);
});

// API Endpoint - Get / Update global details
app.get("/api/config", (req, res) => {
  res.json({ usdToIdrRate: globalUsdRate });
});

app.post("/api/config", requireAuth, (req, res) => {
  const { usdToIdrRate } = req.body;
  if (typeof usdToIdrRate === "number" && usdToIdrRate > 0) {
    globalUsdRate = usdToIdrRate;
    saveData();
    res.json({ success: true, usdToIdrRate });
  } else {
    res.status(400).json({ error: "Invalid exchange rate parsed." });
  }
});

// Redirect endpoint for generated tracker link
app.get("/r", (req, res) => {
  const { url, sub1, sub2, market } = req.query;
  if (typeof url === "string" && url) {
    console.log(`[TRACKING-REDIRECT] Zone ID: ${sub1} | Platform: ${sub2} | Market: ${market} -> ${url}`);
    res.redirect(url);
  } else {
    res.status(400).send("<h3>Invalid Redirect: URL destination parameter is missing from tracking request.</h3>");
  }
});

// Initialize Vite and setup endpoints
async function initializeApp() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // Mount Vite middleware after API routes
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

initializeApp().catch((err) => {
  console.error("Critical: Initialization of App Failed", err);
});
