import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { generateImageI2I } from '@/lib/runninghub';
import { AUTO_RETOUCH_MASTER_PROMPT } from '@/lib/retouch/master-prompt';
import {
  calculateFluxDimensions,
  matchClosestAspectRatio,
  matchClosestSunburstAspectRatio,
} from '@/lib/retouch/dimensions';
import { getRetouchProjectById, saveRetouchProject } from '@/lib/retouch/projects';
import { RetouchModelId, RetouchVersion } from '@/lib/retouch/types';
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
      model = 'flux-2-edit',
    }: {
      projectId: string;
      itemId: string;
      itemName?: string;
      originalUrl: string;
      width?: number;
      height?: number;
      model?: RetouchModelId;
    } = body;

    if (!projectId || !itemId || !originalUrl) {
      return NextResponse.json({ error: 'projectId, itemId, and originalUrl are required' }, { status: 400 });
    }

    // 1. Fetch project
    const project = await getRetouchProjectById(projectId, user.id);
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
        detectedAspectRatio: matchClosestAspectRatio(imgWidth, imgHeight),
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
      item.detectedAspectRatio = matchClosestAspectRatio(imgWidth, imgHeight);
    }

    const currentVersionNumber = item.versions.length + 1;
    const modelName =
      model === 'flux-2-edit'
        ? 'Gaga Klein'
        : model === 'gpt-2.5-sunburst'
        ? 'Sunburst 2.5 (New)'
        : 'Gaga Pro';

    // 3. Prepare Model-Specific Payload
    let taskId: string;
    let customDims: { customWidth: number; customHight: number } | undefined;
    let matchedRatio: string | undefined;

    if (model === 'flux-2-edit') {
      customDims = calculateFluxDimensions(imgWidth, imgHeight);
      taskId = await generateImageI2I({
        model: 'flux-2-edit',
        prompt: AUTO_RETOUCH_MASTER_PROMPT,
        imageUrl: originalUrl,
        customWidth: customDims.customWidth,
        customHight: customDims.customHight,
      });
    } else if (model === 'gpt-2.5-sunburst') {
      matchedRatio = matchClosestSunburstAspectRatio(imgWidth, imgHeight);
      taskId = await generateImageI2I({
        model: 'gpt-2.5-sunburst',
        prompt: AUTO_RETOUCH_MASTER_PROMPT,
        imageUrl: originalUrl,
        aspectRatio: matchedRatio,
        resolution: '2K',
      });
    } else {
      matchedRatio = matchClosestAspectRatio(imgWidth, imgHeight);
      taskId = await generateImageI2I({
        model: 'nano-banana-2',
        prompt: AUTO_RETOUCH_MASTER_PROMPT,
        imageUrl: originalUrl,
        aspectRatio: matchedRatio,
        resolution: '2K',
      });
    }

    // 4. Create new version record in project
    const newVersion: RetouchVersion = {
      versionNumber: currentVersionNumber,
      taskId,
      outputUrl: '',
      modelId: model,
      modelName,
      aspectRatio: matchedRatio,
      customDimensions: customDims,
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    };

    item.versions.push(newVersion);
    item.activeVersionIndex = item.versions.length - 1;
    item.updatedAt = new Date().toISOString();
    await saveRetouchProject(project);

    // 5. Record task in Supabase gaga_tasks
    try {
      const supabase = createAdminClient();
      await supabase.from('gaga_tasks').insert({
        user_id: user.id,
        project_id: project.id.startsWith('proj_') ? null : project.id,
        provider_task_id: taskId,
        mode: 'image',
        model: `retouch:${model}`,
        prompt: AUTO_RETOUCH_MASTER_PROMPT.slice(0, 500),
        aspect_ratio: matchedRatio || '1:1',
        resolution: '2K',
        status: 'RUNNING',
        metadata: {
          app: 'auto-retouch',
          projectId: project.id,
          itemId: item.id,
          versionNumber: currentVersionNumber,
        },
      });
    } catch (dbErr) {
      console.warn('[gaga_tasks retouch insert warning]', dbErr);
    }

    return NextResponse.json({
      success: true,
      taskId,
      versionNumber: currentVersionNumber,
      item,
      project,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Retouch generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
