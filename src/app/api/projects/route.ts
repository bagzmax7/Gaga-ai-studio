import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("gaga_projects").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: tasks } = await supabase.from("gaga_tasks").select("project_id,outputs,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1000);
  const counts = new Map<string, number>(); const thumbs = new Map<string, string>();
  for (const task of tasks || []) { if (!task.project_id) continue; counts.set(task.project_id, (counts.get(task.project_id) || 0) + 1); const first = task.outputs?.[0]; const url = typeof first === "string" ? first : first?.fileUrl || first?.url; if (url && !thumbs.has(task.project_id)) thumbs.set(task.project_id, url); }
  return NextResponse.json({ projects: (data || []).map((project) => ({ id: project.id, userId: project.user_id, name: project.name, description: project.description, createdAt: project.created_at, updatedAt: project.updated_at, itemCount: counts.get(project.id) || 0, thumbnailUrl: thumbs.get(project.id) })) });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("gaga_projects").insert({ user_id: user.id, name, description: typeof body.description === "string" ? body.description.trim() : "" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, project: { id: data.id, userId: data.user_id, name: data.name, description: data.description, createdAt: data.created_at, updatedAt: data.updated_at, itemCount: 0 } }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description.trim();
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("gaga_projects").update(updates).eq("id", body.id).eq("user_id", user.id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ success: true, project: { id: data.id, userId: data.user_id, name: data.name, description: data.description, createdAt: data.created_at, updatedAt: data.updated_at } });
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.from("gaga_projects").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
