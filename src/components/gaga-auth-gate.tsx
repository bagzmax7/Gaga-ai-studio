"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { LoaderCircle, ShieldCheck } from "lucide-react";

type User = { id: string; email: string; full_name: string; role: string };

export default function GagaAuthGate({
  children,
}: {
  children: React.ReactNode | ((user: User) => React.ReactNode);
}) {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let alive = true; void fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((data) => { if (alive) { setUser(data?.user || null); setChecked(true); } }).catch(() => { if (alive) setChecked(true); }); return () => { alive = false; }; }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setBusy(true); try { const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Sign in failed"); setUser(data.user); } catch (e) { setError(e instanceof Error ? e.message : "Sign in failed"); } finally { setBusy(false); } }
  if (!checked) return <div className="gaga-auth-loading"><LoaderCircle className="animate-spin" size={20}/></div>;
  if (user) return typeof children === "function" ? children(user) : children;
  return <main className="gaga-login-page"><div className="gaga-login-orbit orbit-one"/><div className="gaga-login-orbit orbit-two"/><section className="gaga-login-panel"><div className="gaga-login-art"><div className="gaga-login-logo"><Image src="/brand/gerobok-gaga-logo.png" alt="Gerobok Gaga" width={260} height={260} priority className="gaga-login-logo-image"/></div><div><p className="eyebrow">INTERNAL CREATIVE WORKSPACE</p><h1>Ideas become<br/><em>something real.</em></h1><p className="gaga-login-subtitle">One workspace for your team’s image and film creation.</p></div><p className="gaga-secure-line"><ShieldCheck size={14}/> Private company access</p></div><form className="gaga-login-form" onSubmit={submit}><p className="eyebrow">WELCOME BACK</p><h2>Sign in to Gaga</h2><p className="muted-copy">Use your personal account provided by your administrator.</p><label>Work email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="you@company.com" required/></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Your password" required/></label>{error && <p className="gaga-login-error" role="alert">{error}</p>}<button disabled={busy} className="gaga-primary-button">{busy ? <LoaderCircle size={16} className="animate-spin"/> : "Enter workspace"}</button></form></section></main>;
}
