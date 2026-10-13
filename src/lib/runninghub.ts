const API_KEY = () => process.env.RUNNINGHUB_API_KEY || "";
const STANDARD = (process.env.RUNNINGHUB_STANDARD_API_BASE_URL || "https://www.runninghub.ai/openapi/v2").replace(/\/$/, "");

export const IMAGE_MODELS = [
  { id: "gpt-2.5-sunburst", name: "GPT Image 2.5 Sunburst", provider: "OpenAI" },
  { id: "gpt-2.5-flare", name: "GPT Image 2.5 Flare", provider: "OpenAI" },
  { id: "gpt-2.0", name: "GPT Image 2.0", provider: "OpenAI" },
  { id: "nano-banana-2", name: "Nano Banana 2", provider: "Google" },
  { id: "nano-banana-2-lite", name: "Nano Banana 2 Lite", provider: "Google" },
  { id: "gpt-image-2-wrap", name: "GPT Image 2.0", provider: "OpenAI", endpoint: "rhart-image-g-2" },
  { id: "gpt-image-2-premium", name: "GPT Image 2.0 Premium", provider: "OpenAI", endpoint: "rhart-image-g-2-official" },
  { id: "grok-imagine", name: "Grok Imagine", provider: "xAI", endpoint: "rhart-image-x-official" },
  { id: "nano-banana-fast", name: "Nano Banana 2 Fast", provider: "Google", endpoint: "rhart-image-n-g31-flash" },
  { id: "nano-banana-thinking", name: "Nano Banana 2 Thinking", provider: "Google", endpoint: "rhart-image-n-g31-flash-official" },
  { id: "nano-banana-pro", name: "Nano Banana Pro", provider: "Google", endpoint: "rhart-image-n-pro" },
  { id: "flux-2-edit", name: "Flux 2 Edit", provider: "Black Forest Labs" },
  { id: "seedream-5-lite", name: "Seedream 5 Lite", provider: "ByteDance", endpoint: "seedream-v5-lite" },
  { id: "seedream-4", name: "Seedream 4.6", provider: "ByteDance", endpoint: "bytedance/jimeng-4.6" },
  { id: "midjourney", name: "Midjourney V8.1", provider: "Midjourney", endpoint: "youchuan" },
] as const;

const IMAGE_ENDPOINTS: Record<string, { t2i: string; i2i: string }> = {
  "gpt-2.5-sunburst": { t2i: "rhart-image-g-2.5/sunburst/text-to-image", i2i: "rhart-image-g-2.5/sunburst/image-to-image" },
  "gpt-2.5-flare": { t2i: "rhart-image-g-2.5/flare/text-to-image", i2i: "rhart-image-g-2.5/flare/image-to-image" },
  "gpt-2.0": { t2i: "rhart-image-g-2/text-to-image", i2i: "rhart-image-g-2/image-to-image" },
  "nano-banana-2": { t2i: "rhart-image-n-g31-flash/text-to-image", i2i: "rhart-image-n-g31-flash/image-to-image" },
  "nano-banana-2-lite": { t2i: "rhart-image-n-g31-flash-lite/text-to-image", i2i: "rhart-image-n-g31-flash-lite/image-to-image" },
  "gpt-image-2-wrap": { t2i: "rhart-image-g-2/text-to-image", i2i: "rhart-image-g-2/image-to-image" },
  "gpt-image-2-premium": { t2i: "rhart-image-g-2-official/text-to-image", i2i: "rhart-image-g-2-official/image-to-image" },
  "grok-imagine": { t2i: "rhart-image-x-official/text-to-image", i2i: "rhart-imagine-image-quality/edit" },
  "nano-banana-fast": { t2i: "rhart-image-n-g31-flash/text-to-image", i2i: "rhart-image-n-g31-flash/image-to-image" },
  "nano-banana-thinking": { t2i: "rhart-image-n-g31-flash-official/text-to-image", i2i: "rhart-image-n-g31-flash-official/image-to-image" },
  "nano-banana-pro": { t2i: "rhart-image-n-pro/text-to-image", i2i: "rhart-image-n-pro/edit" },
  "flux-2-edit": { t2i: "rhart-image/f-2-klein-9b/text-to-image", i2i: "rhart-image/f-2-klein-9b/edit" },
  "seedream-5-lite": { t2i: "seedream-v5-lite/text-to-image", i2i: "seedream-v5-lite/image-to-image" },
  "seedream-4": { t2i: "bytedance/jimeng-4.6/text-to-image", i2i: "bytedance/jimeng-4.6/image-to-image" },
  "midjourney": { t2i: "youchuan/text-to-image-v81", i2i: "youchuan/text-to-image-v81" },
};

