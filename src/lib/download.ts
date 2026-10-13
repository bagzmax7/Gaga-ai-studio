import toast from "react-hot-toast";

export async function downloadAsset(url: string, filename?: string) {
  if (!url) return false;
  const toastId = toast.loading("Preparing download…");
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("Download failed");
    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = filename || decodeURIComponent(url.split("/").pop()?.split("?")[0] || "gaga-asset"); anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_500);
    toast.success("Downloaded", { id: toastId }); return true;
  } catch (error) { console.error("Gaga download failed", error); toast.error("Could not download this asset", { id: toastId }); return false; }
}
