"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import GagaAuthGate from "@/components/gaga-auth-gate";
import GagaSidebar from "@/components/gaga-sidebar";
import {
  History,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Search,
  Filter,
  Eye,
  X,
  Sparkles,
  Film,
  ImageIcon,
  RefreshCw,
  Play,
  Pause,
  LayoutGrid,
  Table as TableIcon,
  Copy,
  Check,
  Timer,
  DollarSign,
  CloudDownload,
  User as UserIcon,
  Layers,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { downloadAsset } from "@/lib/download";
import { exportTasksDetailedExcel } from "@/lib/excel-export";

interface BillingRecord {
  taskId: string;
  dbId: string;
  taskName: string;
  app: string;
  taskStatus: "SUCCESS" | "FAILED" | "RUNNING" | "QUEUED" | "CANCELED";
  taskStartTime: string;
  userAccount: string;
  userEmail: string;
  userId: string;
  outputs: any[];
  outputUrl?: string | null;
  mediaType: "image" | "video";
  prompt: string;
  model: string;
  ratio: string;
  resolution: string;
  projectId?: string | null;
  projectName?: string;
  duration: number; // in seconds
  amount: number; // in USD
  errorMessage?: string | null;
  metadata?: any;
}

interface BillingStats {
  total: number;
  successCount: number;
  failedCount: number;
  runningCount: number;
  queuedCount: number;
  totalDuration: number;
  totalAmount: number;
}

interface TeamUser {
  id: string;
  email: string;
  full_name: string;
}

interface ProjectItem {
  id: string;
  name: string;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function formatTotalDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  if (s === "SUCCESS") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#d9b66f] bg-[#d9b66f]/10 border border-[#d9b66f]/30 px-2 py-0.5 rounded-full font-mono">
        <CheckCircle2 className="w-3 h-3 text-[#d9b66f]" /> Success
      </span>
    );
  }
  if (s === "RUNNING") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-full font-mono">
        <Loader2 className="w-3 h-3 animate-spin" /> Running
      </span>
    );
  }
  if (s === "QUEUED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
        <Clock className="w-3 h-3" /> Queued
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-full font-mono">
      <XCircle className="w-3 h-3" /> Failed
    </span>
  );
}

export default function HistoryPage() {
  return (
    <GagaAuthGate>
      {(currentUser) => <HistoryContent currentUser={currentUser} />}
    </GagaAuthGate>
  );
}

