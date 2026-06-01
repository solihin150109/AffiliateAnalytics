/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import UploadData from "./components/UploadData";
import ShortlinkGenerator from "./components/ShortlinkGenerator";
import Login from "./components/Login";
import { Menu, Sparkles } from "lucide-react";
import { StatsRow } from "./types";

export default function App() {
  const [activeTab, setActiveTab ] = useState<"dashboard" | "upload" | "shortlink">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  
  // Theme state - Light by default
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem("buyer_dashboard_dark_mode");
    return savedTheme === "true";
  });

  // USD to IDR rate conversion state
  const [usdRate, setUsdRate] = useState<number>(16300);

  // Data states (Lifting up to enable seamless sharing between Upload & Dashboard)
  const [statsRows, setStatsRows] = useState<StatsRow[]>([]);
  const [statsPlatform, setStatsPlatform] = useState<string>("PropellerAds");
  const [statsFileName, setStatsFileName] = useState<string>("");

  const [clicksMap, setClicksMap] = useState<Record<string, number>>({});
  const [clicksFileName, setClicksFileName] = useState<string>("");

  const [phConversionMap, setPhConversionMap] = useState<Record<string, { earningsUsd: number; orders: number }>>({});
  const [phFileName, setPhFileName] = useState<string>("");

  const [idCommissionMap, setIdCommissionMap] = useState<Record<string, { commissionIdr: number; orders: number }>>({});
  const [idFileName, setIdFileName] = useState<string>("");

  const [zonePlatforms, setZonePlatforms] = useState<Record<string, string>>({});
  const [zoneMarkets, setZoneMarkets] = useState<Record<string, Set<string>>>({});

  // Notification Toast state
  const [notif, setNotif] = useState<{ text: string; type: "success" | "info" } | null>(null);

  const triggerNotif = (text: string, type: "success" | "info" = "success") => {
    setNotif({ text, type });
    setTimeout(() => setNotif(null), 4000);
  };

  // Authenticate session check on boot
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem("buyer_dashboard_auth_token");
      if (!token) {
        setCheckingAuth(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/status", {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok && data.authenticated) {
          setAuthToken(token);
          setUsername(data.username || "admin");
        } else {
          // Token is invalid/expired
          localStorage.removeItem("buyer_dashboard_auth_token");
        }
      } catch (err) {
        console.error("Boot connection handshake failed:", err);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Sync exchange rate on boot from backend database
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/config");
        if (response.ok) {
          const data = await response.json();
          if (data.usdToIdrRate) {
            setUsdRate(data.usdToIdrRate);
          }
        }
      } catch (err) {
        console.warn("Could not query config from database:", err);
      }
    };
    fetchConfig();
  }, []);

  // Apply dark class to document documentElement
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("buyer_dashboard_dark_mode", String(darkMode));
  }, [darkMode]);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem("buyer_dashboard_auth_token", token);
    setAuthToken(token);
    setUsername("admin");
  };

  const handleLogout = () => {
    localStorage.removeItem("buyer_dashboard_auth_token");
    setAuthToken(null);
    setUsername("");
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const loadMockSampleData = () => {
    // Stats Mock
    const mockStats: StatsRow[] = [
      { zoneId: "2092100", impressions: 154000, clicks: 1210, cost: 308.50 },
      { zoneId: "2092101", impressions: 85200, clicks: 954, cost: 170.40 },
      { zoneId: "2092102", impressions: 211000, clicks: 1842, cost: 450.00 },
      { zoneId: "2092103", impressions: 45000, clicks: 350, cost: 95.20 },
      { zoneId: "2092104", impressions: 120500, clicks: 1120, cost: 241.00 },
      { zoneId: "2092105", impressions: 98000, clicks: 880, cost: 205.80 },
    ];

    // Clicks Mock
    const mockClicks: Record<string, number> = {
      "2092100": 1210,
      "2092101": 954,
      "2092102": 1842,
      "2092103": 350,
      "2092104": 1120,
      "2092105": 880,
    };

    // PH (USD Estimated Earnings)
    const mockPh: Record<string, { earningsUsd: number; orders: number }> = {
      "2092100": { earningsUsd: 185.00, orders: 12 },
      "2092102": { earningsUsd: 290.50, orders: 22 },
      "2092103": { earningsUsd: 42.00, orders: 3 },
      "2092105": { earningsUsd: 110.00, orders: 9 },
    };

    // Shopee ID (Rp Direct)
    const mockId: Record<string, { commissionIdr: number; orders: number }> = {
      "2092100": { commissionIdr: 2850000, orders: 18 },
      "2092101": { commissionIdr: 3420000, orders: 21 },
      "2092102": { commissionIdr: 4950000, orders: 32 },
      "2092150": { commissionIdr: 580000, orders: 4 }, // No exact stats mapping to test unmatched rows
    };

    // Assign Platforms
    const platforms: Record<string, string> = {
      "2092100": "PropellerAds",
      "2092101": "Clickadu",
      "2092102": "PropellerAds",
      "2092103": "GalaksionAds",
      "2092104": "Clickadu",
      "2092105": "GalaksionAds",
      "2092150": "PropellerAds",
    };

    // Markets assigned
    const markets: Record<string, Set<string>> = {
      "2092100": new Set(["id", "ph"]),
      "2092101": new Set(["id"]),
      "2092102": new Set(["id", "ph"]),
      "2092103": new Set(["ph"]),
      "2092104": new Set([]),
      "2092105": new Set(["ph"]),
      "2092150": new Set(["id"]),
    };

    setStatsRows(mockStats);
    setClicksMap(mockClicks);
    setPhConversionMap(mockPh);
    setIdCommissionMap(mockId);
    setZonePlatforms(platforms);
    setZoneMarkets(markets);

    setStatsFileName("demo_stats.csv");
    setClicksFileName("demo_website_clicks.csv");
    setPhFileName("demo_shopee_ph.csv");
    setIdFileName("demo_shopee_id.csv");

    triggerNotif("Berhasil memproses & memasukkan data simulasi CSV!");
  };

  if (checkingAuth) {
    return (
      <div id="loader-wrapper" className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
        <div className="text-center space-y-4">
          <div className="inline-block relative h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold tracking-wide font-mono">Securing admin parameters...</p>
        </div>
      </div>
    );
  }

  // Not authenticated? Prompt Login screen
  if (!authToken) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
        <main className="py-12">
          <Login onLoginSuccess={handleLoginSuccess} />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
      
      {/* Toast notifications */}
      {notif && (
        <div
          id="global-toast-notification"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 p-4 rounded-xl shadow-2xl border text-sm transition-all bg-slate-900 border-blue-500/30 text-white font-medium"
        >
          <Sparkles className="h-4 w-4 text-blue-400" />
          <span>{notif.text}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        username={username}
        onLogout={handleLogout}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main Core Area Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Sticky Mobile/Desktop Top Header bar */}
        <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 flex items-center justify-between transition-colors duration-300">
          
          {/* Mobile hamburger menu & Page Title indicator */}
          <div className="flex items-center gap-3">
            <button
              id="mobile-sidebar-hamburger"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Open Navigation Menu"
            >
              <Menu className="h-5.5 w-5.5" />
            </button>
            
            {/* Breadcrumbs or header label info */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Affiliate Suite</span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white tracking-wide uppercase">
                {activeTab === "dashboard" ? "Dashboard & Hasil" : activeTab === "upload" ? "Upload Data" : "Shortlink Parameters"}
              </span>
            </div>
          </div>

          {/* Quick status actions */}
          <div className="flex items-center gap-2 font-mono">
            <div className="hidden sm:inline-block bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-905/30 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">
              ONLINE
            </div>
            
            {/* Live conversion rate helper widget */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400">
              USD/IDR: Rp {usdRate.toLocaleString("id-ID")}
            </div>
          </div>

        </header>

        {/* Dynamic scrollable viewport content page flow */}
        <div id="app-viewport-scroll" className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300 p-4 sm:p-6 lg:p-8 space-y-8">
          
          <main className="w-full">
            {activeTab === "dashboard" ? (
              <Dashboard
                usdRate={usdRate}
                setUsdRate={setUsdRate}
                authToken={authToken}
                darkMode={darkMode}
                statsRows={statsRows}
                statsPlatform={statsPlatform}
                statsFileName={statsFileName}
                clicksMap={clicksMap}
                clicksFileName={clicksFileName}
                phConversionMap={phConversionMap}
                phFileName={phFileName}
                idCommissionMap={idCommissionMap}
                idFileName={idFileName}
                zonePlatforms={zonePlatforms}
                zoneMarkets={zoneMarkets}
                setActiveTab={setActiveTab}
              />
            ) : activeTab === "upload" ? (
              <UploadData
                usdRate={usdRate}
                setUsdRate={setUsdRate}
                statsRows={statsRows}
                setStatsRows={setStatsRows}
                statsFileName={statsFileName}
                setStatsFileName={setStatsFileName}
                statsPlatform={statsPlatform}
                setStatsPlatform={setStatsPlatform}
                clicksMap={clicksMap}
                setClicksMap={setClicksMap}
                clicksFileName={clicksFileName}
                setClicksFileName={setClicksFileName}
                phConversionMap={phConversionMap}
                setPhConversionMap={setPhConversionMap}
                phFileName={phFileName}
                setPhFileName={setPhFileName}
                idCommissionMap={idCommissionMap}
                setIdCommissionMap={setIdCommissionMap}
                idFileName={idFileName}
                setIdFileName={setIdFileName}
                zonePlatforms={zonePlatforms}
                setZonePlatforms={setZonePlatforms}
                zoneMarkets={zoneMarkets}
                setZoneMarkets={setZoneMarkets}
                loadMockSampleData={loadMockSampleData}
                triggerNotif={triggerNotif}
                authToken={authToken}
              />
            ) : (
              <ShortlinkGenerator authToken={authToken} />
            )}
          </main>

          {/* Corporate Page footer */}
          <footer className="w-full text-center pt-8 border-t border-slate-200 dark:border-slate-850/60 pb-6 text-xs text-slate-400 dark:text-slate-500 transition-colors">
            <p>© 2026 Media Buying & Affiliate Consolidation Management Suite. All rights resolved.</p>
            <p className="mt-1 text-[10px] font-mono text-slate-400/50">Single-User Secure Architecture (Secure Cookie Auth Mode)</p>
          </footer>

        </div>

      </div>

    </div>
  );
}
