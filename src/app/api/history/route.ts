import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { pollTask } from "@/lib/runninghub";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = isAdmin(user);
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("from") || "";
    const dateTo = url.searchParams.get("to") || "";
    const status = url.searchParams.get("status") || "";
    const appFilter = url.searchParams.get("app") || "";
    const projectIdFilter = url.searchParams.get("projectId") || "";
    const targetUserId = url.searchParams.get("userId") || "";
    const keyword = (url.searchParams.get("keyword") || "").toLowerCase().trim();

    const supabase = createAdminClient();

    // Query gaga_tasks with user and project details
    let query = supabase
      .from("gaga_tasks")
      .select(`
        id,
        provider_task_id,
        user_id,
        project_id,
        mode,
        model,
        prompt,
        aspect_ratio,
        resolution,
        duration,
        status,
        outputs,
        metadata,
        error_message,
        cost_usd,
        created_at,
        updated_at,
        gaga_users!inner(id, email, full_name),
        gaga_projects(id, name)
      `)
      .order("created_at", { ascending: false })
      .limit(1000);

    // Scoping: Admin can view all or specific user; Member only views their own
    if (admin) {
      if (targetUserId && targetUserId !== "ALL") {
        query = query.eq("user_id", targetUserId);
      }
    } else {
      query = query.eq("user_id", user.id);
    }

    if (status && status !== "ALL") {
      query = query.eq("status", status.toUpperCase());
    }

    if (dateFrom) {
      try {
        const fromIso = dateFrom.includes("T")
          ? new Date(dateFrom).toISOString()
          : new Date(`${dateFrom}T00:00:00.000Z`).toISOString();
        query = query.gte("created_at", fromIso);
      } catch {}
    }

    if (dateTo) {
      try {
        const toDate = new Date(dateTo.includes("T") ? dateTo : `${dateTo}T23:59:59.999Z`);
        toDate.setUTCDate(toDate.getUTCDate() + 1);
        query = query.lte("created_at", toDate.toISOString());
      } catch {}
    }

    const { data: rawTasks, error } = await query;
    if (error) {
      console.error("[/api/history GET Supabase query error]:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-reconcile in background for a batch of pending tasks (QUEUED or RUNNING)
    const pendingTasks = (rawTasks || []).filter((t: any) =>
      ["QUEUED", "RUNNING"].includes(t.status)
    ).slice(0, 5);

    if (pendingTasks.length > 0) {
      await Promise.allSettled(
        pendingTasks.map(async (task: any) => {
          try {
            const state = await pollTask(task.provider_task_id, task.mode || "image");
            const newStatus = ["SUCCESS", "FAILED", "CANCELED"].includes(state.status)
              ? state.status
              : "RUNNING";

            if (newStatus !== task.status || state.outputs?.length || state.error) {
              const updatePayload: Record<string, unknown> = {
                status: newStatus,
                outputs: state.outputs?.length ? state.outputs : task.outputs,
                error_message: state.error || null,
                updated_at: new Date().toISOString(),
              };
              if (state.costUsd !== undefined && state.costUsd > 0) {
                updatePayload.cost_usd = state.costUsd;
                task.cost_usd = state.costUsd;
              }
              if (state.durationSeconds !== undefined && state.durationSeconds > 0) {
                updatePayload.duration = String(state.durationSeconds);
                task.duration = String(state.durationSeconds);
              }
              await supabase.from("gaga_tasks").update(updatePayload).eq("id", task.id);
              task.status = newStatus;
              if (state.outputs?.length) task.outputs = state.outputs;
              if (state.error) task.error_message = state.error;
            }
          } catch (pollErr) {
            console.warn("[/api/history poll error]", task.provider_task_id, pollErr);
          }
        })
      );
    }

    // Process tasks into standard BillingRecord list
    const records: any[] = [];
    const seenTaskIds = new Set<string>();

    for (const t of rawTasks || []) {
      const taskId = String(t.provider_task_id || t.id || "");
      if (!taskId || seenTaskIds.has(taskId)) continue;
      seenTaskIds.add(taskId);

      // Extract media URL and type
      let mediaUrl: string | null = null;
      let mediaType: "image" | "video" = t.mode === "video" ? "video" : "image";

      if (Array.isArray(t.outputs) && t.outputs.length > 0) {
        for (const out of t.outputs) {
          if (typeof out === "string" && out.trim()) {
            mediaUrl = out.trim();
            break;
          }
          const candidate = out?.fileUrl || out?.url || out?.outputUrl || out?.download_url;
          if (candidate && typeof candidate === "string") {
            mediaUrl = candidate.trim();
            break;
          }
        }
      } else if (typeof t.outputs === "string" && t.outputs.trim()) {
        mediaUrl = t.outputs.trim();
      }

      if (mediaUrl) {
        const lower = mediaUrl.toLowerCase();
        if (lower.includes(".mp4") || lower.includes(".webm") || lower.includes(".mov")) {
          mediaType = "video";
        }
      }

      // Determine task application category & display name
      const meta = (typeof t.metadata === "object" && t.metadata !== null) ? t.metadata : {};
      const app = meta.app || (t.model?.startsWith("retouch:") ? "auto-retouch" : (t.model === "remove-bg" ? "remove-bg" : (t.mode === "video" ? "flow-video" : "flow-image")));
      
      let taskName = "Creative Flow (Image)";
      if (app === "flow-video" || t.mode === "video") taskName = "Creative Flow (Video)";
      else if (app === "auto-retouch" || t.model?.startsWith("retouch:")) taskName = "Auto Retouch Studio";
      else if (app === "remove-bg" || t.model === "remove-bg") taskName = "Remove Background";

      // Filter by app
      if (appFilter && appFilter !== "ALL") {
        if (app !== appFilter && !taskName.toLowerCase().includes(appFilter.toLowerCase())) {
          continue;
        }
      }

      // Filter by project
      const projectId = t.project_id || meta.projectId || null;
      const projectName = (t.gaga_projects as any)?.name || meta.projectName || "General Studio";
      if (projectIdFilter && projectIdFilter !== "ALL") {
        if (projectId !== projectIdFilter) continue;
      }

      // Keyword search
      const promptVal = String(t.prompt || "");
      if (keyword) {
        const matchKeyword =
          taskId.toLowerCase().includes(keyword) ||
          taskName.toLowerCase().includes(keyword) ||
          projectName.toLowerCase().includes(keyword) ||
          promptVal.toLowerCase().includes(keyword) ||
          String(t.model || "").toLowerCase().includes(keyword);
        if (!matchKeyword) continue;
      }

      const durationSec = t.duration ? parseInt(String(t.duration), 10) || 0 : 0;
      const amountUsd = t.cost_usd ? parseFloat(String(t.cost_usd)) || 0 : 0;

      const userProfile = t.gaga_users as any;
      const userAccount = userProfile?.full_name || (userProfile?.email ? userProfile.email.split("@")[0] : "Creator");
      const userEmail = userProfile?.email || "";

      records.push({
        taskId,
        dbId: t.id,
        taskName,
        app,
        taskStatus: (t.status || "QUEUED").toUpperCase(),
        taskStartTime: t.created_at,
        userAccount,
        userEmail,
        userId: t.user_id,
        outputs: Array.isArray(t.outputs) ? t.outputs : (mediaUrl ? [{ fileUrl: mediaUrl }] : []),
        outputUrl: mediaUrl,
        mediaType,
        prompt: promptVal,
        model: t.model || "Studio Model",
        ratio: t.aspect_ratio || "1:1",
        resolution: t.resolution || "1K",
        projectId,
        projectName,
        duration: durationSec,
        amount: amountUsd,
        errorMessage: t.error_message || null,
        metadata: meta,
      });
    }

    // Calculate aggregated statistics
    const successCount = records.filter((r) => r.taskStatus === "SUCCESS").length;
    const failedCount = records.filter((r) => r.taskStatus === "FAILED" || r.taskStatus === "CANCELED").length;
    const runningCount = records.filter((r) => r.taskStatus === "RUNNING").length;
    const queuedCount = records.filter((r) => r.taskStatus === "QUEUED").length;
    const totalDuration = records.reduce((acc, r) => acc + (r.duration || 0), 0);
    const totalAmount = records.reduce((acc, r) => acc + (r.amount || 0), 0);

    // Fetch team users list for admin filter dropdown
    let teamUsers: Array<{ id: string; email: string; full_name: string }> = [];
    if (admin) {
      const { data: userList } = await supabase
        .from("gaga_users")
        .select("id, email, full_name")
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      teamUsers = userList || [];
    }

    // Fetch active projects for filter dropdown
    let projects: Array<{ id: string; name: string }> = [];
    const projQuery = admin
      ? supabase.from("gaga_projects").select("id, name").order("name", { ascending: true })
      : supabase.from("gaga_projects").select("id, name").eq("user_id", user.id).order("name", { ascending: true });
    const { data: projList } = await projQuery;
    projects = projList || [];

    return NextResponse.json({
      records,
      stats: {
        total: records.length,
        successCount,
        failedCount,
        runningCount,
        queuedCount,
        totalDuration,
        totalAmount,
      },
      teamUsers,
      projects,
      currentUser: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isAdmin: admin,
      },
    });
  } catch (error: any) {
    console.error("[/api/history GET Error]:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
