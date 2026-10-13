import toast from "react-hot-toast";

export function notifyTaskCompleted(task: { appName?: string }) { toast.success(`${task.appName || "Generation"} completed`); }
export function notifyTaskFailed(task: { appName?: string }) { toast.error(`${task.appName || "Generation"} failed`); }
