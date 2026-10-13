import fs from 'fs';
import path from 'path';
import { createAdminClient } from '@/lib/supabase/admin';
import { RetouchProject } from './types';

const STORE_DIR = path.join(process.cwd(), 'database', 'store');
const RETOUCH_FILE = path.join(STORE_DIR, 'retouch_projects.json');

function ensureStoreDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function readLocalStore(): Record<string, RetouchProject[]> {
  try {
    ensureStoreDir();
    if (!fs.existsSync(RETOUCH_FILE)) return {};
    const content = fs.readFileSync(RETOUCH_FILE, 'utf-8');
    return JSON.parse(content || '{}');
  } catch {
    return {};
  }
}

function writeLocalStore(data: Record<string, RetouchProject[]>) {
  try {
    ensureStoreDir();
    fs.writeFileSync(RETOUCH_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[writeLocalStore error]', err);
  }
}

export async function getUserRetouchProjects(userId: string): Promise<RetouchProject[]> {
  const projectMap = new Map<string, RetouchProject>();

  // 1. Check Supabase gaga_projects
  try {
    const supabase = createAdminClient();
    const { data: dbProjects } = await supabase
      .from('gaga_projects')
      .select('id, name, description, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (dbProjects) {
      dbProjects.forEach((p) => {
        projectMap.set(p.id, {
          id: p.id,
          userId,
          name: p.name,
          description: p.description,
          defaultModel: 'flux-2-edit',
          items: [],
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        });
      });
    }
  } catch (err) {
    console.warn('[Supabase getUserRetouchProjects]', err);
  }

  // 2. Merge with local store (which contains rich item version history)
  const store = readLocalStore();
  const localList = store[userId] || [];
  localList.forEach((p) => {
    const existing = projectMap.get(p.id);
    if (existing) {
      projectMap.set(p.id, {
        ...existing,
        ...p,
        items: p.items || [],
      });
    } else {
      projectMap.set(p.id, p);
    }
  });

  return Array.from(projectMap.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getRetouchProjectById(projectId: string, userId: string): Promise<RetouchProject | null> {
  const projects = await getUserRetouchProjects(userId);
  return projects.find((p) => p.id === projectId) || null;
}

export async function saveRetouchProject(project: RetouchProject): Promise<void> {
  // 1. Sync to Supabase
  try {
    const supabase = createAdminClient();
    await supabase.from('gaga_projects').upsert(
      {
        id: project.id,
        user_id: project.userId,
        name: project.name,
        description: project.description || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } catch (err) {
    console.warn('[Supabase saveRetouchProject]', err);
  }

  // 2. Persist full items & versions to store
  const store = readLocalStore();
  const userList = store[project.userId] || [];
  const idx = userList.findIndex((p) => p.id === project.id);
  const updated = {
    ...project,
    updatedAt: new Date().toISOString(),
  };

  if (idx >= 0) {
    userList[idx] = updated;
  } else {
    userList.unshift(updated);
  }
  store[project.userId] = userList;
  writeLocalStore(store);
}

export async function deleteRetouchProject(projectId: string, userId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    await supabase.from('gaga_projects').delete().eq('id', projectId).eq('user_id', userId);
  } catch {}

  const store = readLocalStore();
  if (store[userId]) {
    store[userId] = store[userId].filter((p) => p.id !== projectId);
    writeLocalStore(store);
  }
  return true;
}