export const VIDEO_MODELS = [
  { id: "seedance-2.0-mini", name: "Seedance 2.0 Mini", duration: "4–15s", resolutions: ["480p", "720p"], minDuration: 4, maxDuration: 15 },
  { id: "seedance-2.0-official", name: "Seedance 2.0", duration: "4–15s", resolutions: ["480p", "720p"], minDuration: 4, maxDuration: 15 },
  { id: "gemini-omni-flash", name: "Gemini Omni Flash", duration: "3–10s", resolutions: ["360p", "720p"], minDuration: 3, maxDuration: 10 },
  { id: "veo-3.1-fast", name: "Veo 3.1 Fast", duration: "8s", resolutions: ["720p"], minDuration: 8, maxDuration: 8 },
  { id: "minimax-h3", name: "MiniMax H3", duration: "5–15s", resolutions: ["768P"], minDuration: 5, maxDuration: 15 },
  { id: "ltx-2.3", name: "LTX 2.3", duration: "5–15s", resolutions: ["480p", "720p"], minDuration: 5, maxDuration: 15 },
] as const;

const VIDEO_MODEL_PATHS: Record<string, { text: string; image: string; multimodal?: string; videoEdit?: string; startEnd?: string }> = {
  "seedance-2.0-mini": { text: "rhart-video/sparkvideo-2.0-mini/text-to-video", image: "rhart-video/sparkvideo-2.0-mini/image-to-video", multimodal: "rhart-video/sparkvideo-2.0-mini/multimodal-video" },
  "seedance-2.0-official": { text: "rhart-video/sparkvideo-2.0/text-to-video", image: "rhart-video/sparkvideo-2.0/image-to-video", multimodal: "rhart-video/sparkvideo-2.0/multimodal-video" },
  "gemini-omni-flash": { text: "google/gemini-omni-1.1-flash/text-to-video", image: "google/gemini-omni-1.1-flash/image-to-video", multimodal: "google/gemini-omni-1.1-flash/reference-to-video", videoEdit: "google/gemini-omni-1.1-flash/video-edit" },
  "veo-3.1-fast": { text: "rhart-video-v3.1-fast/text-to-video", image: "rhart-video-v3.1-fast/image-to-video", startEnd: "rhart-video-v3.1-fast/start-end-to-video" },
  "minimax-h3": { text: "minimax/hailuo-h3/text-to-video", image: "minimax/hailuo-h3/image-to-video", multimodal: "minimax/hailuo-h3/multimodal-to-video" },
  "ltx-2.3": { text: "rhart-video/ltx-2.3/text-to-video", image: "rhart-video/ltx-2.3/image-to-video" },
};

function apiKey() {
  const key = API_KEY();
  if (!key) throw new Error("RunningHub is not configured on this instance.");
  return key;
}

