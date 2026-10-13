import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projectId = request.nextUrl.searchParams.get("projectId");
  const supabase = createAdminClient();
  let query = supabase.from("gaga_tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(300);
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const pending = (data || []).filter((task) => ["QUEUED", "RUNNING"].includes(task.status)).slice(0, 8);
  await Promise.all(pending.map(async (task) => {
    try {
      const { pollTask } = await import("@/lib/runninghub");
      const state = await pollTask(task.provider_task_id, task.mode);
      const status = ["SUCCESS", "FAILED", "CANCELED"].includes(state.status) ? state.status : "RUNNING";
      if (status !== task.status || state.outputs?.length || state.error) {
        task.status = status;
        if (state.outputs?.length) task.outputs = state.outputs;
        if (state.error) task.error_message = state.error;
        await supabase.from("gaga_tasks").update({ status, outputs: task.outputs || [], error_message: task.error_message || null, updated_at: new Date().toISOString() }).eq("id", task.id).eq("user_id", user.id);
      }
    } catch (error) { console.error("Gaga Flow reconcile failed", task.id, error); }
  }));
  const defaultProject = `flow_proj_default_${user.id}`;
  const sessions = (data || []).map((task) => ({ id: task.id, task_id: task.provider_task_id, project_id: task.project_id || defaultProject, mode: task.mode, prompt: task.prompt, model: task.model, ratio: task.aspect_ratio, quality: task.resolution, duration: task.duration || "6s", realPerson: task.metadata?.realPerson || "Off", audio: task.metadata?.audio || "On", status: task.status, attachments: task.metadata?.attachments || [], outputs: task.outputs || [], created_at: task.created_at, updated_at: task.updated_at }));
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (!body.task_id || !body.prompt) return NextResponse.json({ error: "task_id and prompt are required." }, { status: 400 });
  const supabase = createAdminClient();
  const projectId = typeof body.project_id === "string" && body.project_id.startsWith("flow_proj_") ? null : body.project_id || null;
  const { data: found } = await supabase.from("gaga_tasks").select("id,user_id").eq("provider_task_id", body.task_id).maybeSingle();
  if (found && found.user_id !== user.id) return NextResponse.json({ error: "Task is owned by another user." }, { status: 403 });
  if (found) {
    const { data: current } = await supabase.from("gaga_tasks").select("metadata").eq("id", found.id).eq("user_id", user.id).maybeSingle();
    const metadata = { ...(current?.metadata || {}), attachments: Array.isArray(body.attachments) ? body.attachments : current?.metadata?.attachments || [], realPerson: body.realPerson || current?.metadata?.realPerson || "Off", audio: body.audio || current?.metadata?.audio || "On" };
    const { error } = await supabase.from("gaga_tasks").update({ project_id: projectId, updated_at: new Date().toISOString(), metadata }).eq("id", found.id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: found.id });
  }
  const model = String(body.model || "nano-banana-pro");
  const mode = body.mode === "video" ? "video" : "image";
  const { data, error } = await supabase.from("gaga_tasks").insert({ user_id: user.id, provider_task_id: body.task_id, project_id: projectId, mode, model, prompt: body.prompt, aspect_ratio: body.ratio || "16:9", resolution: body.quality || "1K", duration: body.duration || null, status: ["QUEUED", "RUNNING", "FAILED", "SUCCESS", "CANCELED"].includes(body.status) ? body.status : "QUEUED", outputs: Array.isArray(body.outputs) ? body.outputs : [], metadata: { attachments: Array.isArray(body.attachments) ? body.attachments : [], realPerson: body.realPerson || "Off", audio: body.audio || "On" } }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const taskId = String(body.task_id || body.id || "");
  if (!taskId) return NextResponse.json({ error: "Task ID required." }, { status: 400 });
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === "string") updates.status = body.status;
  if (Array.isArray(body.outputs)) updates.outputs = body.outputs;
  if (typeof body.error === "string") updates.error_message = body.error;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("gaga_tasks").update(updates).eq("user_id", user.id).eq("provider_task_id", taskId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, updated: Boolean(data) });
}
