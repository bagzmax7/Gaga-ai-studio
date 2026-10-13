<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Gaga AI Studio — Project Guidelines, Memory & Best Practices

Dokumen ini merupakan pedoman arsitektur dan memori operasional proyek Gaga AI Studio (`Gerobok Gaga`), yang diselaraskan dengan standar dari `boutiqaat-gen-app` dan `metaverz-studio-app`.

---

## 1. Identitas Git & GitHub
- **Akun GitHub Resmi**: `bagzmax7` (`bagzmax21@gmail.com`)
- **Default Branch**: `main`
- **Pola Remote Origin**: `https://github.com/bagzmax7/<repo-name>.git` (misal: `https://github.com/bagzmax7/gerobok-gaga.git`)
- **Git Credential**: Menggunakan Windows Credential Manager (`credential.helper=manager`).
- **Aturan Commit & Push**:
  - Jangan pernah men-commit file konfigurasi rahasia (`.env.local`, `.env`, file log `*.log`, atau file kredensial).
  - Selalu pastikan branch utama adalah `main` (`git branch -M main`).
  - Verifikasi build lokal (`npm run build`) dengan Exit Code 0 sebelum melakukan push ke GitHub.

---

## 2. Vercel Deployment & Environment Standards
- **Framework & Runtime**: Next.js App Router (Node.js 20+).
- **Konfigurasi `vercel.json`**:
  ```json
  {
    "version": 2,
    "framework": "nextjs",
    "buildCommand": "npm run build",
    "installCommand": "npm install",
    "regions": ["sin1"]
  }
  ```
  *(Region `sin1` / Singapura dipilih untuk latensi terendah bagi pengguna di Asia Tenggara/Indonesia)*.
- **Workflow Deployment**:
  1. Hubungkan repository GitHub ke Vercel Dashboard via fitur **Import Git Repository**.
  2. Vercel akan otomatis mendeteksi Next.js dan men-trigger build preview/production di setiap commit ke `main`.
- **Environment Variables yang Wajib di Vercel (Production & Preview)**:
  - `NEXT_PUBLIC_SUPABASE_URL`: URL project Supabase.
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Anon/publishable key untuk client-side SSR.
  - `SUPABASE_SERVICE_ROLE_KEY`: Service role key untuk server-side admin client (**Sensitif, Server Only, Tanpa NEXT_PUBLIC_**).
  - `RUNNINGHUB_API_KEY`: API key RunningHub.
  - `RUNNINGHUB_BASE_URL`: `https://www.runninghub.ai`
  - `RUNNINGHUB_STANDARD_API_BASE_URL`: `https://www.runninghub.ai/openapi/v2`
  - `NEXT_PUBLIC_APP_URL`: Domain resmi di Vercel (contoh: `https://gerobok-gaga.vercel.app`).
  - `APP_SECRET`: Random 32+ character string rahasia unik untuk Gaga.
  - `GAGA_ADMIN_EMAILS`: Email admin utama (contoh: `bagzmax21@gmail.com`).
- **Variabel yang DILARANG di Vercel**:
  - `GAGA_BOOTSTRAP_ADMIN_*`: Hanya untuk eksekusi lokal sekali pakai (`npm run admin:provision`). Hapus dari `.env.local` setelah digunakan.
  - Jangan pernah menyertakan kredensial Stripe, Midtrans, atau konfigurasi wallet Metaverz ke dalam Gaga Studio.

---

## 3. Arsitektur & Best Practices Supabase
- **Isolasi Namespace Tabel (`gaga_*`)**:
  - Gaga menggunakan Supabase instance bersama namun dengan namespace tabel khusus: `gaga_users`, `gaga_projects`, `gaga_tasks`.
  - Jangan menyentuh atau membuat relasi foreign key ke tabel eksternal Metaverz (`users`, `organizations`, `wallets`, dll.).
- **Row Level Security (RLS)**:
  - Seluruh tabel `gaga_*` wajib mengaktifkan RLS (`alter table ... enable row level security;`).
  - Strict ownership policy: Pengguna hanya boleh membaca/mengubah data milik `auth.uid()` mereka sendiri.
- **Client Separation**:
  - **Client-Side**: Menggunakan `@supabase/ssr` dengan session/cookie token untuk request browser.
  - **Server-Side Admin**: Menggunakan `createAdminClient()` dengan `SUPABASE_SERVICE_ROLE_KEY` dan opsi `{ auth: { autoRefreshToken: false, persistSession: false } }` untuk eksekusi backend/route handlers terpercaya.
- **Migrasi**:
  - Script migrasi tersimpan di `supabase/migrations/001_gaga_studio.sql`. Eksekusi via Supabase SQL Editor atau script runner.

---

## 4. RunningHub & AI Task Pipeline Best Practices
- **Dual Endpoint & Model Alignment**:
  - Standard Image & Video models menggunakan endpoint `/openapi/v2/...` dan status query via `POST /openapi/v2/query` dengan `{ taskId }`.
  - Model BytePlus dikecualikan secara sengaja untuk efisiensi dan stabilitas.
- **Task Ownership Safety**:
  - Endpoint generasi (`/api/tasks`) wajib memvalidasi sesi autentikasi pengguna sebelum memicu task RunningHub. Kepemilikan task (`user_id`) wajib tercatat di `gaga_tasks`.
- **Ephemeral CDN URL Handling**:
  - URL output dari RunningHub memiliki masa aktif terbatas (~24 jam). Untuk aset penting, sediakan opsi unduh langsung ke lokal atau sinkronisasi ke storage persisten.
- **Prompt Mentions & Formulasi**:
  - Parsing tag mention (seperti `@Image 1`, `@Image 2`) menggunakan regex case-insensitive yang akurat agar URL aset yang dirujuk terbaca dengan benar oleh pipeline AI.
- **Token / Credit Safety**:
  - Hindari pemicuan request generasi POST berbayar saat pengujian otomatis atau debugging.

---

## 5. Standar UI/UX & Kestabilan Komponen
- **Grid Layout untuk Galeri**:
  - Gunakan CSS Grid (`grid grid-cols-*`) alih-alih CSS masonry `columns-*` agar urutan kronologis kartu mengalir secara horizontal dan konsisten.
- **Silent Background Sync**:
  - Polling status task yang sedang berjalan (`QUEUED` / `RUNNING`) dilakukan secara background tanpa memicu re-render seluruh halaman atau blocking spinner penuh.
- **Video Playback Performance**:
  - Hindari `autoPlay` massal pada semua kartu video galeri. Gunakan `preload="metadata"` dan fitur hover-to-play untuk menjaga pemakaian GPU/CPU tetap ringan.
