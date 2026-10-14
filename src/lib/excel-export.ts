/**
 * Utility functions for exporting reports to formatted Excel (.xlsx compatible / CSV)
 */

export function downloadExcelFile(csvContent: string, fileName: string) {
  // UTF-8 BOM ensures Excel displays special characters, currency symbols, and UTF-8 properly
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportTasksDetailedExcel(
  tasks: any[],
  dateRange: { from: string; to: string },
  includeCost: boolean = true
) {
  const allHeaders = [
    "Task ID",
    "User Name",
    "User Email",
    "Created At",
    "Task Name",
    "Model",
    "Status",
    "Duration (Seconds)",
    "Duration (Formatted)",
    "Cost ($ USD)",
    "Aspect Ratio",
    "Resolution",
    "Prompt",
  ];

  const formatDuration = (sec: number) => {
    if (!sec || sec <= 0) return "—";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  const rows = tasks.map((r) => {
    const cells = [
      r.taskId,
      r.userAccount,
      r.userEmail || "—",
      r.taskStartTime ? new Date(r.taskStartTime).toLocaleString() : "—",
      r.taskName,
      r.model,
      r.taskStatus,
      r.duration || 0,
      formatDuration(r.duration || 0),
      includeCost ? `$${(r.amount || 0).toFixed(4)}` : "—",
      r.ratio || "—",
      r.resolution || "—",
      r.prompt || "—",
    ];
    return cells.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
  });

  const csv = [allHeaders.join(","), ...rows].join("\r\n");
  const filename = `Gaga_AI_Studio_Tasks_Report_${dateRange.from || "all"}_to_${dateRange.to || "all"}.csv`;
  downloadExcelFile(csv, filename);
}
