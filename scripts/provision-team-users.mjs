import { createClient } from "@supabase/supabase-js";
import fs from "fs";

let env = "";
try {
  env = fs.readFileSync(".env.local", "utf8");
} catch {}

const envVars = {};
env.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    if (key && !key.startsWith("#")) envVars[key] = val;
  }
});

const url = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing Supabase URL or service role key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const usersToProvision = [
  { username: "Mira", email: "ggmiera17@gmail.com", password: "123456", role: "member" },
  { username: "Wana", email: "wananagg1@gmail.com", password: "123456", role: "member" },
  { username: "Naz", email: "naziggra@gmail.com", password: "123456", role: "member" },
];

console.log("Fetching existing Supabase Auth users...");
const { data: existing, error: lookupError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (lookupError) {
  console.error("Failed to list users:", lookupError);
  process.exit(1);
}

for (const u of usersToProvision) {
  const email = u.email.toLowerCase().trim();
  const fullName = u.username.trim();
  const password = u.password;
  const role = u.role;

  let authUser = existing.users.find((user) => user.email?.toLowerCase() === email);

  if (authUser) {
    console.log(`Updating existing auth user: ${email} (${fullName})`);
    const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { ...authUser.user_metadata, full_name: fullName },
    });
    if (error) {
      console.error(`Error updating ${email}:`, error);
      continue;
    }
    authUser = data.user;
  } else {
    console.log(`Creating new auth user: ${email} (${fullName})`);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) {
      console.error(`Error creating ${email}:`, error);
      continue;
    }
    authUser = data.user;
  }

  // Upsert profile in public.gaga_users
  const { error: profileError } = await supabase.from("gaga_users").upsert(
    {
      id: authUser.id,
      email,
      full_name: fullName,
      role,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error(`Error upserting gaga_users profile for ${email}:`, profileError);
  } else {
    console.log(`✓ User ${fullName} <${email}> successfully connected & provisioned in gaga_users.`);
  }
}

console.log("\nAll users processed.");