function HistoryContent({ currentUser }: { currentUser: any }) {
  const [viewMode, setViewMode] = useState<"gallery" | "table">("gallery");
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [page, setPage] = useState(1);

  // Date filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Inspector & Sync Modals
  const [selectedRecord, setSelectedRecord] = useState<BillingRecord | null>(null);
  const [copiedTaskId, setCopiedTaskId] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncTaskIdInput, setSyncTaskIdInput] = useState("");
  const [syncingTask, setSyncingTask] = useState(false);
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);

  const isAdmin = currentUser.role === "admin";
  const PAGE_SIZE = viewMode === "gallery" ? 18 : 25;

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({
        from: dateFrom,
        to: dateTo,
        status: statusFilter,
        app: appFilter,
        projectId: projectFilter,
        userId: userFilter,
        keyword: search,
      });

      const res = await fetch(`/api/history?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setStats(data.stats || null);
        if (Array.isArray(data.teamUsers)) setTeamUsers(data.teamUsers);
        if (Array.isArray(data.projects)) setProjectsList(data.projects);
      } else {
        toast.error("Failed to load generation history");
      }
    } catch (err) {
      console.error("History load error:", err);
      toast.error("Network error loading history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFrom, dateTo, statusFilter, appFilter, userFilter, projectFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Pagination
  const totalPages = Math.ceil(records.length / PAGE_SIZE) || 1;
  const pagedRecords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return records.slice(start, start + PAGE_SIZE);
  }, [records, page, PAGE_SIZE]);

  // Synchronize with RunningHub
  const handleAutoSyncRunningHub = async (specificId?: string) => {
    setSyncingTask(true);
    const toastId = toast.loading("Connecting to RunningHub cloud to reconcile tasks...");
    try {
      const res = await fetch("/api/tasks/sync-rh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(specificId ? { taskId: specificId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success(data.message || "RunningHub synchronized successfully!", { id: toastId, duration: 4000 });
      setIsSyncModalOpen(false);
      setSyncTaskIdInput("");
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to sync from RunningHub", { id: toastId });
    } finally {
      setSyncingTask(false);
    }
  };

  const handleExportCSV = () => {
    if (records.length === 0) {
      toast.error("No records found to export");
      return;
    }
    exportTasksDetailedExcel(records, { from: dateFrom, to: dateTo }, isAdmin);
    toast.success("Tasks & Cost report exported to CSV!");
  };

  const copyToClipboard = (text: string, type: "task" | "prompt") => {
    navigator.clipboard.writeText(text);
    if (type === "task") {
      setCopiedTaskId(true);
      setTimeout(() => setCopiedTaskId(false), 2000);
    } else {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
    toast.success(`${type === "task" ? "Task ID" : "Prompt"} copied to clipboard`);
  };

  return (
    <div className="gaga-app-shell">
      <GagaSidebar />
      <main className="gaga-overview-main">
        {/* TOPBAR */}
        <header className="gaga-topbar">
          <div>
            <span className="gaga-breadcrumb">
              WORKSPACE <span>/</span> HISTORY &amp; COST
            </span>
            <h1 className="flex items-center gap-2.5">
              Generation History &amp; Cost
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#d9b66f]/15 border border-[#d9b66f]/30 text-[#d9b66f]">
                {isAdmin ? "Team Tracking & Audit" : "My Studio History"}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#10100f] border border-white/10 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("gallery")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === "gallery"
                    ? "bg-[#d9b66f] text-black shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <LayoutGrid size={14} />
                <span>Gallery</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === "table"
                    ? "bg-[#d9b66f] text-black shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <TableIcon size={14} />
                <span>Matrix Table</span>
              </button>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 border border-white/10 text-xs font-semibold text-zinc-300 bg-[#10100f] px-3.5 py-2 rounded-lg hover:text-white transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 border border-[#d9b66f]/30 text-xs font-semibold text-[#d9b66f] bg-[#d9b66f]/10 px-3.5 py-2 rounded-lg hover:bg-[#d9b66f]/20 transition-all"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => handleAutoSyncRunningHub()}
              disabled={syncingTask}
              className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-3.5 py-2 rounded-lg hover:bg-sky-500/20 transition-all disabled:opacity-50"
              title="Auto-sync RunningHub completion & cost"
            >
              {syncingTask ? <Loader2 size={13} className="animate-spin" /> : <CloudDownload size={13} />}
              <span>Sync Cloud</span>
            </button>
          </div>
        </header>

        {/* 1. METRICS STRIP */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 my-5">
          <div className="p-3.5 rounded-xl bg-[#10100f] border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-400 block">Total Generations</span>
              <span className="text-xl font-bold text-white font-mono">{stats?.total ?? records.length}</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-md bg-[#d9b66f]/10 text-[#d9b66f] font-mono border border-[#d9b66f]/20">
              {stats?.successCount ?? 0} Success
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#10100f] border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-400 block">Total Compute Time</span>
              <span className="text-xl font-bold text-white font-mono">{formatTotalDuration(stats?.totalDuration ?? 0)}</span>
            </div>
            <Timer className="w-5 h-5 text-amber-400 opacity-80" />
          </div>

          <div className="p-3.5 rounded-xl bg-[#10100f] border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-400 block">In-Flight / Queued</span>
              <span className="text-xl font-bold text-sky-400 font-mono">
                {(stats?.runningCount ?? 0) + (stats?.queuedCount ?? 0)}
              </span>
            </div>
            <Loader2 className="w-5 h-5 text-sky-400 opacity-80" />
          </div>

          <div className="p-3.5 rounded-xl bg-[#10100f] border border-[#d9b66f]/20 bg-gradient-to-br from-[#d9b66f]/5 to-transparent flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono text-[#d9b66f] block">Total Cost Spend</span>
              <span className="text-xl font-bold text-[#d9b66f] font-mono">
                ${(stats?.totalAmount ?? 0).toFixed(4)}
              </span>
            </div>
            <DollarSign className="w-5 h-5 text-[#d9b66f]" />
          </div>
        </section>

        {/* 2. FILTER BAR */}
        <section className="p-3.5 rounded-xl bg-[#10100f] border border-white/10 flex flex-wrap items-center gap-3 mb-6">
          {/* Keyword Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search prompt, model, task ID..."
              className="w-full bg-[#171715] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#d9b66f]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#171715] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d9b66f]"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="RUNNING">Running</option>
            <option value="QUEUED">Queued</option>
            <option value="FAILED">Failed</option>
          </select>

          {/* Studio App Mode Filter */}
          <select
            value={appFilter}
            onChange={(e) => {
              setAppFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#171715] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d9b66f]"
          >
            <option value="">All Studio Modes</option>
            <option value="flow-image">Creative Flow (Image)</option>
            <option value="flow-video">Creative Flow (Video)</option>
            <option value="auto-retouch">Auto Retouch</option>
            <option value="remove-bg">Remove Background</option>
          </select>

          {/* User / Team Filter (Admin Only) */}
          {isAdmin && teamUsers.length > 0 && (
            <select
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#171715] border border-[#d9b66f]/40 text-[#d9b66f] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#d9b66f]"
            >
              <option value="">All Team Members</option>
              {teamUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  👤 {u.full_name} ({u.email.split("@")[0]})
                </option>
              ))}
            </select>
          )}

          {/* Project Filter */}
          {projectsList.length > 0 && (
            <select
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#171715] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d9b66f]"
            >
              <option value="">All Projects</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  📁 {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Date Range */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="bg-[#171715] border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-[#d9b66f]"
            />
            <span>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="bg-[#171715] border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-[#d9b66f]"
            />
          </div>
        </section>

        {/* 3. MAIN CONTENT: GALLERY OR TABLE */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#d9b66f]" />
            <span className="text-xs text-zinc-400">Loading generation history and costs...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl bg-[#10100f] border border-white/10">
            <div className="w-12 h-12 rounded-2xl bg-[#d9b66f]/10 border border-[#d9b66f]/20 flex items-center justify-center text-[#d9b66f] mb-3">
              <History size={24} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">No generations found</h3>
            <p className="text-xs text-zinc-400 max-w-sm mb-4">
              No tasks matched your active filter criteria. Start creating in Creative Flow, Auto Retouch, or Remove Background.
            </p>
            <div className="flex items-center gap-3">
              <Link href="/creative-flow" className="gaga-primary-button">
                Open Creative Flow <ArrowRight size={14} />
              </Link>
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setAppFilter("");
                  setUserFilter("");
                  setProjectFilter("");
                }}
                className="text-xs text-zinc-400 hover:text-white px-3 py-1.5"
              >
                Clear Filters
              </button>
            </div>
          </div>
        ) : viewMode === "gallery" ? (
          /* ── GALLERY GRID VIEW ── */
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {pagedRecords.map((item) => (
                <div
                  key={item.taskId}
                  onClick={() => setSelectedRecord(item)}
                  className="group relative flex flex-col overflow-hidden rounded-xl bg-[#121210] border border-white/10 hover:border-[#d9b66f]/50 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-black/60"
                >
                  {/* Media Viewport */}
                  <div
                    className="relative w-full aspect-square bg-[#080807] overflow-hidden flex items-center justify-center"
                    onMouseEnter={() => item.mediaType === "video" && setHoveredVideoId(item.taskId)}
                    onMouseLeave={() => setHoveredVideoId(null)}
                  >
                    {item.outputUrl ? (
                      item.mediaType === "video" ? (
                        <video
                          src={item.outputUrl}
                          className="w-full h-full object-cover"
                          preload="metadata"
                          playsInline
                          muted
                          loop
                          ref={(el) => {
                            if (el) {
                              if (hoveredVideoId === item.taskId) el.play().catch(() => {});
                              else el.pause();
                            }
                          }}
                        />
                      ) : (
                        <Image
                          src={item.outputUrl}
                          alt={item.prompt || "Generated asset"}
                          fill
                          unoptimized
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 text-zinc-500 p-4 text-center">
                        {item.taskStatus === "RUNNING" || item.taskStatus === "QUEUED" ? (
                          <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-zinc-600" />
                        )}
                        <span className="text-[10px] uppercase font-mono">{item.taskStatus}</span>
                      </div>
                    )}

                    {/* Top status & media badges */}
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                      <StatusBadge status={item.taskStatus} />
                      {item.mediaType === "video" && (
                        <span className="flex items-center gap-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-300">
                          <Film size={10} className="text-[#d9b66f]" /> Video
                        </span>
                      )}
                    </div>

                    {/* Hover Quick Action Buttons */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecord(item);
                        }}
                        className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-colors"
                        title="Inspect details"
                      >
                        <Eye size={14} />
                      </button>
                      {item.outputUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadAsset(item.outputUrl!, `${item.taskName}-${item.taskId.slice(0, 8)}.${item.mediaType === "video" ? "mp4" : "png"}`);
                          }}
                          className="w-8 h-8 rounded-full bg-[#d9b66f] text-black flex items-center justify-center hover:bg-[#e8ca87] transition-colors"
                          title="Download asset"
                        >
                          <Download size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Meta */}
                  <div className="p-3 flex flex-col gap-1.5 flex-1 justify-between bg-[#11110f]">
                    <div>
                      <div className="flex items-center justify-between gap-1 text-[10px] text-zinc-400 mb-0.5">
                        <span className="font-semibold text-zinc-300 truncate">{item.taskName}</span>
                        <span className="font-mono text-[#d9b66f] font-bold">
                          {item.amount > 0 ? `$${item.amount.toFixed(4)}` : "Free"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed">
                        {item.prompt || "No prompt recorded"}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[9px] text-zinc-400">
                      <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                        <span className="w-4 h-4 rounded-full bg-[#d9b66f]/20 text-[#d9b66f] flex items-center justify-center text-[8px] font-bold flex-none">
                          {item.userAccount.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate">{item.userAccount}</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-zinc-400">
                        <Clock size={10} />
                        <span>{formatDuration(item.duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10 text-xs">
                <span className="text-zinc-400">
                  Showing page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({records.length} items)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg bg-[#10100f] border border-white/10 text-zinc-300 disabled:opacity-40 hover:text-white"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg bg-[#10100f] border border-white/10 text-zinc-300 disabled:opacity-40 hover:text-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── MATRIX TABLE VIEW ── */
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#10100f]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-[#161614] text-[10px] uppercase font-mono text-zinc-400">
                  <th className="py-3 px-3">Preview</th>
                  <th className="py-3 px-3">Task ID</th>
                  <th className="py-3 px-3">Created</th>
                  <th className="py-3 px-3">App / Mode</th>
                  <th className="py-3 px-3">Creator</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Duration</th>
                  <th className="py-3 px-3">Cost ($ USD)</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pagedRecords.map((r) => (
                  <tr
                    key={r.taskId}
                    onClick={() => setSelectedRecord(r)}
                    className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center relative flex-none">
                        {r.outputUrl ? (
                          r.mediaType === "video" ? (
                            <Film size={16} className="text-[#d9b66f]" />
                          ) : (
                            <Image src={r.outputUrl} alt="" fill unoptimized className="object-cover" />
                          )
                        ) : (
                          <ImageIcon size={14} className="text-zinc-600" />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <span>{r.taskId.slice(0, 10)}…</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(r.taskId, "task");
                          }}
                          className="text-zinc-500 hover:text-white"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">
                      {new Date(r.taskStartTime).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-zinc-200">
                      <div className="flex flex-col">
                        <span>{r.taskName}</span>
                        <span className="text-[10px] text-zinc-500">{r.model}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#d9b66f]/20 text-[#d9b66f] flex items-center justify-center text-[8px] font-bold">
                          {r.userAccount.charAt(0).toUpperCase()}
                        </span>
                        <span>{r.userAccount}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={r.taskStatus} />
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-300">
                      {formatDuration(r.duration)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#d9b66f] font-bold">
                      {r.amount > 0 ? `$${r.amount.toFixed(4)}` : "$0.0000"}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {r.outputUrl && (
                          <button
                            onClick={() => downloadAsset(r.outputUrl!, `${r.taskName}-${r.taskId.slice(0, 8)}.${r.mediaType === "video" ? "mp4" : "png"}`)}
                            className="p-1.5 rounded-md hover:bg-white/10 text-zinc-300 hover:text-[#d9b66f]"
                            title="Download asset"
                          >
                            <Download size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedRecord(r)}
                          className="p-1.5 rounded-md hover:bg-white/10 text-zinc-300 hover:text-white"
                          title="Inspect details"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3.5 border-t border-white/10 text-xs">
                <span className="text-zinc-400">
                  Showing page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({records.length} items)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg bg-[#161614] border border-white/10 text-zinc-300 disabled:opacity-40 hover:text-white"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg bg-[#161614] border border-white/10 text-zinc-300 disabled:opacity-40 hover:text-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. DETAIL LIGHTBOX INSPECTOR MODAL */}
        {selectedRecord && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div
              className="relative w-full max-w-4xl max-h-[90vh] bg-[#11110f] border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedRecord(null)}
                className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/60 text-zinc-300 hover:text-white flex items-center justify-center border border-white/10 hover:bg-black/80 transition-all"
              >
                <X size={16} />
              </button>

              {/* Media Preview (Left / Center) */}
              <div className="w-full md:w-3/5 bg-black/90 flex items-center justify-center p-4 min-h-[300px] md:min-h-[500px] relative">
                {selectedRecord.outputUrl ? (
                  selectedRecord.mediaType === "video" ? (
                    <video
                      src={selectedRecord.outputUrl}
                      controls
                      autoPlay
                      loop
                      className="max-h-[75vh] w-auto max-w-full rounded-lg"
                    />
                  ) : (
                    <div className="relative w-full h-[450px]">
                      <Image
                        src={selectedRecord.outputUrl}
                        alt=""
                        fill
                        unoptimized
                        className="object-contain rounded-lg"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-500 gap-2">
                    <ImageIcon size={48} className="text-zinc-700" />
                    <span>No media output rendered</span>
                  </div>
                )}
              </div>

              {/* Metadata Details Panel (Right) */}
              <div className="w-full md:w-2/5 p-5 flex flex-col justify-between overflow-y-auto max-h-[75vh] border-t md:border-t-0 md:border-l border-white/10">
                <div className="space-y-4">
                  {/* Task Header */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase font-mono text-zinc-400">
                        {selectedRecord.taskName}
                      </span>
                      <StatusBadge status={selectedRecord.taskStatus} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs text-zinc-300">
                        {selectedRecord.taskId}
                      </span>
                      <button
                        onClick={() => copyToClipboard(selectedRecord.taskId, "task")}
                        className="text-zinc-500 hover:text-[#d9b66f]"
                        title="Copy Task ID"
                      >
                        {copiedTaskId ? <Check size={12} className="text-[#d9b66f]" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Prompt Box */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] uppercase font-mono text-zinc-400 mb-1.5">
                      <span>Prompt</span>
                      <button
                        onClick={() => copyToClipboard(selectedRecord.prompt, "prompt")}
                        className="text-zinc-500 hover:text-[#d9b66f] flex items-center gap-1"
                      >
                        {copiedPrompt ? <Check size={10} className="text-[#d9b66f]" /> : <Copy size={10} />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-lg bg-[#161614] border border-white/10 text-xs text-zinc-200 leading-relaxed max-h-36 overflow-y-auto">
                      {selectedRecord.prompt || "No prompt text recorded."}
                    </div>
                  </div>

                  {/* Technical & Cost Specs */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#161614] border border-white/5">
                      <span className="text-[9px] uppercase font-mono text-zinc-500 block">Model Engine</span>
                      <span className="font-semibold text-zinc-200 truncate block">{selectedRecord.model}</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#161614] border border-white/5">
                      <span className="text-[9px] uppercase font-mono text-zinc-500 block">Cost ($ USD)</span>
                      <span className="font-mono font-bold text-[#d9b66f] block">
                        {selectedRecord.amount > 0 ? `$${selectedRecord.amount.toFixed(4)}` : "$0.0000"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#161614] border border-white/5">
                      <span className="text-[9px] uppercase font-mono text-zinc-500 block">Duration</span>
                      <span className="font-mono text-zinc-200 block">
                        {formatDuration(selectedRecord.duration)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#161614] border border-white/5">
                      <span className="text-[9px] uppercase font-mono text-zinc-500 block">Aspect Ratio</span>
                      <span className="font-mono text-zinc-200 block">
                        {selectedRecord.ratio} ({selectedRecord.resolution})
                      </span>
                    </div>
                  </div>

                  {/* Creator Info */}
                  <div className="p-2.5 rounded-lg bg-[#161614] border border-white/5 flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#d9b66f]/20 text-[#d9b66f] flex items-center justify-center text-xs font-bold flex-none">
                      {selectedRecord.userAccount.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-zinc-200 block truncate">
                        {selectedRecord.userAccount}
                      </span>
                      <span className="text-[10px] text-zinc-400 block truncate">
                        {selectedRecord.userEmail}
                      </span>
                    </div>
                  </div>

                  {/* Error if failed */}
                  {selectedRecord.errorMessage && (
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      <span className="font-bold block text-[10px] uppercase font-mono mb-1">Execution Failure:</span>
                      {selectedRecord.errorMessage}
                    </div>
                  )}
                </div>

                {/* Bottom Action */}
                <div className="pt-4 border-t border-white/10 mt-4 flex items-center gap-2">
                  {selectedRecord.outputUrl ? (
                    <button
                      onClick={() =>
                        downloadAsset(
                          selectedRecord.outputUrl!,
                          `${selectedRecord.taskName}-${selectedRecord.taskId.slice(0, 8)}.${selectedRecord.mediaType === "video" ? "mp4" : "png"}`
                        )
                      }
                      className="gaga-primary-button flex-1"
                    >
                      <Download size={14} /> Download Asset
                    </button>
                  ) : null}
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="px-3 py-2 rounded-lg border border-white/10 text-xs text-zinc-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
