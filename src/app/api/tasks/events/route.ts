import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });
  const encoder = new TextEncoder();
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const emitted = new Set<string>();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ connected: true })}\n\n`));
      const check = async () => {
        if (stopped) return;
        try {
          const supabase = createAdminClient();
          const { data } = await supabase.from("gaga_tasks").select("id,provider_task_id,mode,status,outputs,error_message,updated_at").eq("user_id", user.id).gte("updated_at", new Date(Date.now() - 12_000).toISOString()).order("updated_at", { ascending: false }).limit(20);
          for (const task of data || []) {
            const eventKey = `${task.id}:${task.status}:${task.updated_at}`;
            if ((task.status === "SUCCESS" || task.status === "FAILED") && !emitted.has(eventKey)) {
              emitted.add(eventKey);
              const type = task.status === "SUCCESS" ? "task_completed" : "task_failed";
              const payload = { type, task: { id: task.id, taskId: task.provider_task_id, status: task.status, outputs: task.outputs || [], error: task.error_message, user_id: user.id } };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch { /* polling endpoint remains the fallback */ }
      };
      timer = setInterval(() => void check(), 5_000);
      request.signal.addEventListener("abort", () => { stopped = true; if (timer) clearInterval(timer); try { controller.close(); } catch {} }, { once: true });
    },
    cancel() { stopped = true; if (timer) clearInterval(timer); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