export async function createImageTask(input: { model: string; prompt: string; aspectRatio: string; resolution: string; imageUrl?: string; imageUrls?: string[] }) {
  const model = IMAGE_MODELS.find((item) => item.id === input.model);
  if (!model) throw new Error("Unsupported image model.");
  const endpoints = IMAGE_ENDPOINTS[input.model];
  const referenceImages = [...(input.imageUrls || []), ...(input.imageUrl ? [input.imageUrl] : [])]
    .filter((url, index, list) => typeof url === "string" && /^https?:\/\//i.test(url) && list.indexOf(url) === index)
    .slice(0, 10);
  const endpoint = referenceImages.length > 0 ? endpoints.i2i : endpoints.t2i;
  let payload: Record<string, unknown>;
  if (input.model === "seedream-4" || input.model === "seedream-5-lite" || input.model === "flux-2-edit") {
    const dimensions = aspectDimensions(input.aspectRatio, input.resolution);
    payload = input.model === "flux-2-edit"
      ? { prompt: input.prompt, ...dimensions, ...(referenceImages[0] ? { imageUrl: referenceImages[0] } : {}) }
      : { prompt: input.prompt, ...dimensions, ...(referenceImages.length ? { imageUrls: referenceImages } : {}) };
  } else if (input.model === "midjourney") {
    payload = { prompt: input.prompt, aspectRatio: input.aspectRatio };
  } else {
    const ratio = ["gpt-2.5-sunburst", "gpt-2.5-flare"].includes(input.model) ? input.aspectRatio : input.aspectRatio;
    payload = { prompt: input.prompt, aspectRatio: ratio, resolution: input.resolution, ...(input.model === "gpt-image-2-premium" ? { quality: "low" } : {}), ...(referenceImages.length ? { imageUrls: referenceImages } : {}) };
  }
  const response = await fetch(`${STANDARD}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` }, body: JSON.stringify(payload), cache: "no-store" });
  const json = await response.json();
  if (!response.ok || json.errorCode || json.errorMessage) throw new Error(json.errorMessage || `Image task request failed (${response.status}).`);
  const taskId = json.taskId || json.task_id;
  if (!taskId) throw new Error("Image provider did not return a task ID.");
  return String(taskId);
}

function aspectDimensions(ratio: string, resolution: string) {
  const ratios: Record<string, [number, number]> = { "1:1": [1, 1], "16:9": [16, 9], "9:16": [9, 16], "4:3": [4, 3], "3:4": [3, 4], "3:2": [3, 2], "2:3": [2, 3] };
  const [x, y] = ratios[ratio] || [1, 1];
  const longSide = resolution === "4K" ? 2880 : 2048;
  return { width: Math.round(longSide * x / Math.max(x, y)), height: Math.round(longSide * y / Math.max(x, y)) };
}

