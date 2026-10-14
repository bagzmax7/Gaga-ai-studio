import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { pollTask, queryTaskOutputs } from "@/lib/runninghub";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawTaskId = body.taskId ? String(body.taskId).trim() : "";
    const supabase = createAdminClient();

    if (rawTaskId) {
      // 1. Sync specific task
      const cleanTaskId = rawTaskId.replace(/^task_/, "");
      
      // Query RunningHub for outputs & status
      const state = await pollTask(cleanTaskId, "image");
      const outputsData = await queryTaskOutputs(cleanTaskId).catch(() => null);

      let costUsd = state.costUsd || 0;
      let durationSeconds = state.durationSeconds || 0;
      let firstOutput = outputsData?.data?.[0];

      if (firstOutput) {
        if (!durationSeconds && firstOutput.taskCostTime) {
          durationSeconds = parseInt(String(firstOutput.taskCostTime), 10);
        }
        if (!costUsd) {
          const money = firstOutput.consumeMoney != null ? parseFloat(String(firstOutput.consumeMoney)) : 0;
          const thirdParty = firstOutput.thirdPartyConsumeMoney != null ? parseFloat(String(firstOutput.thirdPartyConsumeMoney)) : 0;
          costUsd = thirdParty > 0 ? thirdParty : money;
        }
      }

      // Check if task exists in gaga_tasks
      const { data: existing } = await supabase
        .from("gaga_tasks")
        .select("*")
        .eq("provider_task_id", cleanTaskId)
        .maybeSingle();

      const newStatus = ["SUCCESS", "FAILED", "CANCELED"].includes(state.status) ? state.status : "RUNNING";

      if (existing) {
        const updatePayload: Record<string, unknown> = {
          status: newStatus,
          outputs: state.outputs?.length ? state.outputs : existing.outputs,
          updated_at: new Date().toISOString(),
        };
        if (costUsd > 0) updatePayload.cost_usd = costUsd;
        if (durationSeconds > 0) updatePayload.duration = String(durationSeconds);
        if (state.error) updatePayload.error_message = state.error;

        const { data: updated } = await supabase
          .from("gaga_tasks")
          .update(updatePayload)
          .eq("id", existing.id)
          .select("*")
          .single();

        return NextResponse.json({
          success: true,
          task: updated || existing,
          message: `Task ${cleanTaskId} successfully updated from RunningHub!`,
        });
      } else {
        // Insert new synced record
        const { data: inserted, error: insertErr } = await supabase
          .from("gaga_tasks")
          .insert({
            user_id: user.id,
            provider_task_id: cleanTaskId,
            mode: "image",
            model: body.model || "Studio Model",
            prompt: body.prompt || `Synced Task ${cleanTaskId.slice(0, 8)}`,
            status: newStatus,
            outputs: state.outputs || [],
            cost_usd: costUsd,
            duration: String(durationSeconds),
            metadata: { synced: true, syncSource: "RunningHub" },
          })
          .select("*")
          .single();

        if (insertErr) {
          return NextResponse.json({ error: insertErr.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          task: inserted,
          message: `Task ${cleanTaskId} successfully imported into your Gaga Studio history!`,
        });
      }
    }

    // 2. Auto-sync: Reconcile all pending tasks for this user (or all if admin)
    const { data: pending } = await supabase
      .from("gaga_tasks")
      .select("id, provider_task_id, mode, status, outputs, user_id")
      .in("status", ["QUEUED", "RUNNING"])
      .limit(20);

    let healedCount = 0;
    if (pending && pending.length > 0) {
      await Promise.allSettled(
        pending.map(async (t) => {
          try {
            const state = await pollTask(t.provider_task_id, (t.mode as any) || "image");
            const newStatus = ["SUCCESS", "FAILED", "CANCELED"].includes(state.status) ? state.status : "RUNNING";
            if (newStatus !== t.status || state.outputs?.length || state.error) {
              const updatePayload: Record<string, unknown> = {
                status: newStatus,
                outputs: state.outputs?.length ? state.outputs : t.outputs,
                updated_at: new Date().toISOString(),
              };
              if (state.costUsd !== undefined && state.costUsd > 0) updatePayload.cost_usd = state.costUsd;
              if (state.durationSeconds !== undefined && state.durationSeconds > 0) updatePayload.duration = String(state.durationSeconds);
              if (state.error) updatePayload.error_message = state.error;
              await supabase.from("gaga_tasks").update(updatePayload).eq("id", t.id);
              healedCount++;
            }
          } catch {}
        })
      );
    }

    return NextResponse.json({
      success: true,
      autoSync: true,
      healedCount,
      message: healedCount > 0
        ? `Auto-Sync Complete! Updated ${healedCount} tasks from RunningHub.`
        : "Auto-Sync Complete! All tasks are currently up-to-date.",
    });
  } catch (error: any) {
    console.error("[/api/tasks/sync-rh Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to sync task" }, { status: 500 });
  }
}
