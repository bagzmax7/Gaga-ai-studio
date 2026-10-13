import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface GagaUser {
  id: string;
  email: string;
  role: "admin" | "member";
  full_name: string | null;
  is_active: boolean;
}

export async function getAuthenticatedUser(request: NextRequest): Promise<GagaUser | null> {
  const token = request.cookies.get("gaga_access")?.value || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabase.from("gaga_users").select("id,email,role,full_name,is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active) return null;
  const bootstrapAdmins = (process.env.GAGA_ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase());
  if (bootstrapAdmins.includes(profile.email.toLowerCase())) profile.role = "admin";
  return profile as GagaUser;
}

export function isAdmin(user: GagaUser) {
  const adminEmails = (process.env.GAGA_ADMIN_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return user.role === "admin" || adminEmails.includes(user.email.toLowerCase());
}
