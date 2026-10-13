import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!/^(image|video|audio)\//.test(file.type) || file.size > 100 * 1024 * 1024) return NextResponse.json({ error: "Upload an image, video, or audio file up to 100 MB." }, { status: 400 });
    const body = new FormData();
    body.append("file", file, file.name);
    const base = (process.env.RUNNINGHUB_BASE_URL || "https://www.runninghub.ai").replace(/\/$/, "");
    const response = await fetch(`${base}/openapi/v2/media/upload/binary`, { method: "POST", headers: { Authorization: `Bearer ${process.env.RUNNINGHUB_API_KEY || ""}` }, body, cache: "no-store", signal: AbortSignal.timeout(55_000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.code !== 0 || !data.data?.download_url) return NextResponse.json({ error: data.msg || "Media upload failed." }, { status: 502 });
    return NextResponse.json({ success: true, fileUrl: data.data.download_url, fileName: data.data.fileName || file.name });
  } catch (error) {
    console.error("Gaga Flow media upload failed", error);
    return NextResponse.json({ error: "Media upload failed." }, { status: 502 });
  }
}
