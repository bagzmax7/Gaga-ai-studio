import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.session) return NextResponse.json({ error: "Email atau password tidak cocok." }, { status: 401 });
    const { data: profile } = await supabase.from("gaga_users").select("id,email,full_name,role,is_active").eq("id", data.user.id).maybeSingle();
    if (!profile || !profile.is_active) {
      return NextResponse.json({ error: "Akun belum diaktifkan. Hubungi administrator." }, { status: 403 });
    }
    if (process.env.GAGA_ADMIN_EMAILS?.split(",").map((value) => value.trim().toLowerCase()).includes(profile.email.toLowerCase())) profile.role = "admin";
    const response = NextResponse.json({ user: profile });
    response.cookies.set("gaga_access", data.session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: data.session.expires_in });
    response.cookies.set("gaga_refresh", data.session.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth", maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (error) {
    console.error("Gaga sign-in failed", error);
    return NextResponse.json({ error: "Login gagal. Periksa konfigurasi Supabase." }, { status: 500 });
  }
}
