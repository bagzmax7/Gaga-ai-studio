"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, FolderKanban, Plus } from "lucide-react";
import GagaAuthGate from "@/components/gaga-auth-gate";
import GagaSidebar from "@/components/gaga-sidebar";

type Project = { id: string; name: string; description?: string; itemCount: number; thumbnailUrl?: string; createdAt: string };
export default function ProjectsPage() { return <GagaAuthGate>{() => <ProjectsList/>}</GagaAuthGate>; }
function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => { const r = await fetch("/api/projects", { cache: "no-store" }); if (r.ok) setProjects((await r.json()).projects || []); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function create(event: React.FormEvent) { event.preventDefault(); setError(""); const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); const data = await response.json(); if (!response.ok) { setError(data.error || "Could not create project"); return; } setName(""); await load(); }
  return <div className="gaga-app-shell"><GagaSidebar/><main className="gaga-overview-main"><header className="gaga-topbar"><div><span className="gaga-breadcrumb">WORKSPACE <span>/</span> PROJECTS</span><h1>Projects</h1></div><Link href="/creative-flow" className="gaga-primary-button top-action"><Plus size={15}/> Open Creative Flow</Link></header><section className="gaga-welcome-row"><div><p className="eyebrow">ORGANIZE YOUR WORK</p><h2>Campaign projects</h2><p>Each project keeps prompts, references, and generated assets together.</p></div></section><form onSubmit={create} className="gaga-project-create"><FolderKanban size={17}/><input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Name a new project"/><button className="gaga-primary-button"><Plus size={14}/> Create project</button>{error && <span role="alert">{error}</span>}</form><div className="gaga-project-grid">{projects.map((project) => <Link key={project.id} href={`/creative-flow?projectId=${encodeURIComponent(project.id)}`} className="gaga-project-card"><div className="gaga-project-thumb">{project.thumbnailUrl ? <Image src={project.thumbnailUrl} alt="" fill unoptimized sizes="(max-width: 760px) 50vw, 25vw"/> : <FolderKanban size={22}/>}</div><div><b>{project.name}</b><small>{project.itemCount} assets · Created {new Date(project.createdAt).toLocaleDateString()}</small>{project.description && <p>{project.description}</p>}</div><ArrowRight size={15}/></Link>)}{projects.length === 0 && <div className="gaga-recent-empty"><p>No projects yet.</p><Link href="/creative-flow">Start a Flow project <ArrowRight size={14}/></Link></div>}</div></main></div>;
}
