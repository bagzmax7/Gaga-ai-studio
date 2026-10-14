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

const url = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: users, error } = await supabase.from("gaga_users").select("id, email, full_name, role, is_active, created_at");
if (error) {
  console.error("Error querying users:", error);
} else {
  console.log("Current team users in DB:");
  console.table(users);
}
