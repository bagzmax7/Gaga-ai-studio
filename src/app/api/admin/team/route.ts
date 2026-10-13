import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser, isAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const actor = await getAuthenticatedUser(request);
  if (!actor || !isAdmin(actor)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("gaga_users").select("id,email,full_name,role,is_active,created_at,monthly_quota_usd").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

export async function POST(request: NextRequest) {
  const actor = await getAuthenticatedUser(request);
  if (!actor || !isAdmin(actor)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    const password = String(body.password || "");
    if (!/^\S+@\S+\.\S+$/.test(email) || fullName.length < 2 || password.length < 8) {
      return NextResponse.json({ error: "Masukkan email valid, nama, dan password minimal 8 karakter." }, { status: 400 });
    }
    const supabase = createAdminClient();
    const { data: created, error: createError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (createError || !created.user) return NextResponse.json({ error: createError?.message || "User tidak dapat dibuat." }, { status: 400 });
    const { error: profileError } = await supabase.from("gaga_users").insert({ id: created.user.id, email, full_name: fullName, role: body.role === "admin" ? "admin" : "member", is_active: true, monthly_quota_usd: Number(body.monthlyQuotaUsd || 0) });
    if (profileError) {
      await supabase.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, user: { id: created.user.id, email, full_name: fullName } }, { status: 201 });
  } catch (error) {
    console.error("Gaga team member creation failed", error);
    return NextResponse.json({ error: "User tidak dapat dibuat." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await getAuthenticatedUser(request);
  if (!actor || !isAdmin(actor)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.fullName === "string" && body.fullName.trim()) updates.full_name = body.fullName.trim();
    if (body.role === "admin" || body.role === "member") updates.role = body.role;
    if (typeof body.isActive === "boolean") updates.is_active = body.isActive;
    if (body.monthlyQuotaUsd !== undefined && Number.isFinite(Number(body.monthlyQuotaUsd)) && Number(body.monthlyQuotaUsd) >= 0) updates.monthly_quota_usd = Number(body.monthlyQuotaUsd);
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("gaga_users").update(updates).eq("id", id).select("id,email,full_name,role,is_active,created_at,monthly_quota_usd").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ user: data });
  } catch {
    return NextResponse.json({ error: "Could not update team member." }, { status: 500 });
  }
}
