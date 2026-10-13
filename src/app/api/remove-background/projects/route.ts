import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  getUserRemoveBgProjects,
  saveRemoveBgProject,
  deleteRemoveBgProject,
} from '@/lib/remove-bg/projects';
import { RemoveBgProject } from '@/lib/remove-bg/types';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projects = await getUserRemoveBgProjects(user.id);
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, description } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const newProject: RemoveBgProject = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: user.id,
      name: name.trim(),
      description: description?.trim() || '',
      defaultModel: 'matting-standard',
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveRemoveBgProject(newProject);
    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  await deleteRemoveBgProject(projectId, user.id);
  return NextResponse.json({ success: true });
}