export async function createVideoTask(input: { model: string; prompt: string; duration: string; aspectRatio: string; resolution: string; imageUrl?: string; imageUrls?: string[]; videoUrls?: string[]; audioUrls?: string[]; generateAudio?: boolean; realPersonMode?: boolean }) {
  const model = VIDEO_MODELS.find((item) => item.id === input.model);
  if (!model) throw new Error("Unsupported video model.");
  const images = [...(input.imageUrls || []), ...(input.imageUrl ? [input.imageUrl] : [])].filter((url) => /^https?:\/\//i.test(url) && !url.startsWith("blob:")).slice(0, 10);
  const videos = (input.videoUrls || []).filter((url) => /^https?:\/\//i.test(url)).slice(0, 3);
  const audios = (input.audioUrls || []).filter((url) => /^https?:\/\//i.test(url)).slice(0, 3);
  const paths = VIDEO_MODEL_PATHS[input.model];
  const multimodal = (images.length > 1 && input.model !== "veo-3.1-fast") || videos.length > 0 || audios.length > 0;
  let modelPath = paths.text;
  if (input.model === "gemini-omni-flash" && videos.length) modelPath = paths.videoEdit!;
  else if (input.model === "veo-3.1-fast" && images.length > 1) modelPath = paths.startEnd!;
  else if (multimodal && paths.multimodal) modelPath = paths.multimodal;
  else if (images.length) modelPath = paths.image;
  const duration = clamp(parseInt(input.duration.replace(/\D/g, ""), 10) || 8, model.minDuration, model.maxDuration);
  const resolution = (model.resolutions as readonly string[]).includes(input.resolution) ? input.resolution : model.resolutions[0];
  const ratio = input.aspectRatio === "Auto" ? "16:9" : input.aspectRatio;
  let payload: Record<string, unknown>;
  if (input.model.startsWith("seedance-2.0")) {
    const common = { prompt: input.prompt, resolution, duration: String(duration), ratio, generateAudio: input.generateAudio ?? true, realPersonMode: input.realPersonMode ?? false, conversionSlots: input.realPersonMode ? ["all"] : undefined, returnLastFrame: false, seed: -1 };
    payload = multimodal ? { ...common, imageUrls: images, videoUrls: videos, audioUrls: audios } : images.length ? { ...common, firstFrameUrl: images[0], lastFrameUrl: images[1] } : { ...common, webSearch: false };
  } else if (input.model === "gemini-omni-flash") {
    const geminiDuration = [4, 6, 8, 10].reduce((best, n) => Math.abs(n - duration) < Math.abs(best - duration) ? n : best, 4);
    const geminiResolution = ["360p", "720p", "1080p", "4k"].includes(resolution.toLowerCase()) ? resolution.toLowerCase() : "720p";
    payload = videos.length ? { videoUrl: videos[0], prompt: input.prompt, resolution: geminiResolution } : multimodal ? { prompt: input.prompt, imageUrls: images, videoUrls: videos, duration: geminiDuration, aspectRatio: ratio === "9:16" ? ratio : "16:9", resolution: geminiResolution } : images.length ? { imageUrl: images[0], lastImageUrl: images[1], prompt: input.prompt, duration: geminiDuration, aspectRatio: ratio === "9:16" ? ratio : "16:9", resolution: geminiResolution } : { prompt: input.prompt, duration: geminiDuration, aspectRatio: ratio === "9:16" ? ratio : "16:9", resolution: geminiResolution };
  } else if (input.model === "veo-3.1-fast") {
    payload = images.length > 1 ? { prompt: input.prompt, firstFrameUrl: images[0], lastFrameUrl: images[1], resolution, duration: String(duration), aspectRatio: ratio } : images.length ? { prompt: input.prompt, image: images[0], resolution, duration: String(duration), aspectRatio: ratio } : { prompt: input.prompt, resolution, duration: String(duration), aspectRatio: ratio };
  } else if (input.model === "minimax-h3") {
    const minimaxResolution = resolution.toUpperCase() === "2K" || resolution.toUpperCase() === "4K" ? "2K" : "768P";
    payload = multimodal ? { prompt: input.prompt, imageUrls: images, videoUrls: videos, audioUrls: audios, resolution: minimaxResolution, duration: String(clamp(duration, 5, 15)), ratio } : images.length ? { prompt: input.prompt, firstFrameUrl: images[0], lastFrameUrl: images[1], resolution: minimaxResolution, duration: String(clamp(duration, 5, 15)), ratio } : { prompt: input.prompt, resolution: minimaxResolution, duration: String(clamp(duration, 5, 15)), ratio };
  } else {
    payload = { prompt: input.prompt, ...(images.length ? { imageUrl: images[0] } : {}), resolution, aspectRatio: ratio, duration };
  }
  const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0)));
  const response = await fetch(`${STANDARD}/${modelPath}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` }, body: JSON.stringify(cleanPayload), cache: "no-store", signal: AbortSignal.timeout(30_000) });
  const json = await response.json();
  if (!response.ok || json.errorCode || json.errorMessage || (json.code !== undefined && json.code !== 0)) throw new Error(json.errorMessage || json.msg || "Could not queue video generation.");
  const taskId = json.taskId || json.data?.taskId || json.data?.task_id;
  if (!taskId) throw new Error("Video API did not return a task ID.");
  return String(taskId);
}

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }

export async function pollTask(taskId: string, mode: "image" | "video") {
  if (mode === "image") {
    const response = await fetch(`${STANDARD}/query`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` }, body: JSON.stringify({ taskId }), cache: "no-store" });
    const json = await response.json();
    return { status: String(json.status || "RUNNING").toUpperCase(), outputs: (json.results || []).filter((result: { url?: string }) => result.url).map((result: { url: string; outputType?: string }) => ({ fileUrl: result.url, fileType: result.outputType || "image/png" })), error: json.errorMessage || null };
  }
  const response = await fetch(`${STANDARD}/query`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` }, body: JSON.stringify({ taskId }), cache: "no-store" });
  const json = await response.json();
  return { status: String(json.status || "RUNNING").toUpperCase(), outputs: (json.results || []).filter((result: { url?: string }) => result.url).map((result: { url: string; outputType?: string }) => ({ fileUrl: result.url, fileType: result.outputType || "video/mp4" })), error: json.errorMessage || null };
}
