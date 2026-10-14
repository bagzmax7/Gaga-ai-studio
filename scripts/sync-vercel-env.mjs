import { execSync } from "child_process";
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

const variables = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", value: envVars.NEXT_PUBLIC_SUPABASE_URL, sensitive: false },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY, sensitive: false },
  { name: "SUPABASE_SERVICE_ROLE_KEY", value: envVars.SUPABASE_SERVICE_ROLE_KEY, sensitive: true },
  { name: "RUNNINGHUB_API_KEY", value: envVars.RUNNINGHUB_API_KEY, sensitive: true },
  { name: "RUNNINGHUB_BASE_URL", value: envVars.RUNNINGHUB_BASE_URL || "https://www.runninghub.ai", sensitive: false },
  { name: "RUNNINGHUB_STANDARD_API_BASE_URL", value: envVars.RUNNINGHUB_STANDARD_API_BASE_URL || "https://www.runninghub.ai/openapi/v2", sensitive: false },
  { name: "NEXT_PUBLIC_APP_URL", value: "https://gagaaistudio.vercel.app", sensitive: false },
  { name: "APP_SECRET", value: envVars.APP_SECRET || "gaga_sec_4f98a2e1d73c89b04f128e0192ca78df", sensitive: true },
  { name: "GAGA_ADMIN_EMAILS", value: envVars.GAGA_ADMIN_EMAILS || "bagzmax21@gmail.com", sensitive: true },
];

console.log("Setting environment variables on Vercel for production & preview...");

for (const { name, value, sensitive } of variables) {
  if (!value) {
    console.warn(`Skipping ${name}: no value found.`);
    continue;
  }

  for (const envTarget of ["production", "preview"]) {
    try {
      const sensFlag = sensitive ? "--sensitive" : "--no-sensitive";
      const cmd = `npx vercel env add ${name} ${envTarget} --value "${value}" ${sensFlag} --force --yes`;
      console.log(`Setting ${name} [${envTarget}]...`);
      execSync(cmd, {
        stdio: "pipe",
        env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" },
      });
      console.log(`✓ ${name} [${envTarget}] configured successfully.`);
    } catch (err) {
      console.error(`Failed to set ${name} for ${envTarget}:`, err.message || err);
    }
  }
}

console.log("\nAll Vercel environment variables synced!");
