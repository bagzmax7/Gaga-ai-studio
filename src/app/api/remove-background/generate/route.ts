import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { runAiApp } from '@/lib/runninghub';
import { getRemoveBgProjectById, saveRemoveBgProject } from '@/lib/remove-bg/projects';
import { RemoveBgVersion } from '@/lib/remove-bg/types';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      projectId,
      itemId,
      itemName,
      originalUrl,
      width,
      height,
    }: {
      projectId: string;
      itemId: string;
      itemName?: string;
      originalUrl: string;
      width?: number;
      height?: number;
    } = body;

    if (!projectId || !itemId || !originalUrl) {
      return NextResponse.json({ error: 'projectId, itemId, and originalUrl are required' }, { status: 400 });
    }

    // 1. Fetch project
    const project = await getRemoveBgProjectById(projectId, user.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Find or create item in project
    let item = project.items.find((it) => it.id === itemId);
    const imgWidth = width || item?.originalWidth || 1024;
    const imgHeight = height || item?.originalHeight || 1024;

    if (!item) {
      item = {
        id: itemId,
        name: itemName || `Product ${project.items.length + 1}`,
        originalUrl,
        originalWidth: imgWidth,
        originalHeight: imgHeight,
        versions: [],
        activeVersionIndex: 0,
        status: 'processing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      project.items.push(item);
    } else {
      item.status = 'processing';
      if (itemName) item.name = itemName;
      if (width) item.originalWidth = width;
      if (height) item.originalHeight = height;
    }

    const currentVersionNumber = item.versions.length + 1;

    // 3. Call RunningHub Precision Matting AI App
    const taskId = await runAiApp({
      appId: '2076728877666717698',
      nodeInfoList: [{ nodeId: '7', fieldName: 'image', fieldValue: originalUrl }],
    });

    // 4. Create new version record in project
    const newVersion: RemoveBgVersion = {
      versionNumber: currentVersionNumber,
      taskId,
      outputUrl: '',
      modelId: 'matting-standard',
      modelName: 'Gaga Precision Matting',
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    };

    item.versions.push(newVersion);
    item.activeVersionIndex = item.versions.length - 1;
    item.updatedAt = new Date().toISOString();
    await saveRemoveBgProject(project);

    // 5. Record task in Supabase gaga_tasks
    try {
      const supabase = createAdminClient();
      await supabase.from('gaga_tasks').insert({
        user_id: user.id,
        project_id: project.id.startsWith('proj_') ? null : project.id,
        provider_task_id: taskId,
        mode: 'image',
        model: 'remove-bg',
        prompt: 'Remove Background (Precision Matting)',
        aspect_ratio: '1:1',
        resolution: '1K',
        status: 'RUNNING',
        metadata: {
          app: 'remove-bg',
          projectId: project.id,
          itemId: item.id,
          versionNumber: currentVersionNumber,
        },
      });
    } catch (dbErr) {
      console.warn('[gaga_tasks remove-bg insert warning]', dbErr);
    }

    return NextResponse.json({
      success: true,
      taskId,
      versionNumber: currentVersionNumber,
      item,
      project,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Background removal failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
