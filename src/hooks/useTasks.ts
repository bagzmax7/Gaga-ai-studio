"use client";

import { useCallback, useEffect, useState } from "react";
import { notifyTaskCompleted, notifyTaskFailed } from "@/lib/studio-toast";

export type GagaTask = { id: string; taskId?: string; appId?: string; appName?: string; status: string; createdAt: number; updatedAt: number; nodeInfoList?: Array<{ nodeId: string; fieldName: string; fieldValue: string }>; outputs?: Array<{ fileUrl: string; fileType: string }>; error?: string };
type TaskRow = { id: string; provider_task_id: string; mode: "image" | "video"; model: string; prompt: string; project_id: string | null; status: string; created_at: string; updated_at: string | null; outputs: Array<{ fileUrl: string; fileType: string }>; error_message: string | null };

export function useTasks() {
  const [tasks, setTasks] = useState<GagaTask[]>([]);
  const load = useCallback(async () => {
    const response = await fetch("/api/tasks?limit=100", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const rows = (data.tasks || []) as TaskRow[];
    const mapped = rows.map((task) => ({ id: task.id, taskId: task.provider_task_id, appId: task.mode === "video" ? "gaga-flow-video" : "gaga-flow-image", appName: `${task.mode === "video" ? "Video" : "Image"}: ${task.model}`, status: task.status, createdAt: new Date(task.created_at).getTime(), updatedAt: new Date(task.updated_at || task.created_at).getTime(), outputs: task.outputs || [], error: task.error_message || undefined, nodeInfoList: [{ nodeId: "input", fieldName: "prompt", fieldValue: task.prompt }, { nodeId: "config", fieldName: "project_id", fieldValue: task.project_id || "" }, { nodeId: "config", fieldName: "mode", fieldValue: task.mode }] }));
    setTasks(mapped);
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 5_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);
  const addTask = useCallback((taskId: string, appId: string, appName: string, nodeInfoList?: GagaTask["nodeInfoList"], legacyApiKeyType?: string) => { void legacyApiKeyType; const id = `local_${taskId}`; setTasks((current) => current.some((item) => item.taskId === taskId) ? current : [{ id, taskId, appId, appName, status: "QUEUED", createdAt: Date.now(), updatedAt: Date.now(), nodeInfoList, outputs: [] }, ...current]); return id; }, []);
  const updateTask = useCallback((id: string, updates: Partial<GagaTask>) => setTasks((current) => current.map((task) => task.id === id || task.taskId === id ? { ...task, ...updates, updatedAt: Date.now() } : task)), []);
  const cancelTaskLocally = useCallback((id: string) => updateTask(id, { status: "CANCELED" }), [updateTask]);
  const clearTasks = useCallback(() => setTasks([]), []);
  useEffect(() => {
    const source = new EventSource("/api/tasks/events");
    source.onmessage = (event) => { try { const data = JSON.parse(event.data); const incoming = data.task; if (!incoming) return; const status = data.type === "task_completed" ? "SUCCESS" : "FAILED"; setTasks((current) => current.map((item) => item.id === incoming.id || item.taskId === incoming.taskId ? { ...item, status, outputs: incoming.outputs || item.outputs, error: incoming.error, updatedAt: Date.now() } : item)); if (status === "SUCCESS") notifyTaskCompleted(incoming); else notifyTaskFailed(incoming); } catch {} };
    return () => source.close();
  }, []);
  return { tasks, addTask, updateTask, cancelTaskLocally, clearTasks, reloadTasks: load };
}
