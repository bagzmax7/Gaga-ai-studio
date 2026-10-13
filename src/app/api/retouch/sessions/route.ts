import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getRetouchProjectById, saveRetouchProject } from '@/lib/retouch/projects';
import { pollTask } from '@/lib/runninghub';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const project = await getRetouchProjectById(projectId, user.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let updated = false;

  // Poll in-flight tasks for items
  for (const item of project.items) {
    for (const v of item.versions) {
      if (v.status === 'RUNNING' || v.status === 'QUEUED') {
        try {
          const res = await pollTask(v.taskId, 'image');
          if (res.status === 'SUCCESS' && res.outputs && res.outputs.length > 0) {
            v.status = 'SUCCESS';
            v.outputUrl = res.outputs[0].fileUrl;
            item.status = 'success';
            updated = true;

            // Sync to gaga_tasks
            try {
              const supabase = createAdminClient();
              await supabase
                .from('gaga_tasks')
                .update({
                  status: 'SUCCESS',
                  outputs: res.outputs,
                  updated_at: new Date().toISOString(),
                })
                .eq('provider_task_id', v.taskId);
            } catch {}
          } else if (res.status === 'FAILED') {
            v.status = 'FAILED';
            v.error = res.error || 'Task failed';
            item.status = 'failed';
            updated = true;

            try {
              const supabase = createAdminClient();
              await supabase
                .from('gaga_tasks')
                .update({
                  status: 'FAILED',
                  error_message: v.error,
                  updated_at: new Date().toISOString(),
                })
                .eq('provider_task_id', v.taskId);
            } catch {}
          }
        } catch {
          // Continue to next
        }
      }
    }
  }

  if (updated) {
    await saveRetouchProject(project);
  }

  return NextResponse.json({ project });
}
