import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gaga AI Studio",
  description: "Internal creative AI workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<Toaster position="top-right" toastOptions={{ style: { background: "#171715", color: "#f4f1eb", border: "1px solid rgba(255,255,255,.11)", fontSize: "12px" }, success: { iconTheme: { primary: "#d9b66f", secondary: "#111" } } }}/></body></html>;
}
