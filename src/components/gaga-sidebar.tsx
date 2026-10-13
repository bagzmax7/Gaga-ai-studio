"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { FolderKanban, LayoutDashboard, LogOut, Shield, WandSparkles, Layers, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type GagaUser = { full_name?: string; email: string; role: string };

export default function GagaSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<GagaUser | null>(null);
  useEffect(() => { void fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((data) => setUser(data?.user || null)).catch(() => {}); }, []);
  async function signOut() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }
  const nav = [
    { href: "/", name: "Studio Overview", icon: LayoutDashboard },
    { href: "/creative-flow", name: "Creative Flow", icon: WandSparkles },
    { href: "/remove-bg", name: "Remove Background", icon: Layers },
    { href: "/retouch", name: "Auto Retouch", icon: Sparkles },
    { href: "/projects", name: "Projects", icon: FolderKanban },
  ];
  return <aside className="gaga-sidebar">
    <Link href="/" className="gaga-brand"><span className="gaga-brand-mark"><Image src="/brand/gerobok-gaga-mark.png" alt="Gerobok Gaga" width={34} height={34} priority/></span><span><b>GAGA</b><small>AI STUDIO</small></span></Link>
    <p className="gaga-nav-caption">Workspace</p>
    <nav className="gaga-nav">{nav.map(({ href, name, icon: Icon }) => { const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} className={`gaga-nav-link ${active ? "active" : ""}`}><Icon size={16}/><span>{name}</span></Link>; })}</nav>
    {user?.role === "admin" && <div className="gaga-sidebar-admin"><Link href="/" className="gaga-nav-link"><Shield size={16}/><span>Team administration</span></Link></div>}
    <div className="gaga-sidebar-bottom"><div className="gaga-user-chip"><span className="gaga-user-avatar">{(user?.full_name || user?.email || "G").slice(0, 1).toUpperCase()}</span><span className="gaga-user-copy"><b>{user?.full_name || user?.email || "Gaga user"}</b><small>{user?.role || "Member"}</small></span><button onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={15}/></button></div><div className="gaga-private-note"><span/> Private company workspace</div></div>
  </aside>;
}
