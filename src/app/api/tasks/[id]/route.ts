import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth";
import { pollTask } from "@/lib/runninghub";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const supabase = createAdminClient();
  let { data: task, error } = await supabase.from("gaga_tasks").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!task) {
    const lookup = await supabase.from("gaga_tasks").select("*").eq("provider_task_id", id).eq("user_id", user.id).maybeSingle();
    task = lookup.data; error = lookup.error;
  }
  if (error || !task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (["QUEUED", "RUNNING"].includes(task.status)) {
    try {
      const state = await pollTask(task.provider_task_id, task.mode);
      const status = ["SUCCESS", "FAILED", "CANCELED"].includes(state.status) ? state.status : "RUNNING";
        const updatePayload: Record<string, unknown> = {
          status,
          outputs: state.outputs || task.outputs,
          error_message: state.error || null,
          updated_at: new Date().toISOString(),
        };
        if (state.costUsd !== undefined && state.costUsd > 0) {
          updatePayload.cost_usd = state.costUsd;
        }
        if (state.durationSeconds !== undefined && state.durationSeconds > 0) {
          updatePayload.duration = String(state.durationSeconds);
        }
        const { data: updated } = await supabase.from("gaga_tasks").update(updatePayload).eq("id", task.id).eq("user_id", task.user_id).select("*").single();
        return NextResponse.json({ task: updated || { ...task, ...updatePayload } });
    } catch (error) {
      console.error("Task reconciliation failed", error);
    }
  }
  return NextResponse.json({ task });
}
