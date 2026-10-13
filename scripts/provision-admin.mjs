import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.GAGA_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.GAGA_BOOTSTRAP_ADMIN_PASSWORD;
const fullName = process.env.GAGA_BOOTSTRAP_ADMIN_NAME?.trim() || "Gaga Administrator";

if (!url || !serviceKey || !email || !password) {
  console.error("Missing Supabase URL, service role key, or Gaga bootstrap admin credentials.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: existing, error: lookupError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (lookupError) throw lookupError;
let authUser = existing.users.find((user) => user.email?.toLowerCase() === email);

if (authUser) {
  const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, { password, email_confirm: true, user_metadata: { ...authUser.user_metadata, full_name: fullName } });
  if (error) throw error;
  authUser = data.user;
} else {
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) throw error || new Error("Supabase did not return the created user.");
  authUser = data.user;
}

const { error: profileError } = await supabase.from("gaga_users").upsert({ id: authUser.id, email, full_name: fullName, role: "admin", is_active: true, updated_at: new Date().toISOString() }, { onConflict: "id" });
if (profileError) throw profileError;
console.log(`Gaga administrator provisioned: ${email}`);
