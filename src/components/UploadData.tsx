/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import {
  Upload,
  CheckCircle,
  FileText,
  Trash2,
  Sparkles,
  Coins,
  Layers,
  Database,
  ArrowRight,
  Info,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { parseCSV, extractZoneId, parseNumber } from "../utils/csv";
import { StatsRow } from "../types";

interface UploadDataProps {
  usdRate: number;
  setUsdRate: (rate: number) => void;
  statsRows: StatsRow[];
  setStatsRows: (rows: StatsRow[]) => void;
  statsFileName: string;
  setStatsFileName: (name: string) => void;
  statsPlatform: string;
  setStatsPlatform: (platform: string) => void;
  clicksMap: Record<string, number>;
  setClicksMap: (map: Record<string, number>) => void;
  clicksFileName: string;
  setClicksFileName: (name: string) => void;
  phConversionMap: Record<string, { earningsUsd: number; orders: number }>;
  setPhConversionMap: (map: Record<string, { earningsUsd: number; orders: number }>) => void;
  phFileName: string;
  setPhFileName: (name: string) => void;
  idCommissionMap: Record<string, { commissionIdr: number; orders: number }>;
  setIdCommissionMap: (map: Record<string, { commissionIdr: number; orders: number }>) => void;
  idFileName: string;
  setIdFileName: (name: string) => void;
  zonePlatforms: Record<string, string>;
  setZonePlatforms: (platforms: Record<string, string>) => void;
  zoneMarkets: Record<string, Set<string>>;
  setZoneMarkets: (markets: Record<string, Set<string>>) => void;
  loadMockSampleData: () => void;
  triggerNotif: (text: string, type?: "success" | "info") => void;
  authToken: string | null;
}

export default function UploadData({
  usdRate,
  setUsdRate,
  statsRows,
  setStatsRows,
  statsFileName,
  setStatsFileName,
  statsPlatform,
  setStatsPlatform,
  clicksMap,
  setClicksMap,
  clicksFileName,
  setClicksFileName,
  phConversionMap,
  setPhConversionMap,
  phFileName,
  setPhFileName,
  idCommissionMap,
  setIdCommissionMap,
  idFileName,
  setIdFileName,
  zonePlatforms,
  setZonePlatforms,
  zoneMarkets,
  setZoneMarkets,
  loadMockSampleData,
  triggerNotif,
  authToken,
}: UploadDataProps) {

  // Form metadata inputs during upload
  const [uploadPlatform, setUploadPlatform] = useState<string>("PropellerAds");
  
  // File refs
  const fileInputStats = useRef<HTMLInputElement>(null);
  const fileInputClicks = useRef<HTMLInputElement>(null);
  const fileInputPh = useRef<HTMLInputElement>(null);
  const fileInputId = useRef<HTMLInputElement>(null);

  // Sync back exchange rate changes to backend persistence
  const saveExchangeRate = async (rate: number) => {
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({ usdToIdrRate: rate })
      });
      if (response.ok) {
        console.log("Exchange rate synced online dynamically.");
      }
    } catch (err) {
      console.warn("Could not sync exchange rate to cloud DB:", err);
    }
  };

  // 1. Stats File handler
  const handleStatsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      
      let zoneCol = "";
      let impCol = "";
      let clickCol = "";
      let costCol = "";

      parsed.headers.forEach((h) => {
        const lower = h.toLowerCase().replace(/[\s_-]/g, "");
        if (lower.includes("zoneid") || lower === "zone" || lower === "tagid" || lower === "id") {
          zoneCol = h;
        } else if (lower.includes("impression")) {
          impCol = h;
        } else if (lower.includes("click")) {
          clickCol = h;
        } else if (lower.includes("cost") || lower.includes("spend")) {
          costCol = h;
        }
      });

      if (!zoneCol) zoneCol = parsed.headers[0] || "";
      if (!impCol) impCol = parsed.headers.find(h => h.toLowerCase().includes("imp")) || "";
      if (!clickCol) clickCol = parsed.headers.find(h => h.toLowerCase().includes("clk") || h.toLowerCase().includes("click")) || "";
      if (!costCol) costCol = parsed.headers.find(h => h.toLowerCase().includes("cst") || h.toLowerCase().includes("cost")) || "";

      if (!parsed.rows.length || !zoneCol) {
        triggerNotif("Error: CSV structure mismatched. No Zone ID detected.", "info");
        return;
      }

      const mappedRows: StatsRow[] = parsed.rows.map((row) => {
        const rawZone = row[zoneCol] || "";
        const id = extractZoneId(rawZone);
        return {
          zoneId: id,
          impressions: parseNumber(row[impCol]),
          clicks: parseNumber(row[clickCol]),
          cost: parseNumber(row[costCol]),
        };
      }).filter(r => r.zoneId);

      const nextZonePlatforms = { ...zonePlatforms };
      mappedRows.forEach(row => {
        nextZonePlatforms[row.zoneId] = uploadPlatform;
      });

      setStatsRows(mappedRows);
      setZonePlatforms(nextZonePlatforms);
      setStatsFileName(file.name);
      setStatsPlatform(uploadPlatform);
      triggerNotif(`Berhasil: Memuat ${mappedRows.length} statistik Zone untuk platform ${uploadPlatform}.`);
    };
    reader.readAsText(file);
  };

  // 2. Website Clicks report handler
  const handleWebsiteClicksUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);

      let tagCol = parsed.headers.find(h => h.toLowerCase().replace(/[\s_-]/g, "").includes("taglink")) || "";
      let clickNumCol = parsed.headers.find(h => h.toLowerCase().replace(/[\s_-]/g, "").includes("click") || h.toLowerCase().includes("count")) || "";

      if (!tagCol) tagCol = parsed.headers[0] || "";

      const updatedClicksMap: Record<string, number> = {};

      parsed.rows.forEach((row) => {
        const rawTag = row[tagCol] || "";
        const zoneId = extractZoneId(rawTag);
        if (!zoneId) return;

        const clicks = clickNumCol ? parseNumber(row[clickNumCol]) : 1;
        updatedClicksMap[zoneId] = (updatedClicksMap[zoneId] || 0) + clicks;
      });

      setClicksMap(updatedClicksMap);
      setClicksFileName(file.name);
      triggerNotif(`Berhasil: Membaca data klik dari ${file.name}. Menghubungkan ${Object.keys(updatedClicksMap).length} Zone.`);
    };
    reader.readAsText(file);
  };

  // 3. Publisher Conversion Report Handler (Shopee PH)
  const handlePhConversionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);

      let subIdCol = parsed.headers.find(h => {
        const norm = h.toLowerCase().replace(/[\s_-]/g, "");
        return norm.includes("pubsub") || norm.includes("publishersubid1") || norm.includes("subid1") || norm.includes("sub1");
      }) || "";

      let earningsCol = parsed.headers.find(h => {
        const norm = h.toLowerCase().replace(/[\s_-]/g, "");
        return norm.includes("estimatedearnings") || norm.includes("earnings") || norm.includes("earn");
      }) || "";

      if (!subIdCol) subIdCol = parsed.headers[0] || "";
      if (!earningsCol) earningsCol = parsed.headers.find(h => h.toLowerCase().includes("usd") || h.toLowerCase().includes("val")) || "";

      const updatedPhMap: Record<string, { earningsUsd: number; orders: number }> = {};
      const nextZoneMarkets = { ...zoneMarkets };

      parsed.rows.forEach((row) => {
        const rawId = row[subIdCol] || "";
        const zoneId = extractZoneId(rawId);
        if (!zoneId) return;

        const usdEarning = parseNumber(row[earningsCol]);

        if (!updatedPhMap[zoneId]) {
          updatedPhMap[zoneId] = { earningsUsd: 0, orders: 0 };
        }
        updatedPhMap[zoneId].earningsUsd += usdEarning;
        updatedPhMap[zoneId].orders += 1;

        if (!nextZoneMarkets[zoneId]) nextZoneMarkets[zoneId] = new Set();
        nextZoneMarkets[zoneId].add("ph");
      });

      setPhConversionMap(updatedPhMap);
      setZoneMarkets(nextZoneMarkets);
      setPhFileName(file.name);
      triggerNotif(`Berhasil: Memuat Komisi PH. Ditemukan ${Object.keys(updatedPhMap).length} kecocokan Zone.`);
    };
    reader.readAsText(file);
  };

  // 4. Affiliate Commission Report Handler (Shopee ID Direct)
  const handleIdCommissionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);

      let tagCol = parsed.headers.find(h => {
        const norm = h.toLowerCase().replace(/[\s_-]/g, "");
        return norm.includes("taglink1") || norm.includes("tag1") || norm.includes("taglink");
      }) || "";

      let commCol = parsed.headers.find(h => {
        const norm = h.toLowerCase().replace(/[\s_-]/g, "");
        return norm.includes("totalkomisi") || norm.includes("komisi") || norm.includes("commission") || norm.includes("rp");
      }) || "";

      if (!tagCol) tagCol = parsed.headers[0] || "";
      if (!commCol) commCol = parsed.headers.find(h => h.toLowerCase().includes("rp") || h.toLowerCase().includes("total")) || "";

      const updatedIdMap: Record<string, { commissionIdr: number; orders: number }> = {};
      const nextZoneMarkets = { ...zoneMarkets };

      parsed.rows.forEach((row) => {
        const rawId = row[tagCol] || "";
        const zoneId = extractZoneId(rawId);
        if (!zoneId) return;

        const commRp = parseNumber(row[commCol]);

        if (!updatedIdMap[zoneId]) {
          updatedIdMap[zoneId] = { commissionIdr: 0, orders: 0 };
        }
        updatedIdMap[zoneId].commissionIdr += commRp;
        updatedIdMap[zoneId].orders += 1;

        if (!nextZoneMarkets[zoneId]) nextZoneMarkets[zoneId] = new Set();
        nextZoneMarkets[zoneId].add("id");
      });

      setIdCommissionMap(updatedIdMap);
      setZoneMarkets(nextZoneMarkets);
      setIdFileName(file.name);
      triggerNotif(`Berhasil: Konfigurasi Shopee ID tersimpan. Terdaftar ${Object.keys(updatedIdMap).length} Zone.`);
    };
    reader.readAsText(file);
  };

  const handleClearSlot = (slotNum: number) => {
    if (slotNum === 1) {
      setStatsRows([]);
      setStatsFileName("");
    } else if (slotNum === 2) {
      setClicksMap({});
      setClicksFileName("");
    } else if (slotNum === 3) {
      setPhConversionMap({});
      setPhFileName("");
    } else if (slotNum === 4) {
      setIdCommissionMap({});
      setIdFileName("");
    }
    triggerNotif("Slot laporan berhasil dikosongkan.", "info");
  };

  const clearAllData = () => {
    setStatsRows([]);
    setStatsFileName("");
    setClicksMap({});
    setClicksFileName("");
    setPhConversionMap({});
    setPhFileName("");
    setIdCommissionMap({});
    setIdFileName("");
    setZonePlatforms({});
    setZoneMarkets({});
    triggerNotif("Semua data berhasil dibersihkan.", "info");
  };

  const isAnyFileLoaded = statsFileName || clicksFileName || phFileName || idFileName;

  return (
    <div className="space-y-8 animate-fadeIn" id="upload-data-container">
      
      {/* Page Title & Instructions banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Workspace Unggah Laporan
            </span>
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Secure Module
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1 tracking-tight">
            Import CSV & Konfigurasi Kurs
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Unggah file laporan komisi dan statistik Anda dari PropellerAds, Shopee ID, atau Involve Asia untuk diproses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Demo Hydrate Fast Trigger */}
          <button
            id="demo-hydrate-page"
            onClick={loadMockSampleData}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-950/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900 rounded-lg hover:brightness-95 hover:shadow-sm cursor-pointer transition-all"
            title="Inject simulated CSV dataset coordinates"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
            <span>Gunakan Data Contoh (Mock)</span>
          </button>

          {isAnyFileLoaded && (
            <button
              onClick={clearAllData}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-lg cursor-pointer transition-all"
              title="Clear all uploaded data"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Bersihkan Semua</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Config bar with Instant rates */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start">
            <Coins className="h-5 w-5 text-blue-400" />
            <h2 className="font-semibold text-base">Sinkronisasi Kurs Operasi</h2>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            Atur target nilai konversi <strong>USD ke IDR (Rupiah)</strong> saat ini untuk menyesuaikan perbandingan profit pembelian taktis media ads secara presisi.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/50 p-2 rounded-xl border border-slate-800 shrink-0 w-full md:w-auto justify-between">
          <div className="text-xs font-semibold text-slate-400 px-3 uppercase">Kurs Rp / $ :</div>
          <input
            id="usd-rate-input-upload"
            type="number"
            min="1"
            value={usdRate}
            onChange={(e) => {
              const val = parseNumber(e.target.value);
              setUsdRate(val);
              saveExchangeRate(val);
            }}
            className="w-28 bg-slate-900 border-none text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2.5 py-1 text-center font-bold font-mono"
            placeholder="16300"
          />
        </div>
      </div>

      {/* Active Import Summary / Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "1. STATS REPORT", file: statsFileName, count: statsRows.length, desc: "Zones Stat", color: "text-blue-500 bg-blue-500/10" },
          { label: "2. CLICKS MAP", file: clicksFileName, count: Object.keys(clicksMap).length, desc: "Shortlinks Click", color: "text-emerald-500 bg-emerald-500/10" },
          { label: "3. SHOPEE PH", file: phFileName, count: Object.keys(phConversionMap).length, desc: "PH Convs", color: "text-amber-500 bg-amber-500/10" },
          { label: "4. SHOPEE ID DIRECT", file: idFileName, count: Object.keys(idCommissionMap).length, desc: "ID Convs", color: "text-pink-500 bg-pink-500/10" },
        ].map((block, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between shadow-xs">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{block.label}</div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-slate-800 dark:text-white font-mono">{block.count}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{block.desc}</span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span className="truncate max-w-[70%] font-mono text-slate-400" title={block.file || "Belum ada file"}>
                {block.file ? block.file : "Belum diunggah"}
              </span>
              {block.file ? (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Grid of File Upload Slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Slot 1: Stats Report */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 rounded-md">
                Slot 1
              </span>
              {statsRows.length > 0 && <CheckCircle className="h-4 w-4 text-emerald-500" />}
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-3 uppercase">1. STATS REPORT</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Laporan Utama biaya penayangan iklan per Zone/Tag: <span className="font-mono text-blue-500 dark:text-blue-400 bg-slate-50 dark:bg-slate-950/40 px-1 py-0.5 rounded">Zone ID, Cost (USD), Impressions</span>.
            </p>

            {/* Custom platform selection on upload */}
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-850/60 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-450 dark:text-slate-400 uppercase">Grup Platform:</span>
              <select
                id="platform-selection-opt"
                value={uploadPlatform}
                onChange={(e) => setUploadPlatform(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-700 dark:text-slate-350 font-bold focus:outline-none"
              >
                <option value="PropellerAds">PropellerAds</option>
                <option value="Clickadu">Clickadu</option>
                <option value="GalaksionAds">GalaksionAds</option>
                <option value="HilltopAds">HilltopAds</option>
                <option value="OtherDSP">Other DSP</option>
              </select>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            {statsFileName ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono truncate max-w-[70%]">
                  <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">{statsFileName}</span>
                </div>
                <button
                  id="clear-stats-btn"
                  onClick={() => handleClearSlot(1)}
                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition-all"
                  title="Remove document file details"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  ref={fileInputStats}
                  accept=".csv"
                  onChange={handleStatsUpload}
                  className="hidden"
                />
                <button
                  id="upload-stats-trigger"
                  onClick={() => fileInputStats.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-50 dark:bg-slate-950/20 cursor-pointer transition-all"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Pilih CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Slot 2: Website Clicks Report */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 rounded-md">
                Slot 2
              </span>
              {Object.keys(clicksMap).length > 0 && <CheckCircle className="h-4 w-4 text-emerald-500" />}
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-3 uppercase">2. WEBSITE CLICKS REPORT</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Laporan pelacak klik eksternal. Integrasikan kalkulasi rasio CTR dengan menyamakan parameter <span className="font-mono text-blue-500 dark:text-blue-400 bg-slate-50 dark:bg-slate-950/40 px-1 py-0.5 rounded">Tag_link</span> (misalnya "2092100----") dengan zone yang sesuai.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-150 dark:border-slate-800">
            {clicksFileName ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono truncate max-w-[70%]">
                  <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">{clicksFileName}</span>
                </div>
                <button
                  id="clear-clicks-btn"
                  onClick={() => handleClearSlot(2)}
                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition-all"
                  title="Remove document file details"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  ref={fileInputClicks}
                  accept=".csv"
                  onChange={handleWebsiteClicksUpload}
                  className="hidden"
                />
                <button
                  id="upload-clicks-trigger"
                  onClick={() => fileInputClicks.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-50 dark:bg-slate-950/20 cursor-pointer transition-all"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Pilih CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Slot 3: Publisher Conversions (Shopee PH) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 rounded-md">
                Slot 3
              </span>
              {Object.keys(phConversionMap).length > 0 && <CheckCircle className="h-4 w-4 text-emerald-500" />}
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-3 uppercase">3. PUBLISHER CONVERSIONS</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Laporan konversi Involve Asia / Shopee PH. Menggabungkan komisi bernilai mata uang USD berdasarkan kolom <span className="font-mono text-blue-500 dark:text-blue-400 bg-slate-50 dark:bg-slate-950/40 px-1 py-0.5 rounded">Publisher Sub ID 1</span> sesuai nilai konversi kurs.
            </p>
            <div className="mt-3 p-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded border border-emerald-150 dark:border-emerald-900/40 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold font-mono">
              Tag Pasar: SHOPEE PH [ph]
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            {phFileName ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono truncate max-w-[70%]">
                  <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">{phFileName}</span>
                </div>
                <button
                  id="clear-ph-btn"
                  onClick={() => handleClearSlot(3)}
                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition-all"
                  title="Remove document file details"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  ref={fileInputPh}
                  accept=".csv"
                  onChange={handlePhConversionUpload}
                  className="hidden"
                />
                <button
                  id="upload-ph-trigger"
                  onClick={() => fileInputPh.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-50 dark:bg-slate-950/20 cursor-pointer transition-all"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Pilih CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Slot 4: Affiliate Commissions (Shopee ID Direct) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 rounded-md">
                Slot 4
              </span>
              {Object.keys(idCommissionMap).length > 0 && <CheckCircle className="h-4 w-4 text-emerald-500" />}
            </div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-3 uppercase">4. AFFILIATE COMMISSIONS</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Laporan konversi komisi langsung Rupiah dari Shopee ID Direct. Dipetakan menggunakan kolom sub-header <span className="font-mono text-blue-500 dark:text-blue-400 bg-slate-50 dark:bg-slate-950/40 px-1 py-0.5 rounded">Tag_link1</span> untuk identifikasi item.
            </p>
            <div className="mt-3 p-1.5 bg-emerald-50 dark:bg-emerald-950/30 rounded border border-emerald-150 dark:border-emerald-950/55 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold font-mono">
              Tag Pasar: SHOPEE ID [id]
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            {idFileName ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono truncate max-w-[70%]">
                  <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">{idFileName}</span>
                </div>
                <button
                  id="clear-id-btn"
                  onClick={() => handleClearSlot(4)}
                  className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer transition-all"
                  title="Remove document file details"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  ref={fileInputId}
                  accept=".csv"
                  onChange={handleIdCommissionUpload}
                  className="hidden"
                />
                <button
                  id="upload-id-trigger"
                  onClick={() => fileInputId.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-50 dark:bg-slate-950/20 cursor-pointer transition-all"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Pilih CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Guide/Instruction Tips */}
      <div className="p-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-3.5 items-start">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-800 dark:text-white">Petunjuk Alur Kerja Pembagian Halaman Baru</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Sesuai permintaan Anda, halaman <strong>Upload Data</strong> telah **dipisahkan secara penuh** dari halaman visualisasi utama. 
            Semua parameter, data CSV, dan nilai kurs yang Anda unggah atau modifikasi di sini akan secara otomatis dipertahankan dan ditransformasikan ke halaman **Dashboard & Hasil** di sidebar untuk dianalisis lebih terperinci.
          </p>
        </div>
      </div>

    </div>
  );
}
