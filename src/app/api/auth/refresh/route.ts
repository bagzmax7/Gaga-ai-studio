import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get("gaga_refresh")?.value;
    if (typeof refreshToken !== "string" || !refreshToken) return NextResponse.json({ error: "Refresh token required" }, { status: 400 });
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) return NextResponse.json({ error: "Session expired" }, { status: 401 });
    const { data: profile } = await supabase.from("gaga_users").select("id,email,full_name,role,is_active").eq("id", data.user.id).maybeSingle();
    if (!profile?.is_active) return NextResponse.json({ error: "Account is inactive" }, { status: 403 });
    if (process.env.GAGA_ADMIN_EMAILS?.split(",").map((value) => value.trim().toLowerCase()).includes(profile.email.toLowerCase())) profile.role = "admin";
    const response = NextResponse.json({ user: profile });
    response.cookies.set("gaga_access", data.session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: data.session.expires_in });
    response.cookies.set("gaga_refresh", data.session.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth", maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not refresh session" }, { status: 401 });
  }
}
