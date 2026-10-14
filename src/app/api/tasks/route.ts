import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth";
import { createImageTask, createVideoTask, IMAGE_MODELS, VIDEO_MODELS } from "@/lib/runninghub";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 50)));
  const supabase = createAdminClient();
  let query = supabase.from("gaga_tasks").select("*").order("created_at", { ascending: false }).limit(limit);
  const requestedUser = request.nextUrl.searchParams.get("userId");
  if (user.role === "admin" && requestedUser) query = query.eq("user_id", requestedUser);
  else if (user.role !== "admin") query = query.eq("user_id", user.id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const tasks = data || [];
  const pendingTasks = tasks.filter((task) => ["QUEUED", "RUNNING"].includes(task.status)).slice(0, 8);
  await Promise.all(pendingTasks.map(async (task) => {
    try {
      const { pollTask } = await import("@/lib/runninghub");
      const state = await pollTask(task.provider_task_id, task.mode);
      const status = ["SUCCESS", "FAILED", "CANCELED"].includes(state.status) ? state.status : "RUNNING";
      if (status !== task.status || state.outputs?.length || state.error) {
        const resolvedOutputs = state.outputs?.length ? state.outputs : task.outputs;
        const updatePayload: Record<string, unknown> = {
          status,
          outputs: resolvedOutputs || [],
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
        task.status = status;
        if (state.outputs?.length) task.outputs = state.outputs;
        if (state.error) task.error_message = state.error;
      }
    } catch (pollError) {
      console.error("Could not reconcile Gaga task", task.id, pollError);
    }
  }));
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let insertedId: string | null = null;
  try {
    const body = await request.json();
    const mode = body.mode === "video" ? "video" : "image";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ error: "Prompt wajib diisi." }, { status: 400 });
    const model = String(body.model || (mode === "image" ? "nano-banana-fast" : "seedance-2-fast"));
    if (mode === "image" && !IMAGE_MODELS.some((item) => item.id === model)) return NextResponse.json({ error: "Unsupported image model." }, { status: 400 });
    if (mode === "video" && !VIDEO_MODELS.some((item) => item.id === model)) return NextResponse.json({ error: "Unsupported video model." }, { status: 400 });
    const input = {
      model,
      prompt,
      aspectRatio: String(body.aspectRatio || (mode === "image" ? "1:1" : "16:9")),
      resolution: String(body.resolution || (mode === "image" ? "1K" : "720p")),
      duration: String(body.duration || "8"),
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.filter((url: unknown): url is string => typeof url === "string") : undefined,
      videoUrls: Array.isArray(body.videoUrls) ? body.videoUrls.filter((url: unknown): url is string => typeof url === "string") : undefined,
      audioUrls: Array.isArray(body.audioUrls) ? body.audioUrls.filter((url: unknown): url is string => typeof url === "string") : undefined,
      generateAudio: typeof body.generateAudio === "boolean" ? body.generateAudio : undefined,
      realPersonMode: typeof body.realPersonMode === "boolean" ? body.realPersonMode : undefined,
    };
    const providerTaskId = mode === "image" ? await createImageTask(input) : await createVideoTask(input);
    const supabase = createAdminClient();
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const { data: task, error } = await supabase.from("gaga_tasks").insert({ user_id: user.id, provider_task_id: providerTaskId, mode, model, prompt, project_id: body.projectId || null, aspect_ratio: input.aspectRatio, resolution: input.resolution, duration: mode === "video" ? input.duration : null, status: "QUEUED", outputs: [], metadata: { image_url: input.imageUrl || null, attachments, realPerson: input.realPersonMode ? "On" : "Off", audio: input.generateAudio === false ? "Off" : "On" } }).select("id,provider_task_id,mode,model,prompt,project_id,aspect_ratio,resolution,duration,status,outputs,created_at").single();
    if (error) {
      console.error("Task record insert failed", error);
      return NextResponse.json({ error: "Task dibuat provider, tetapi history gagal dicatat. Hubungi administrator." }, { status: 500 });
    }
    insertedId = task.id;
    return NextResponse.json({ taskId: providerTaskId, task }, { status: 202 });
  } catch (error) {
    console.error("Generation request failed", { insertedId, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation tidak dapat dimulai." }, { status: 502 });
  }
}
